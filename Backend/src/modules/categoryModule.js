const { pool } = require('../config/db');

const CATEGORY_COLUMNS = `
  c.id, c.catId, c.name, c.description, c.subcategory, c.images, c.user_id,
  c.status, c.created_at, c.updated_at
`;
const CATEGORY_AUDIT_COLUMNS = `
  c.created_by, creator.username AS created_by_name,
  c.updated_by, updater.username AS updated_by_name
`;

function parseJsonArray(value) {
  let parsed = value;
  while (typeof parsed === 'string') {
    parsed = JSON.parse(parsed);
  }
  if (!Array.isArray(parsed)) {
    throw new TypeError('Category JSON fields must contain arrays');
  }
  return parsed;
}

function parseCategory(category) {
  return {
    ...category,
    subcategory: parseJsonArray(category.subcategory),
    images: parseJsonArray(category.images)
  };
}

async function initializeCategoryModule() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      catId VARCHAR(32) NOT NULL UNIQUE,
      name VARCHAR(150) NOT NULL,
      description TEXT NULL,
      subcategory JSON NOT NULL,
      images JSON NOT NULL,
      user_id INT UNSIGNED NULL,
      status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  const [columns] = await pool.query('SHOW COLUMNS FROM categories');
  if (!columns.some((column) => column.Field === 'created_by')) {
    await pool.query(
      'ALTER TABLE categories ADD COLUMN created_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER user_id'
    );
  }
  if (!columns.some((column) => column.Field === 'updated_by')) {
    await pool.query(
      'ALTER TABLE categories ADD COLUMN updated_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER created_by'
    );
  }
  if (!columns.some((column) => column.Field === 'created_at')) {
    await pool.query('ALTER TABLE categories ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
  }
  if (!columns.some((column) => column.Field === 'updated_at')) {
    await pool.query('ALTER TABLE categories ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  }
  await ensureCategoryAuditForeignKey('created_by', 'fk_categories_created_by_user_id');
  await ensureCategoryAuditForeignKey('updated_by', 'fk_categories_updated_by_user_id');
}

async function ensureCategoryAuditForeignKey(column, constraintName) {
  const [orphanedUsers] = await pool.execute(
    `SELECT category.id FROM categories category
     LEFT JOIN users audit_user ON audit_user.user_id = category.\`${column}\`
     WHERE category.\`${column}\` IS NOT NULL AND audit_user.user_id IS NULL
     LIMIT 1`
  );
  if (orphanedUsers.length) {
    throw new Error(`Cannot link categories.${column} for category ${orphanedUsers[0].id}: the user_id does not exist`);
  }
  const [foreignKeys] = await pool.execute(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories'
       AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME = 'users'
       AND REFERENCED_COLUMN_NAME = 'user_id'`,
    [column]
  );
  if (!foreignKeys.length) {
    await pool.query(
      `ALTER TABLE categories ADD CONSTRAINT \`${constraintName}\`
       FOREIGN KEY (\`${column}\`) REFERENCES users(user_id) ON DELETE SET NULL`
    );
  }
}

async function listCategories({ includeAudit = false } = {}) {
  const auditColumns = includeAudit ? `, ${CATEGORY_AUDIT_COLUMNS}` : '';
  const auditJoins = includeAudit
    ? 'LEFT JOIN users creator ON creator.user_id = c.created_by LEFT JOIN users updater ON updater.user_id = c.updated_by'
    : '';
  const [categories] = await pool.query(
    `SELECT ${CATEGORY_COLUMNS}${auditColumns}
     FROM categories c ${auditJoins}
     ORDER BY c.created_at DESC, c.id DESC`
  );
  return categories.map(parseCategory);
}

async function getCategoryById(catId) {
  const [categories] = await pool.execute(
    `SELECT ${CATEGORY_COLUMNS}, ${CATEGORY_AUDIT_COLUMNS}
     FROM categories c
     LEFT JOIN users creator ON creator.user_id = c.created_by
     LEFT JOIN users updater ON updater.user_id = c.updated_by
     WHERE c.catId = ?`,
    [catId]
  );
  return categories[0] ? parseCategory(categories[0]) : null;
}

async function createCategory({ catId, name, description, subcategory, images, userId, createdBy, updatedBy }) {
  await pool.execute(
    `INSERT INTO categories
      (catId, name, description, subcategory, images, user_id, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      catId, name, description || null, JSON.stringify(subcategory), JSON.stringify(images),
      userId, createdBy, updatedBy
    ]
  );
  return getCategoryById(catId);
}

async function updateCategory(catId, { name, description, subcategory, images, userId, updatedBy }) {
  await pool.execute(
    `UPDATE categories
     SET name = ?, description = ?, subcategory = ?, images = ?, user_id = ?, updated_by = ?
     WHERE catId = ?`,
    [name, description || null, JSON.stringify(subcategory), JSON.stringify(images), userId, updatedBy, catId]
  );
  return getCategoryById(catId);
}

async function deleteCategory(catId) {
  const [result] = await pool.execute('DELETE FROM categories WHERE catId = ?', [catId]);
  return result.affectedRows > 0;
}

module.exports = {
  createCategory,
  deleteCategory,
  getCategoryById,
  initializeCategoryModule,
  listCategories,
  updateCategory
};

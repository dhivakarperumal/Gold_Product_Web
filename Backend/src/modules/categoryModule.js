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
      catId VARCHAR(32) NOT NULL,
      name VARCHAR(150) NOT NULL,
      description TEXT NULL,
      subcategory JSON NOT NULL,
      images JSON NOT NULL,
      user_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
      status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_categories_user_cat_id (user_id, catId)
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
  await migrateCategoryUserId();
  await ensureCategoryIdIndexes();
}

async function ensureCategoryAuditForeignKey(column, constraintName) {
  await pool.query(`
    UPDATE categories category
    LEFT JOIN users legacy_user ON legacy_user.id = CAST(category.\`${column}\` AS UNSIGNED)
    SET category.\`${column}\` = legacy_user.user_id
    WHERE category.\`${column}\` REGEXP '^[0-9]+$'
  `);
  await pool.query(`
    UPDATE categories category
    LEFT JOIN users audit_user ON audit_user.user_id = category.\`${column}\`
    SET category.\`${column}\` = NULL
    WHERE category.\`${column}\` IS NOT NULL AND audit_user.user_id IS NULL
  `);
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

async function migrateCategoryUserId() {
  const [userIdColumns] = await pool.execute(
    `SELECT COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'user_id'`
  );
  const userIdColumn = userIdColumns[0];
  if (!userIdColumn) throw new Error('The categories.user_id column is missing');

  const needsUuidType = userIdColumn.COLUMN_TYPE.toLowerCase() !== 'varchar(255)'
    || userIdColumn.CHARACTER_SET_NAME !== 'ascii'
    || userIdColumn.COLLATION_NAME !== 'ascii_bin';
  const [foreignKeys] = await pool.execute(
    `SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories'
       AND COLUMN_NAME = 'user_id' AND REFERENCED_TABLE_NAME IS NOT NULL`
  );
  const foreignKeysToDrop = foreignKeys.filter((foreignKey) => (
    needsUuidType
    || foreignKey.REFERENCED_TABLE_NAME !== 'users'
    || foreignKey.REFERENCED_COLUMN_NAME !== 'user_id'
  ));
  for (const foreignKey of foreignKeysToDrop) {
    const escapedName = String(foreignKey.CONSTRAINT_NAME).replace(/`/g, '``');
    await pool.query(`ALTER TABLE categories DROP FOREIGN KEY \`${escapedName}\``);
  }
  if (needsUuidType) {
    await pool.query(
      'ALTER TABLE categories MODIFY user_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL'
    );
  }

  await pool.query(`
    UPDATE categories category
    LEFT JOIN users legacy_owner ON legacy_owner.id = CAST(category.user_id AS UNSIGNED)
    SET category.user_id = COALESCE(category.created_by, legacy_owner.user_id)
    WHERE category.user_id REGEXP '^[0-9]+$'
  `);
  await pool.query(`
    UPDATE categories
    SET user_id = created_by
    WHERE created_by IS NOT NULL AND (user_id IS NULL OR user_id <> created_by)
  `);
  await pool.query(`
    UPDATE categories category
    JOIN users owner ON owner.user_id = category.user_id
    SET category.created_by = category.user_id
    WHERE category.created_by IS NULL
  `);
  await ensureCategoryAuditForeignKey('user_id', 'fk_categories_user_id');
}

async function ensureCategoryIdIndexes() {
  const [references] = await pool.execute(
    `SELECT TABLE_NAME, CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'categories'
       AND REFERENCED_COLUMN_NAME = 'catId'`
  );
  if (references.length) {
    throw new Error('Cannot make category IDs per-admin while another table references categories.catId');
  }

  const [indexes] = await pool.execute(
    `SELECT INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS column_list
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories'
     GROUP BY INDEX_NAME, NON_UNIQUE`
  );
  if (!indexes.some((index) => Number(index.NON_UNIQUE) === 0 && index.column_list === 'user_id,catId')) {
    await pool.query('ALTER TABLE categories ADD UNIQUE KEY uq_categories_user_cat_id (user_id, catId)');
  }
  for (const index of indexes) {
    if (Number(index.NON_UNIQUE) === 0 && index.column_list === 'catId') {
      const escapedName = String(index.INDEX_NAME).replace(/`/g, '``');
      await pool.query(`ALTER TABLE categories DROP INDEX \`${escapedName}\``);
    }
  }
}

async function listCategories({ includeAudit = false, userId } = {}) {
  if (includeAudit && !userId) {
    throw new Error('Authenticated user ID is required to list managed categories');
  }
  const auditColumns = includeAudit ? `, ${CATEGORY_AUDIT_COLUMNS}` : '';
  const auditJoins = includeAudit
    ? `LEFT JOIN users creator ON creator.user_id = c.created_by
       LEFT JOIN users updater ON updater.user_id = c.updated_by`
    : '';
  const where = includeAudit ? 'WHERE c.user_id = ?' : '';
  const params = includeAudit ? [userId] : [];
  const [categories] = await pool.query(
    `SELECT ${CATEGORY_COLUMNS}${auditColumns}
     FROM categories c ${auditJoins}
     ${where}
     ORDER BY c.created_at DESC, c.id DESC`,
    params
  );
  return categories.map(parseCategory);
}

async function selectCategoryById(connection, catId, userId) {
  const [categories] = await connection.execute(
    `SELECT ${CATEGORY_COLUMNS}, ${CATEGORY_AUDIT_COLUMNS}
     FROM categories c
     LEFT JOIN users creator ON creator.user_id = c.created_by
     LEFT JOIN users updater ON updater.user_id = c.updated_by
     WHERE c.catId = ? AND c.user_id = ?`,
    [catId, userId]
  );
  return categories[0] ? parseCategory(categories[0]) : null;
}

async function getCategoryById(catId, { userId } = {}) {
  if (!userId) throw new Error('Authenticated user ID is required to get a category');
  return selectCategoryById(pool, catId, userId);
}

async function createCategory({
  name,
  description,
  subcategory,
  images,
  ownerUserId
}) {
  if (!ownerUserId) throw new Error('Authenticated user ID is required to create a category');
  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [users] = await connection.execute(
      'SELECT user_id FROM users WHERE user_id = ? FOR UPDATE',
      [ownerUserId]
    );
    if (!users.length) throw new Error('Authenticated category owner does not exist');

    const [categories] = await connection.execute(
      'SELECT catId FROM categories WHERE user_id = ? FOR UPDATE',
      [ownerUserId]
    );
    const maxNumber = categories.reduce((max, category) => {
      const match = /^CAT(\d+)$/i.exec(String(category.catId || ''));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    if (!Number.isSafeInteger(maxNumber + 1)) {
      throw new Error('The category ID sequence has exceeded the supported range');
    }
    const catId = `CAT${String(maxNumber + 1).padStart(3, '0')}`;

    await connection.execute(
      `INSERT INTO categories
        (catId, name, description, subcategory, images, user_id, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        catId, name, description || null, JSON.stringify(subcategory), JSON.stringify(images),
        ownerUserId, ownerUserId, ownerUserId
      ]
    );
    const category = await selectCategoryById(connection, catId, ownerUserId);
    if (!category) throw new Error('The created category could not be loaded');

    await connection.commit();
    transactionStarted = false;
    return category;
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateCategory(catId, {
  name,
  description,
  subcategory,
  images,
  updatedBy,
  ownerUserId
}) {
  if (!ownerUserId) throw new Error('Authenticated user ID is required to update a category');
  const [result] = await pool.execute(
    `UPDATE categories
     SET name = ?, description = ?, subcategory = ?, images = ?, updated_by = ?
     WHERE catId = ? AND user_id = ?`,
    [
      name, description || null, JSON.stringify(subcategory), JSON.stringify(images), updatedBy,
      catId, ownerUserId
    ]
  );
  if (!result.affectedRows) {
    return getCategoryById(catId, { userId: ownerUserId });
  }
  return getCategoryById(catId, { userId: ownerUserId });
}

async function deleteCategory(catId, ownerUserId) {
  if (!ownerUserId) throw new Error('Authenticated user ID is required to delete a category');
  const [result] = await pool.execute(
    'DELETE FROM categories WHERE catId = ? AND user_id = ?',
    [catId, ownerUserId]
  );
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

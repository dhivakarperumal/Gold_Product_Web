const { pool } = require('../config/db');

const METAL_COLUMNS = 'm.id, m.name, m.purity, m.description, m.image, m.status, m.created_at, m.updated_at';
const METAL_AUDIT_COLUMNS = `
  m.created_by, creator.username AS created_by_name,
  m.updated_by, updater.username AS updated_by_name
`;

async function initializeMetalModule() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS metals (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      purity VARCHAR(50) NULL,
      description TEXT NULL,
      image LONGTEXT NULL,
      status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const [imageColumns] = await pool.query("SHOW COLUMNS FROM metals LIKE 'image'");
  if (imageColumns.length === 0) {
    await pool.query('ALTER TABLE metals ADD COLUMN image LONGTEXT NULL AFTER description');
  }
  const [columns] = await pool.query('SHOW COLUMNS FROM metals');
  if (!columns.some((column) => column.Field === 'created_by')) {
    await pool.query(
      'ALTER TABLE metals ADD COLUMN created_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER status'
    );
  }
  if (!columns.some((column) => column.Field === 'updated_by')) {
    await pool.query(
      'ALTER TABLE metals ADD COLUMN updated_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER created_by'
    );
  }
  if (!columns.some((column) => column.Field === 'created_at')) {
    await pool.query('ALTER TABLE metals ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
  }
  if (!columns.some((column) => column.Field === 'updated_at')) {
    await pool.query('ALTER TABLE metals ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  }
  await ensureMetalAuditForeignKey('created_by', 'fk_metals_created_by_user_id');
  await ensureMetalAuditForeignKey('updated_by', 'fk_metals_updated_by_user_id');
}

async function ensureMetalAuditForeignKey(column, constraintName) {
  const [orphanedUsers] = await pool.execute(
    `SELECT metal.id FROM metals metal
     LEFT JOIN users audit_user ON audit_user.user_id = metal.\`${column}\`
     WHERE metal.\`${column}\` IS NOT NULL AND audit_user.user_id IS NULL
     LIMIT 1`
  );
  if (orphanedUsers.length) {
    throw new Error(`Cannot link metals.${column} for metal ${orphanedUsers[0].id}: the user_id does not exist`);
  }
  const [foreignKeys] = await pool.execute(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'metals'
       AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME = 'users'
       AND REFERENCED_COLUMN_NAME = 'user_id'`,
    [column]
  );
  if (!foreignKeys.length) {
    await pool.query(
      `ALTER TABLE metals ADD CONSTRAINT \`${constraintName}\`
       FOREIGN KEY (\`${column}\`) REFERENCES users(user_id) ON DELETE SET NULL`
    );
  }
}

async function listMetals({ includeAudit = false, createdBy } = {}) {
  if (includeAudit && !createdBy) {
    throw new Error('Authenticated user ID is required to list managed metals');
  }
  const auditColumns = includeAudit ? `, ${METAL_AUDIT_COLUMNS}` : '';
  const auditJoins = includeAudit
    ? 'LEFT JOIN users creator ON creator.user_id = m.created_by LEFT JOIN users updater ON updater.user_id = m.updated_by'
    : '';
  const ownerFilter = createdBy ? 'WHERE m.created_by = ?' : '';
  const [metals] = await pool.query(
    `SELECT ${METAL_COLUMNS}${auditColumns}
     FROM metals m ${auditJoins}
     ${ownerFilter}
     ORDER BY m.created_at DESC, m.id DESC`,
    createdBy ? [createdBy] : []
  );
  return metals;
}

async function getMetalById(id, { createdBy } = {}) {
  const ownerFilter = createdBy ? 'AND m.created_by = ?' : '';
  const [metals] = await pool.execute(
    `SELECT ${METAL_COLUMNS}, ${METAL_AUDIT_COLUMNS}
     FROM metals m
     LEFT JOIN users creator ON creator.user_id = m.created_by
     LEFT JOIN users updater ON updater.user_id = m.updated_by
     WHERE m.id = ? ${ownerFilter}`,
    createdBy ? [id, createdBy] : [id]
  );
  return metals[0] || null;
}

async function createMetal({ name, purity, description, image, status, createdBy, updatedBy }) {
  const [result] = await pool.execute(
    `INSERT INTO metals
      (name, purity, description, image, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, purity || null, description || null, image || null, status, createdBy, updatedBy]
  );
  return getMetalById(result.insertId, { createdBy });
}

async function updateMetal(id, { name, purity, description, image, status, updatedBy, ownerUserId }) {
  await pool.execute(
    `UPDATE metals
     SET name = ?, purity = ?, description = ?, image = ?, status = ?, updated_by = ?
     WHERE id = ? AND created_by = ?`,
    [name, purity || null, description || null, image || null, status, updatedBy, id, ownerUserId]
  );
  return getMetalById(id, { createdBy: ownerUserId });
}

async function deleteMetal(id, ownerUserId) {
  const [result] = await pool.execute(
    'DELETE FROM metals WHERE id = ? AND created_by = ?',
    [id, ownerUserId]
  );
  return result.affectedRows > 0;
}

module.exports = {
  createMetal,
  deleteMetal,
  getMetalById,
  initializeMetalModule,
  listMetals,
  updateMetal
};

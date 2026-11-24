const { pool } = require('../config/db');

const DEFAULT_RECEIPT_SETTINGS = {
  shopName: 'Sri Golds',
  logoUrl: '/images/logo.png',
  address: 'Tirupattur – Singarapet Road, Tirupattur, Tirupathur, Tirupattur, Tamil Nadu, 635600, India',
  gstNumber: '',
  phone: '',
  email: '',
  footerMessage: 'Thank you for choosing us. We value your trust and look forward to serving you again.'
};

async function initializeReceiptSettingsModule() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS receipt_settings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
      settings_json LONGTEXT NOT NULL,
      created_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
      updated_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_receipt_settings_user_id (user_id)
    )
  `);
  const [columns] = await pool.query('SHOW COLUMNS FROM receipt_settings');
  const existingColumns = new Set(columns.map((column) => column.Field));
  const columnMigrations = [
    ['user_id', 'VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER id'],
    ['created_by', 'VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL'],
    ['updated_by', 'VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL'],
    ['created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'],
    ['updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP']
  ];
  for (const [column, definition] of columnMigrations) {
    if (!existingColumns.has(column)) {
      await pool.query(`ALTER TABLE receipt_settings ADD COLUMN \`${column}\` ${definition}`);
    }
  }
  const idColumn = columns.find((column) => column.Field === 'id');
  if (idColumn && !String(idColumn.Extra || '').includes('auto_increment')) {
    await pool.query(
      'ALTER TABLE receipt_settings MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT'
    );
  }
  const [indexes] = await pool.query('SHOW INDEX FROM receipt_settings');
  if (!indexes.some((index) => index.Column_name === 'user_id' && Number(index.Non_unique) === 0)) {
    await pool.query(
      'ALTER TABLE receipt_settings ADD UNIQUE KEY uq_receipt_settings_user_id (user_id)'
    );
  }
}

function requireUserId(userId) {
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new TypeError('An authenticated user ID is required for receipt settings');
  }
  return userId.trim();
}

async function getReceiptSettings(userId) {
  const ownerUserId = requireUserId(userId);
  const [rows] = await pool.execute(
    'SELECT settings_json FROM receipt_settings WHERE user_id = ?',
    [ownerUserId]
  );
  if (!rows[0]) return { ...DEFAULT_RECEIPT_SETTINGS };
  return { ...DEFAULT_RECEIPT_SETTINGS, ...JSON.parse(rows[0].settings_json) };
}

async function saveReceiptSettings(settings, userId) {
  const ownerUserId = requireUserId(userId);
  await pool.execute(
    `INSERT INTO receipt_settings (user_id, settings_json, created_by, updated_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       settings_json = VALUES(settings_json),
       updated_by = VALUES(updated_by)`,
    [ownerUserId, JSON.stringify(settings), ownerUserId, ownerUserId]
  );
  return settings;
}

module.exports = {
  DEFAULT_RECEIPT_SETTINGS,
  getReceiptSettings,
  initializeReceiptSettingsModule,
  saveReceiptSettings
};

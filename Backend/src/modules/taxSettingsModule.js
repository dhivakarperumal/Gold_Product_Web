const { pool } = require('../config/db');

const DEFAULT_TAX_SETTINGS = {
  gst_enabled: false,
  gst_rate: 0,
  tax_mode: 'Tax Exclusive'
};

function requireUserId(userId) {
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new TypeError('An authenticated user ID is required for tax settings');
  }
  return userId.trim();
}

async function initializeTaxSettingsModule() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_tax_settings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      gst_enabled TINYINT(1) NOT NULL DEFAULT 0,
      gst_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
      tax_mode VARCHAR(20) NOT NULL DEFAULT 'Tax Exclusive',
      created_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
      updated_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_store_tax_settings_user_id (user_id)
    )
  `);

  const [columns] = await pool.query('SHOW COLUMNS FROM store_tax_settings');
  const existingColumns = new Set(columns.map((column) => column.Field));
  const columnMigrations = [
    ['user_id', 'VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER id'],
    ['gst_enabled', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['gst_rate', 'DECIMAL(5,2) NOT NULL DEFAULT 0'],
    ['tax_mode', "VARCHAR(20) NOT NULL DEFAULT 'Tax Exclusive'"],
    ['created_by', 'VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL'],
    ['updated_by', 'VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL'],
    ['created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'],
    ['updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP']
  ];
  for (const [column, definition] of columnMigrations) {
    if (!existingColumns.has(column)) {
      await pool.query(`ALTER TABLE store_tax_settings ADD COLUMN \`${column}\` ${definition}`);
    }
  }

  const idColumn = columns.find((column) => column.Field === 'id');
  if (idColumn && !String(idColumn.Extra || '').includes('auto_increment')) {
    await pool.query(
      'ALTER TABLE store_tax_settings MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT'
    );
  }

  const [indexes] = await pool.query('SHOW INDEX FROM store_tax_settings');
  if (!indexes.some((index) => index.Column_name === 'user_id' && Number(index.Non_unique) === 0)) {
    await pool.query(
      'ALTER TABLE store_tax_settings ADD UNIQUE KEY uq_store_tax_settings_user_id (user_id)'
    );
  }
}

async function getTaxSettings(userId) {
  const ownerUserId = requireUserId(userId);
  const [rows] = await pool.execute(
    `SELECT gst_enabled, gst_rate, tax_mode, created_by, updated_by, created_at, updated_at
     FROM store_tax_settings WHERE user_id = ?`,
    [ownerUserId]
  );
  const row = rows[0];
  if (!row) {
    return {
      ...DEFAULT_TAX_SETTINGS,
      created_by: null,
      updated_by: null,
      created_at: null,
      updated_at: null
    };
  }
  return {
    gst_enabled: Boolean(Number(row.gst_enabled)),
    gst_rate: Number(row.gst_rate),
    tax_mode: row.tax_mode,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function saveTaxSettings(settings, userId) {
  const ownerUserId = requireUserId(userId);
  await pool.execute(
    `INSERT INTO store_tax_settings
       (user_id, gst_enabled, gst_rate, tax_mode, created_by, updated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       gst_enabled = VALUES(gst_enabled),
       gst_rate = VALUES(gst_rate),
       tax_mode = VALUES(tax_mode),
       updated_by = VALUES(updated_by),
       updated_at = CURRENT_TIMESTAMP`,
    [
      ownerUserId,
      settings.gst_enabled ? 1 : 0,
      settings.gst_rate,
      settings.tax_mode,
      ownerUserId,
      ownerUserId
    ]
  );
  return getTaxSettings(ownerUserId);
}

module.exports = {
  DEFAULT_TAX_SETTINGS,
  getTaxSettings,
  initializeTaxSettingsModule,
  saveTaxSettings
};

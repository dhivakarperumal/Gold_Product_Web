const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../src/config/db');
const {
  DEFAULT_RECEIPT_SETTINGS,
  getReceiptSettings,
  initializeReceiptSettingsModule,
  saveReceiptSettings
} = require('../src/modules/receiptSettingsModule');
const {
  normalizeSettings
} = require('../src/controllers/receiptSettingsController');

test('normalizes receipt settings and fills omitted values with defaults', () => {
  const result = normalizeSettings({ shopName: '  My Shop  ' });
  assert.equal(result.error, undefined);
  assert.equal(result.settings.shopName, 'My Shop');
  assert.equal(result.settings.logoUrl, DEFAULT_RECEIPT_SETTINGS.logoUrl);
  assert.equal(result.settings.footerMessage, DEFAULT_RECEIPT_SETTINGS.footerMessage);
});

test('accepts supported receipt logo paths, URLs, and embedded images', () => {
  for (const logoUrl of [
    '/uploads/shop-logo.webp',
    'https://example.com/shop-logo.png',
    `data:image/png;base64,${Buffer.from('logo').toString('base64')}`
  ]) {
    assert.equal(normalizeSettings({ shopName: 'Shop', logoUrl }).error, undefined);
  }
});

test('rejects invalid receipt fields, empty shop names, and unsupported logo URLs', () => {
  assert.match(normalizeSettings([]).error, /invalid/i);
  assert.match(normalizeSettings({ shopName: ' ' }).error, /required/i);
  assert.match(normalizeSettings({ shopName: 'Shop', phone: 123 }).error, /invalid/i);
  assert.match(normalizeSettings({ shopName: 'Shop', logoUrl: 'javascript:alert(1)' }).error, /logo/i);
  assert.match(normalizeSettings({ shopName: 'Shop', footerMessage: 'x'.repeat(1001) }).error, /invalid/i);
});

test('reads receipt settings only for the authenticated user', async () => {
  const originalExecute = pool.execute;
  const queries = [];
  pool.execute = async (sql, values) => {
    queries.push({ sql, values });
    return [[{ settings_json: JSON.stringify({ shopName: 'My Shop' }) }], []];
  };
  try {
    const settings = await getReceiptSettings('shop-user-1');
    assert.equal(settings.shopName, 'My Shop');
    assert.match(queries[0].sql, /WHERE user_id = \?/);
    assert.deepEqual(queries[0].values, ['shop-user-1']);
  } finally {
    pool.execute = originalExecute;
  }
});

test('saves receipt settings with user-scoped creator and updater audit fields', async () => {
  const originalExecute = pool.execute;
  let query;
  pool.execute = async (sql, values) => {
    query = { sql, values };
    return [{ affectedRows: 1 }, []];
  };
  const settings = { ...DEFAULT_RECEIPT_SETTINGS, shopName: 'My Shop' };
  try {
    assert.equal(await saveReceiptSettings(settings, 'shop-user-1'), settings);
    assert.match(query.sql, /user_id, settings_json, created_by, updated_by/);
    assert.deepEqual(query.values, [
      'shop-user-1',
      JSON.stringify(settings),
      'shop-user-1',
      'shop-user-1'
    ]);
    assert.match(query.sql, /updated_by = VALUES\(updated_by\)/);
  } finally {
    pool.execute = originalExecute;
  }
});

test('migrates legacy receipt settings storage without assigning its global row to a user', async () => {
  const originalQuery = pool.query;
  const statements = [];
  pool.query = async (sql) => {
    const statement = String(sql);
    statements.push(statement);
    if (statement === 'SHOW COLUMNS FROM receipt_settings') {
      return [[
        { Field: 'id', Extra: '' },
        { Field: 'settings_json', Extra: '' },
        { Field: 'updated_at', Extra: '' }
      ], []];
    }
    if (statement === 'SHOW INDEX FROM receipt_settings') {
      return [[{ Column_name: 'id', Non_unique: 0 }], []];
    }
    return [{}, []];
  };
  try {
    await initializeReceiptSettingsModule();
    assert.ok(statements.some((sql) => sql.includes('ADD COLUMN `user_id`')));
    assert.ok(statements.some((sql) => sql.includes('ADD COLUMN `created_by`')));
    assert.ok(statements.some((sql) => sql.includes('ADD COLUMN `updated_by`')));
    assert.ok(statements.some((sql) => sql.includes('ADD COLUMN `created_at`')));
    assert.ok(statements.some((sql) => sql.includes('MODIFY COLUMN id BIGINT UNSIGNED')));
    assert.ok(statements.some((sql) => sql.includes('ADD UNIQUE KEY uq_receipt_settings_user_id')));
  } finally {
    pool.query = originalQuery;
  }
});

test('requires a user ID for receipt settings access', async () => {
  await assert.rejects(getReceiptSettings(), /authenticated user ID is required/i);
  await assert.rejects(saveReceiptSettings(DEFAULT_RECEIPT_SETTINGS), /authenticated user ID is required/i);
});

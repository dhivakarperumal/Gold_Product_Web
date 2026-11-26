const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeSettings } = require('../src/controllers/taxSettingsController');
const { pool } = require('../src/config/db');
const { getTaxSettings, saveTaxSettings } = require('../src/modules/taxSettingsModule');

test('validates tax setting fields and rounds the configured rate', () => {
  assert.deepEqual(normalizeSettings({
    gst_enabled: true,
    gst_rate: '12.345',
    tax_mode: 'Tax Inclusive'
  }), {
    settings: {
      gst_enabled: true,
      gst_rate: 12.35,
      tax_mode: 'Tax Inclusive'
    }
  });
  assert.match(normalizeSettings({
    gst_enabled: 1,
    gst_rate: 12,
    tax_mode: 'Tax Inclusive'
  }).error, /gst_enabled/);
  assert.match(normalizeSettings({
    gst_enabled: true,
    gst_rate: 101,
    tax_mode: 'Tax Exclusive'
  }).error, /gst_rate/);
});

test('returns default settings for the requested admin only', async () => {
  const originalExecute = pool.execute;
  let captured;
  pool.execute = async (query, values) => {
    captured = { query, values };
    return [[], []];
  };
  try {
    assert.deepEqual(await getTaxSettings('admin-user-1'), {
      gst_enabled: false,
      gst_rate: 0,
      tax_mode: 'Tax Exclusive',
      created_by: null,
      updated_by: null,
      created_at: null,
      updated_at: null
    });
  } finally {
    pool.execute = originalExecute;
  }
  assert.match(captured.query, /WHERE user_id = \?/);
  assert.deepEqual(captured.values, ['admin-user-1']);
});

test('saves the owning admin as creator and updater', async () => {
  const originalExecute = pool.execute;
  const calls = [];
  pool.execute = async (query, values) => {
    calls.push({ query, values });
    if (calls.length === 1) return [{ affectedRows: 1 }, []];
    return [[{
      gst_enabled: 1,
      gst_rate: '5.00',
      tax_mode: 'Tax Exclusive',
      created_by: 'admin-user-2',
      updated_by: 'admin-user-2',
      created_at: 'created',
      updated_at: 'updated'
    }], []];
  };
  try {
    const saved = await saveTaxSettings({
      gst_enabled: true,
      gst_rate: 5,
      tax_mode: 'Tax Exclusive'
    }, 'admin-user-2');
    assert.equal(saved.created_by, 'admin-user-2');
    assert.equal(saved.updated_by, 'admin-user-2');
    assert.equal(saved.gst_rate, 5);
  } finally {
    pool.execute = originalExecute;
  }
  assert.match(calls[0].query, /ON DUPLICATE KEY UPDATE/);
  assert.match(calls[0].query, /updated_by = VALUES\(updated_by\)/);
  assert.deepEqual(calls[0].values, [
    'admin-user-2', 1, 5, 'Tax Exclusive', 'admin-user-2', 'admin-user-2'
  ]);
  assert.deepEqual(calls[1].values, ['admin-user-2']);
});

const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/db');
const { recordBillingPayment } = require('../src/modules/billingModule');
const {
  createFundTransaction,
  listFundAccounts,
  listFundTransactions,
  updateFundAccountStatus
} = require('../src/modules/fundModule');

test('lists only fund accounts owned by the requesting admin', async (context) => {
  const originalQuery = pool.query;
  let query;
  pool.query = async (sql, values) => {
    query = { sql, values };
    return [[{ id: 8, created_by: 'admin-user-uuid' }]];
  };
  context.after(() => { pool.query = originalQuery; });

  const accounts = await listFundAccounts('admin-user-uuid');

  assert.equal(accounts[0].created_by, 'admin-user-uuid');
  assert.match(query.sql, /WHERE a\.created_by = \?/);
  assert.deepEqual(query.values, ['admin-user-uuid']);
});

test('scopes transaction rows and totals to the account owner', async (context) => {
  const originalExecute = pool.execute;
  const queries = [];
  pool.execute = async (sql, values) => {
    queries.push({ sql, values });
    return sql.includes('COUNT(*)') ? [[{ total: 0 }]] : [[]];
  };
  context.after(() => { pool.execute = originalExecute; });

  await listFundTransactions({
    owner_user_id: 'admin-user-uuid',
    page: 1,
    page_size: 20,
    dateRange: {}
  });

  assert.equal(queries.length, 2);
  for (const query of queries) {
    assert.match(query.sql, /a\.created_by = \?/);
    assert.equal(query.values[0], 'admin-user-uuid');
  }
});

test('prevents an admin from posting to another admin fund account', async (context) => {
  const originalGetConnection = pool.getConnection;
  const state = { rolledBack: false, released: false };
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() { state.rolledBack = true; },
    release() { state.released = true; },
    async execute() {
      return [[{ id: 8, is_active: 1, created_by: 'another-admin-uuid' }]];
    }
  };
  pool.getConnection = async () => connection;
  context.after(() => { pool.getConnection = originalGetConnection; });

  await assert.rejects(createFundTransaction({
    account_id: 8,
    transaction_type: 'CREDIT',
    amount: '10.00',
    owner_user_id: 'admin-user-uuid'
  }), { code: 'FUND_ACCOUNT_NOT_FOUND' });

  assert.equal(state.rolledBack, true);
  assert.equal(state.released, true);
});

test('prevents billing payments from using another admin fund account', async (context) => {
  const originalGetConnection = pool.getConnection;
  const state = { rolledBack: false, released: false };
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() { state.rolledBack = true; },
    release() { state.released = true; },
    async execute(sql) {
      if (sql.includes('FROM billings WHERE id = ?')) {
        return [[{ id: 1, invoice_no: 'INV-1', customers: '[]', total_amount: '10.00', paid_amount: '0.00' }]];
      }
      if (sql.includes('FROM fund_accounts WHERE id = ?')) {
        return [[{ id: 8, is_active: 1, created_by: 'another-admin-uuid' }]];
      }
      throw new Error(`Unexpected statement: ${sql}`);
    }
  };
  pool.getConnection = async () => connection;
  context.after(() => { pool.getConnection = originalGetConnection; });

  await assert.rejects(recordBillingPayment(1, {
    account_id: 8,
    payment_kind: 'PAYMENT',
    amount: '10.00',
    owner_user_id: 'admin-user-uuid'
  }), { code: 'FUND_ACCOUNT_NOT_FOUND' });

  assert.equal(state.rolledBack, true);
  assert.equal(state.released, true);
});

test('records the acting admin when changing an owned account status', async (context) => {
  const originalExecute = pool.execute;
  let query;
  pool.execute = async (sql, values) => {
    query = { sql, values };
    return [{ affectedRows: 1 }];
  };
  context.after(() => { pool.execute = originalExecute; });

  const updated = await updateFundAccountStatus(8, false, 'actor-user-uuid', 'owner-user-uuid');

  assert.equal(updated, true);
  assert.match(query.sql, /WHERE id = \? AND created_by = \?/);
  assert.deepEqual(query.values, [false, 'actor-user-uuid', 8, 'owner-user-uuid']);
});

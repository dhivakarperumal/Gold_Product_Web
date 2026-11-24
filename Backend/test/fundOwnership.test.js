const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/db');
const {
  createFundTransaction,
  initializeFundsModule,
  listFundTransactions
} = require('../src/modules/fundsModule');

test('qualifies the destination id in both legacy fund migration upserts', async (context) => {
  const originalExecute = pool.execute;
  const originalQuery = pool.query;
  const statements = [];
  const transactionColumns = [
    'created_by', 'created_by_legacy_id', 'transaction_type', 'transaction_date',
    'amount', 'payment_method', 'category', 'description', 'party_name',
    'related_reference', 'reference_number', 'idempotency_key', 'transfer_id',
    'status', 'created_at', 'updated_at'
  ].map((Field) => ({
    Field,
    Type: Field === 'created_by_legacy_id' ? 'bigint unsigned' : 'varchar(150)'
  }));
  const accountColumns = ['created_by', 'opening_balance', 'created_at', 'updated_at', 'name']
    .map((Field) => ({ Field, Type: Field === 'opening_balance' ? 'decimal(14,2)' : 'varchar(150)' }));
  pool.execute = async (sql, values) => {
    if (!sql.includes('information_schema.tables')) throw new Error(`Unexpected statement: ${sql}`);
    return [[{ table_count: ['fund_transactions', 'fund_accounts'].includes(values[0]) ? 1 : 0 }]];
  };
  pool.query = async (sql) => {
    statements.push(sql);
    if (sql.includes('SHOW COLUMNS FROM `fund_transactions`')) return [transactionColumns];
    if (sql.includes('SHOW COLUMNS FROM `fund_accounts`')) return [accountColumns];
    return [[]];
  };
  context.after(() => {
    pool.execute = originalExecute;
    pool.query = originalQuery;
  });

  await initializeFundsModule();

  const migrationUpserts = statements.filter((sql) => sql.includes('INSERT INTO funds'));
  assert.equal(migrationUpserts.length, 2);
  for (const statement of migrationUpserts) {
    assert.match(statement, /ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID\(funds\.id\)/);
  }
});

test('scopes fund transaction rows and totals to the requesting admin', async (context) => {
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
    assert.match(query.sql, /f\.created_by = \?/);
    assert.equal(query.values[0], 'admin-user-uuid');
  }
});

test('records fund entries with the authenticated admin as creator and updater', async (context) => {
  const originalGetConnection = pool.getConnection;
  const originalExecute = pool.execute;
  const state = { committed: false, inserted: null, rolledBack: false, released: false };
  const connection = {
    async beginTransaction() {},
    async commit() { state.committed = true; },
    async rollback() { state.rolledBack = true; },
    release() { state.released = true; },
    async execute(sql, values) {
      if (sql.includes('FROM users WHERE user_id = ?')) {
        assert.match(sql, /role = 'admin'/);
        return [[{ user_id: 'admin-user-uuid' }]];
      }
      if (sql.includes('AS balance')) return [[{ balance: '125.00' }]];
      if (sql.startsWith('INSERT INTO funds')) {
        state.inserted = { sql, values };
        return [{ insertId: 7 }];
      }
      throw new Error(`Unexpected statement: ${sql}`);
    }
  };
  pool.getConnection = async () => connection;
  pool.execute = async (sql, values) => {
    assert.match(sql, /SELECT \* FROM funds WHERE id = \? AND created_by = \?/);
    assert.deepEqual(values, [7, 'admin-user-uuid']);
    return [[{ id: 7, created_by: 'admin-user-uuid', updated_by: 'admin-user-uuid' }]];
  };
  context.after(() => {
    pool.getConnection = originalGetConnection;
    pool.execute = originalExecute;
  });

  const entry = await createFundTransaction({
    created_by: 'admin-user-uuid',
    updated_by: 'admin-user-uuid',
    admin_name: 'Admin One',
    transaction_type: 'FUND_ADDED',
    transaction_date: '2026-10-20 12:00:00',
    amount: '25.00',
    payment_method: 'Cash',
    description: 'Opening funds',
    idempotency_key: 'fund-entry-1'
  });

  assert.equal(entry.created_by, 'admin-user-uuid');
  assert.equal(entry.updated_by, 'admin-user-uuid');
  assert.deepEqual(state.inserted.values.slice(0, 3), [
    'admin-user-uuid', 'admin-user-uuid', 'FUND_ADDED'
  ]);
  assert.equal(state.committed, true);
  assert.equal(state.rolledBack, false);
  assert.equal(state.released, true);
});

test('rolls back a debit that exceeds the admin fund balance', async (context) => {
  const originalGetConnection = pool.getConnection;
  const state = { inserted: false, rolledBack: false, released: false };
  pool.getConnection = async () => ({
    async beginTransaction() {},
    async commit() {},
    async rollback() { state.rolledBack = true; },
    release() { state.released = true; },
    async execute(sql) {
      if (sql.includes('FROM users WHERE user_id = ?')) return [[{ user_id: 'admin-user-uuid' }]];
      if (sql.includes('AS balance')) return [[{ balance: '10.00' }]];
      if (sql.startsWith('INSERT INTO funds')) state.inserted = true;
      throw new Error(`Unexpected statement: ${sql}`);
    }
  });
  context.after(() => { pool.getConnection = originalGetConnection; });

  await assert.rejects(createFundTransaction({
    created_by: 'admin-user-uuid',
    admin_name: 'Admin One',
    transaction_type: 'DEBIT',
    transaction_date: '2026-10-20 12:00:00',
    amount: '11.00',
    payment_method: 'Cash',
    description: 'Oversized debit'
  }), { code: 'INSUFFICIENT_FUNDS' });

  assert.equal(state.inserted, false);
  assert.equal(state.rolledBack, true);
  assert.equal(state.released, true);
});

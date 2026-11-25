const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/db');
const { createLoan } = require('../src/modules/loanModule');

function fakeConnection({
  balance = '100.00',
  failOnFundInsert = false,
  replayLoanId = null,
  loanSequences = new Map()
} = {}) {
  const state = {
    committed: false,
    rolledBack: false,
    released: false,
    fundInserts: [],
    loanNumbers: [],
    loanInsertParams: null,
    statements: []
  };
  let ownerUserId;
  const loan = {
    id: replayLoanId || 25,
    loan_number: 'GL-20261020-000025',
    principal_amount: '50.00'
  };
  const connection = {
    async beginTransaction() {},
    async commit() { state.committed = true; },
    async rollback() { state.rolledBack = true; },
    release() { state.released = true; },
    async query(sql) {
      state.statements.push(sql);
      if (sql.includes('CURRENT_TIMESTAMP()')) return [[{ transaction_date: '2026-10-20 10:00:00' }]];
      throw new Error(`Unexpected query: ${sql}`);
    },
    async execute(sql, params = []) {
      state.statements.push(sql);
      if (sql.includes('FROM loan_customers WHERE id = ?')) return [[{ id: 1, full_name: 'Test Customer' }]];
      if (sql.includes('FROM interest_types WHERE type_key = ?')) return [[{ enabled: 1 }]];
      if (sql.includes('FROM users WHERE user_id = ?')) {
        ownerUserId = params[0];
        return [[{ user_id: params[0] }]];
      }
      if (sql.includes('AS balance')) return [[{ balance }]];
      if (sql.includes('FROM funds') && sql.includes('idempotency_key = ?')) {
        return [replayLoanId ? [{ related_reference: String(replayLoanId) }] : []];
      }
      if (sql.includes('MAX(CAST(SUBSTRING_INDEX(loan_number')) {
        return [[{ max_number: loanSequences.get(params[0]) || 0 }]];
      }
      if (sql.startsWith('INSERT INTO loans')) {
        state.loanInsertParams = params;
        return [{ insertId: loan.id }];
      }
      if (sql.startsWith('UPDATE loans SET loan_number')) {
        state.loanNumbers.push(params[0]);
        loanSequences.set(ownerUserId, Number(params[0].slice(-6)));
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('INSERT INTO funds')) {
        if (failOnFundInsert) throw new Error('Simulated fund ledger failure');
        state.fundInserts.push({ sql, params });
        return [{ insertId: state.fundInserts.length }];
      }
      if (sql.includes('FROM loans l JOIN loan_customers c')) return [[loan]];
      throw new Error(`Unexpected statement: ${sql}`);
    }
  };
  return { connection, state };
}

function createConcurrentPool(shared) {
  return {
    async getConnection() {
      const local = { fundEntries: [], loan: null, unlock: null };
      return {
        async beginTransaction() {},
        async commit() {
          shared.balance -= local.fundEntries.reduce((sum, entry) => sum + entry.amount, 0);
          shared.fundEntries.push(...local.fundEntries);
          if (local.loan) {
            shared.loans.set(local.loan.id, local.loan);
            shared.loanSequences.set(local.ownerUserId, Number(local.loan.loan_number.slice(-6)));
          }
          local.unlock?.();
        },
        async rollback() { local.unlock?.(); },
        release() {},
        async query(sql) {
          if (sql.includes('CURRENT_TIMESTAMP()')) return [[{ transaction_date: '2026-10-20 10:00:00' }]];
          throw new Error(`Unexpected query: ${sql}`);
        },
        async execute(sql, params = []) {
          if (sql.includes('FROM loan_customers WHERE id = ?')) return [[{ id: 1, full_name: 'Test Customer' }]];
          if (sql.includes('FROM interest_types WHERE type_key = ?')) return [[{ enabled: 1 }]];
          if (sql.includes('FROM users WHERE user_id = ?')) {
            local.ownerUserId = params[0];
            const previous = shared.adminLock;
            shared.adminLock = new Promise((resolve) => { local.unlock = resolve; });
            await previous;
            return [[{ user_id: params[0] }]];
          }
          if (sql.includes('AS balance')) return [[{ balance: shared.balance.toFixed(2) }]];
          if (sql.includes('FROM funds') && sql.includes('idempotency_key = ?')) {
            const transaction = shared.fundEntries.find((entry) => entry.idempotency_key === params[1]);
            return [transaction ? [{ related_reference: transaction.related_reference }] : []];
          }
          if (sql.includes('MAX(CAST(SUBSTRING_INDEX(loan_number')) {
            return [[{ max_number: shared.loanSequences.get(params[0]) || 0 }]];
          }
          if (sql.startsWith('INSERT INTO loans')) {
            local.loan = { id: ++shared.nextLoanId, loan_number: '', principal_amount: params[0] };
            return [{ insertId: local.loan.id }];
          }
          if (sql.startsWith('UPDATE loans SET loan_number')) {
            local.loan.loan_number = params[0];
            return [{ affectedRows: 1 }];
          }
          if (sql.startsWith('INSERT INTO funds')) {
            local.fundEntries.push({
              amount: Number(params[4]),
              related_reference: params[8],
              idempotency_key: params[9]
            });
            return [{ insertId: local.fundEntries.length }];
          }
          if (sql.includes('FROM loans l JOIN loan_customers c')) {
            const loanId = Number(params[0]);
            return [[local.loan?.id === loanId ? local.loan : shared.loans.get(loanId)].filter(Boolean)];
          }
          throw new Error(`Unexpected statement: ${sql}`);
        }
      };
    }
  };
}

function loanDetails(principalAmount = '50.00') {
  return {
    customer_id: '1',
    interest_type: 'simple',
    loan_date: '2026-10-20',
    principal_amount: principalAmount,
    created_by: 'admin-user-uuid',
    updated_by: 'admin-user-uuid'
  };
}

test('records the loan disbursement as one owner-scoped fund debit', async (context) => {
  const originalGetConnection = pool.getConnection;
  const { connection, state } = fakeConnection();
  pool.getConnection = async () => connection;
  context.after(() => { pool.getConnection = originalGetConnection; });

  await createLoan(loanDetails(), {
    idempotencyKey: 'loan-request-1',
    fundCreatedByUserId: 'admin-user-uuid',
    fundAdminName: 'Admin One'
  });

  assert.equal(state.fundInserts.length, 1);
  assert.match(state.fundInserts[0].sql, /INSERT INTO funds/);
  assert.deepEqual(state.fundInserts[0].params.slice(0, 3), [
    'admin-user-uuid', 'admin-user-uuid', 'DEBIT'
  ]);
  assert.equal(state.fundInserts[0].params[4], '50.00');
  assert.equal(state.fundInserts[0].params[7], 'Admin One');
  assert.equal(state.fundInserts[0].params[9], 'loan-disbursement:loan-request-1');
  assert.equal(state.loanInsertParams[6], 'admin-user-uuid');
  assert.equal(state.loanInsertParams[7], 'admin-user-uuid');
  assert.equal(state.loanNumbers[0], 'GL-20261020-000001');
  assert.equal(state.committed, true);
});

test('numbers loans independently for each admin', async (context) => {
  const originalGetConnection = pool.getConnection;
  const loanSequences = new Map();
  const { connection, state } = fakeConnection({ loanSequences });
  pool.getConnection = async () => connection;
  context.after(() => { pool.getConnection = originalGetConnection; });

  await createLoan(loanDetails(), {
    idempotencyKey: 'loan-sequence-admin-one-1',
    fundCreatedByUserId: 'admin-user-uuid',
    fundAdminName: 'Admin One'
  });
  await createLoan({
    ...loanDetails(),
    created_by: 'other-admin-uuid',
    updated_by: 'other-admin-uuid'
  }, {
    idempotencyKey: 'loan-sequence-admin-two-1',
    fundCreatedByUserId: 'other-admin-uuid',
    fundAdminName: 'Admin Two'
  });
  await createLoan(loanDetails(), {
    idempotencyKey: 'loan-sequence-admin-one-2',
    fundCreatedByUserId: 'admin-user-uuid',
    fundAdminName: 'Admin One'
  });

  assert.deepEqual(state.loanNumbers, [
    'GL-20261020-000001',
    'GL-20261020-000001',
    'GL-20261020-000002'
  ]);
});

test('rolls back a loan when its disbursement exceeds the admin balance', async (context) => {
  const originalGetConnection = pool.getConnection;
  const { connection, state } = fakeConnection({ balance: '49.99' });
  pool.getConnection = async () => connection;
  context.after(() => { pool.getConnection = originalGetConnection; });

  await assert.rejects(createLoan(loanDetails(), {
    idempotencyKey: 'loan-request-2',
    fundCreatedByUserId: 'admin-user-uuid',
    fundAdminName: 'Admin One'
  }), { code: 'INSUFFICIENT_FUNDS', available_balance: '49.99' });

  assert.equal(state.fundInserts.length, 0);
  assert.equal(state.committed, false);
  assert.equal(state.rolledBack, true);
  assert.equal(state.released, true);
});

test('rolls back loan creation if the fund ledger write fails', async (context) => {
  const originalGetConnection = pool.getConnection;
  const { connection, state } = fakeConnection({ failOnFundInsert: true });
  pool.getConnection = async () => connection;
  context.after(() => { pool.getConnection = originalGetConnection; });

  await assert.rejects(createLoan(loanDetails(), {
    idempotencyKey: 'loan-request-3',
    fundCreatedByUserId: 'admin-user-uuid',
    fundAdminName: 'Admin One'
  }), /Simulated fund ledger failure/);

  assert.equal(state.committed, false);
  assert.equal(state.rolledBack, true);
  assert.equal(state.released, true);
});

test('returns the original loan for a repeated disbursement key', async (context) => {
  const originalGetConnection = pool.getConnection;
  const { connection, state } = fakeConnection({ replayLoanId: 25 });
  pool.getConnection = async () => connection;
  context.after(() => { pool.getConnection = originalGetConnection; });

  const result = await createLoan(loanDetails(), {
    idempotencyKey: 'loan-request-4',
    fundCreatedByUserId: 'admin-user-uuid',
    fundAdminName: 'Admin One'
  });

  assert.equal(result.id, 25);
  assert.equal(state.fundInserts.length, 0);
  assert.equal(state.committed, true);
});

test('serializes concurrent loans so they cannot spend the same admin balance', async (context) => {
  const originalGetConnection = pool.getConnection;
  const shared = {
    adminLock: Promise.resolve(),
    balance: 100,
    fundEntries: [],
    loans: new Map(),
    loanSequences: new Map(),
    nextLoanId: 0
  };
  pool.getConnection = createConcurrentPool(shared).getConnection;
  context.after(() => { pool.getConnection = originalGetConnection; });
  const options = {
    fundCreatedByUserId: 'admin-user-uuid',
    fundAdminName: 'Admin One'
  };

  const results = await Promise.allSettled([
    createLoan(loanDetails('60.00'), { ...options, idempotencyKey: 'loan-request-5a' }),
    createLoan(loanDetails('60.00'), { ...options, idempotencyKey: 'loan-request-5b' })
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected' && result.reason.code === 'INSUFFICIENT_FUNDS').length, 1);
  assert.equal(shared.balance, 40);
  assert.equal(shared.loans.size, 1);
  assert.equal(shared.fundEntries.reduce((sum, entry) => sum + entry.amount, 0), 60);
});

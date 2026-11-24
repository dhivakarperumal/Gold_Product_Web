const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/db');
const {
  canAccessLoanGoldImage,
  deleteLoan,
  getLoanById,
  listGoldReleaseEligible,
  listLoans,
  recordLoanReviewAction,
  releaseGold,
  renewLoan,
  updateLoan
} = require('../src/modules/loanModule');

test('filters loan lists and release queues by the creating admin', async (context) => {
  const originalExecute = pool.execute;
  const statements = [];
  pool.execute = async (sql, values) => {
    statements.push({ sql, values });
    return [[]];
  };
  context.after(() => { pool.execute = originalExecute; });

  await listLoans({}, 'admin-user-uuid');
  await listGoldReleaseEligible('admin-user-uuid');

  assert.equal(statements.length, 2);
  for (const statement of statements) {
    assert.match(statement.sql, /c\.created_by = \?/);
    assert.deepEqual(statement.values, ['admin-user-uuid']);
  }
});

test('leaves loan visibility unrestricted when no admin owner is requested', async (context) => {
  const originalExecute = pool.execute;
  let statement;
  pool.execute = async (sql, values) => {
    statement = { sql, values };
    return [[]];
  };
  context.after(() => { pool.execute = originalExecute; });

  await listLoans({});

  assert.doesNotMatch(statement.sql, /c\.created_by = \?/);
  assert.deepEqual(statement.values, []);
});

test('scopes direct loan and gold-image lookups to the requesting admin', async (context) => {
  const originalExecute = pool.execute;
  const statements = [];
  pool.execute = async (sql, values) => {
    statements.push({ sql, values });
    return [[]];
  };
  context.after(() => { pool.execute = originalExecute; });

  assert.equal(await getLoanById(42, 'admin-user-uuid'), null);
  assert.equal(
    await canAccessLoanGoldImage('/api/loans/gold-images/example.jpg', 'admin-user-uuid'),
    false
  );

  assert.equal(statements.length, 2);
  for (const statement of statements) {
    assert.match(statement.sql, /c\.created_by = \?/);
    assert.equal(statement.values[statement.values.length - 1], 'admin-user-uuid');
  }
});

test('rejects loan mutations for loans owned by another admin', async (context) => {
  const originalGetConnection = pool.getConnection;
  const lockStatements = [];
  pool.getConnection = async () => ({
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql, values) {
      lockStatements.push({ sql, values });
      return [[]];
    }
  });
  context.after(() => { pool.getConnection = originalGetConnection; });

  const ownerUserId = 'admin-user-uuid';
  const attempts = [
    () => renewLoan(42, 100, 7, { created_by_user_id: ownerUserId }, ownerUserId),
    () => recordLoanReviewAction(42, 'notice_sent', {}, 7, ownerUserId),
    () => releaseGold(42, 'Recipient', '', '/release.pdf', 7, ownerUserId)
  ];

  for (const attempt of attempts) {
    await assert.rejects(attempt(), { code: 'LOAN_NOT_FOUND' });
  }

  assert.equal(lockStatements.length, 3);
  for (const statement of lockStatements) {
    assert.match(statement.sql, /c\.created_by = \?/);
    assert.deepEqual(statement.values, [42, ownerUserId]);
  }
});

test('applies owner scope atomically to loan updates and deletes', async (context) => {
  const originalExecute = pool.execute;
  const statements = [];
  let loanReads = 0;
  pool.execute = async (sql, values) => {
    statements.push({ sql, values });
    if (sql.startsWith('SELECT l.*')) {
      loanReads += 1;
      return [[{ id: 42, principal_amount: '50.00', outstanding_principal: '50.00' }]];
    }
    if (sql.startsWith('UPDATE loans l')) return [{ affectedRows: 1 }];
    if (sql.startsWith('DELETE l FROM loans')) return [{ affectedRows: 1 }];
    throw new Error(`Unexpected statement: ${sql}`);
  };
  context.after(() => { pool.execute = originalExecute; });

  const ownerUserId = 'admin-user-uuid';
  await updateLoan(42, {
    principal_amount: '60.00',
    updated_by: ownerUserId
  }, ownerUserId);
  assert.equal(await deleteLoan(42, ownerUserId), true);

  const updateStatement = statements.find((statement) => statement.sql.startsWith('UPDATE loans l'));
  const deleteStatement = statements.find((statement) => statement.sql.startsWith('DELETE l FROM loans'));
  assert.match(updateStatement.sql, /c\.created_by = \?/);
  assert.match(updateStatement.sql, /l\.`updated_by` = \?/);
  assert.ok(updateStatement.values.includes(ownerUserId));
  assert.equal(updateStatement.values.at(-1), ownerUserId);
  assert.match(deleteStatement.sql, /c\.created_by = \?/);
  assert.deepEqual(deleteStatement.values, [42, ownerUserId]);
  assert.equal(loanReads, 2);
});

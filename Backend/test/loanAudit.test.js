const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/db');
const { initializeLoanModule } = require('../src/modules/loanModule');

test('migrates numeric loan audit IDs to admin UUID columns', async (context) => {
  const originalExecute = pool.execute;
  const originalQuery = pool.query;
  const statements = [];
  const executions = [];
  const existingLoanColumns = [
    'id', 'loan_number', 'customer_id', 'gold_pledge_number', 'jewellery_type',
    'metal_type', 'gold_purity', 'gross_weight', 'stone_weight', 'net_gold_weight',
    'gold_valuation', 'gold_rate_per_gram', 'rate_unit', 'gold_rate_date',
    'principal_amount', 'outstanding_principal', 'interest_type', 'interest_rate',
    'fixed_interest_amount', 'interest_frequency', 'custom_period_days',
    'interest_calculation_start_date', 'compounding_frequency', 'day_count_convention',
    'grace_period_days', 'late_payment_interest_rate', 'interest_free_days',
    'minimum_interest_amount', 'maximum_interest_amount', 'processing_fee',
    'other_charges', 'loan_date', 'maturity_date', 'payment_frequency',
    'loan_status', 'release_status', 'gold_released_at', 'gold_released_to',
    'notes', 'gold_image_url', 'created_by', 'created_at', 'updated_at'
  ].map((Field) => ({
    Field,
    Type: Field === 'created_by' ? 'bigint unsigned' : 'varchar(255)'
  }));
  const renewalColumns = [
    'late_payment_fee', 'payment_method', 'reference_number', 'idempotency_key'
  ].map((Field) => ({ Field }));
  pool.query = async (sql) => {
    statements.push(sql);
    if (sql.includes('SHOW COLUMNS FROM loans')) return [existingLoanColumns];
    if (sql.includes('SHOW COLUMNS FROM loan_renewals')) return [renewalColumns];
    if (sql.includes('SHOW COLUMNS FROM loan_gold_releases')) {
      return [[{ Field: 'signed_document_url' }]];
    }
    if (sql.includes('SHOW INDEX FROM loans')) return [[{ Key_name: 'uq_loans_gold_pledge_number' }]];
    return [[]];
  };
  pool.execute = async (sql, values) => {
    statements.push(sql);
    if (sql.includes('information_schema.STATISTICS')) {
      return [[{
        INDEX_NAME: 'loan_number',
        COLUMN_NAME: 'loan_number',
        SEQ_IN_INDEX: 1,
        NON_UNIQUE: 0
      }]];
    }
    if (sql.startsWith('SELECT id, created_by, DATE_FORMAT(loan_date')) {
      return [[
        { id: 1, created_by: 'admin-one', loan_date_key: '20260101', loan_number: 'GL-20260101-000003' },
        { id: 2, created_by: 'admin-one', loan_date_key: '20260102', loan_number: 'GL-20260102-000004' },
        { id: 3, created_by: 'admin-two', loan_date_key: '20260103', loan_number: 'GL-20260103-000005' }
      ]];
    }
    executions.push({ sql, values });
    return [{ affectedRows: 1 }];
  };
  context.after(() => {
    pool.execute = originalExecute;
    pool.query = originalQuery;
  });

  await initializeLoanModule();

  const createLoansSql = statements.find((sql) => sql.includes('CREATE TABLE IF NOT EXISTS loans'));
  assert.match(createLoansSql, /created_by VARCHAR\(255\).*NULL/);
  assert.match(createLoansSql, /updated_by VARCHAR\(255\).*NULL/);
  assert.ok(statements.some((sql) => /CHANGE COLUMN `created_by` `created_by_legacy_id`/.test(sql)));
  assert.ok(statements.some((sql) => /ADD COLUMN `created_by` VARCHAR\(255\)/.test(sql)));
  assert.ok(statements.some((sql) => /ADD COLUMN `updated_by` VARCHAR\(255\)/.test(sql)));
  assert.ok(statements.some((sql) => /JOIN users u ON u\.id = l\.`created_by_legacy_id`/.test(sql)));
  assert.ok(statements.some((sql) => /UPDATE loans SET updated_by = created_by/.test(sql)));
  assert.ok(statements.some((sql) => /DROP INDEX `loan_number`/.test(sql)));
  assert.ok(statements.some((sql) => /ADD UNIQUE KEY uq_loans_creator_number \(created_by, loan_number\)/.test(sql)));
  assert.deepEqual(
    executions.filter(({ sql }) => sql.startsWith('UPDATE loans SET loan_number')).map(({ values }) => values),
    [
      ['GL-20260101-000001', 1],
      ['GL-20260102-000002', 2],
      ['GL-20260103-000001', 3]
    ]
  );
  assert.equal(executions.filter(({ sql }) => sql.startsWith('UPDATE funds SET related_reference')).length, 3);
});

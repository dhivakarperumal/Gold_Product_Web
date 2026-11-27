const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/db');
const { getDealerSummary, listPurchases } = require('../src/modules/dealerModule');

const expectedOverdueCondition = /COALESCE\(p\.due_date,\s*DATE_ADD\(p\.document_date,\s*INTERVAL d\.payment_terms_days DAY\)\)\s*<\s*CURDATE\(\)/;

test('dealer summary counts unpaid invoices using dealer terms when due date is missing', async (context) => {
  const originalQuery = pool.query;
  const queries = [];
  pool.query = async (query) => {
    queries.push(query);
    if (query.includes('FROM dealers')) return [[{ total: 1, active: 1 }], []];
    if (query.includes('FROM dealer_financial_ledger')) return [[{ payables: 0, receivables: 0 }], []];
    if (query.includes('FROM dealer_purchases p')) return [[{ count: 2, amount: 1250 }], []];
    if (query.includes('FROM dealer_jobs')) return [[{ count: 0 }], []];
    if (query.includes('FROM dealer_purchases WHERE')) return [[{ total: 0 }], []];
    if (query.includes('FROM dealer_metal_ledger')) return [[], []];
    throw new Error(`Unexpected dealer summary query: ${query}`);
  };
  context.after(() => {
    pool.query = originalQuery;
  });

  const summary = await getDealerSummary();
  const overdueQuery = queries.find((query) => query.includes('FROM dealer_purchases p'));

  assert.match(overdueQuery, expectedOverdueCondition);
  assert.deepEqual(summary.overdue, { count: 2, amount: 1250 });
});

test('overdue purchase list applies the same payment-term fallback as the summary', async (context) => {
  const originalExecute = pool.execute;
  const queries = [];
  pool.execute = async (query) => {
    queries.push(query);
    return query.includes('COUNT(*) AS total')
      ? [[{ total: 1 }], []]
      : [[{
        id: 1,
        dealer_id: 1,
        total: 1500,
        paid_amount: 250,
        outstanding: 1250
      }], []];
  };
  context.after(() => {
    pool.execute = originalExecute;
  });

  const result = await listPurchases({ page: 1, limit: 25, search: '', overdue: true });

  assert.equal(queries.length, 2);
  assert.ok(queries.every((query) => expectedOverdueCondition.test(query)));
  assert.equal(result.purchases[0].outstanding, 1250);
});

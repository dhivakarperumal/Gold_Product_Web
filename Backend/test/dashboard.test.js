const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/db');
const { getDashboardData } = require('../src/modules/dashboardModule');

const adminUser = { id: 47, user_id: 'shop-owner-1' };
const customDateRange = { startDate: '2026-11-01', endDate: '2026-11-30' };

function dashboardQueryResult(query) {
  if (query.includes('AS total_loans')) return [[{ total_loans: 2 }], []];
  if (query.includes('AS total_customers')) return [[{ total_customers: 1 }], []];
  if (query.includes('AS total_gold_stock_value')) return [[{ total_gold_stock_value: 1250 }], []];
  if (query.includes('AS total_products')) {
    return [[{ total_products: 3, low_stock_products: 1 }], []];
  }
  if (query.includes('AS total_categories')) return [[{ total_categories: 2 }], []];
  return [[], []];
}

async function captureDashboardQueries(range, dateRange) {
  const originalExecute = pool.execute;
  const queries = [];
  pool.execute = async (query, values) => {
    queries.push({ sql: String(query).replace(/\s+/g, ' ').trim(), values });
    return dashboardQueryResult(String(query));
  };
  try {
    const data = await getDashboardData(range, dateRange, adminUser);
    return { data, queries };
  } finally {
    pool.execute = originalExecute;
  }
}

test('scopes every admin report dataset to its authenticated shop and date range', async () => {
  const { data, queries } = await captureDashboardQueries('month', customDateRange);
  const expectedLoanValues = [adminUser.user_id, customDateRange.startDate, customDateRange.endDate];
  const expectedShopValues = [adminUser.user_id, customDateRange.startDate, customDateRange.endDate];
  const findQuery = (fragment) => queries.find(({ sql }) => sql.includes(fragment));

  for (const fragment of ['AS total_loans', 'SELECT l.loan_status', 'l.loan_number', 'AS total_customers']) {
    const query = findQuery(fragment);
    assert.ok(query, `Expected dashboard query containing ${fragment}`);
    assert.match(query.sql, /l\.created_by = \?/);
    assert.deepEqual(query.values, expectedLoanValues);
  }

  for (const fragment of ['AS total_products', 'p.product_code', 'AS total_categories']) {
    const query = findQuery(fragment);
    assert.ok(query, `Expected dashboard query containing ${fragment}`);
    assert.match(query.sql, fragment === 'AS total_categories' ? /c\.user_id = \?/ : /p\.created_by = \?/);
    assert.deepEqual(query.values, expectedShopValues);
  }

  const stockValueQuery = findQuery('AS total_gold_stock_value');
  assert.match(stockValueQuery.sql, /p\.created_by = \?/);
  assert.deepEqual(stockValueQuery.values, [adminUser.user_id]);

  const goldRateQuery = findQuery('FROM gold_rates r');
  assert.match(goldRateQuery.sql, /r\.user_id = \?/);
  assert.deepEqual(goldRateQuery.values, [adminUser.user_id]);

  const revenueQuery = findQuery('SUM(b.total_amount)');
  assert.match(revenueQuery.sql, /b\.user_id = \?/);
  assert.deepEqual(revenueQuery.values, expectedShopValues);
  assert.equal(data.totalLoansCount, 2);
  assert.equal(data.stats.find(({ id }) => id === 'total_customers').value, '1');
});

test('scopes preset revenue trends to the authenticated shop', async () => {
  const { queries } = await captureDashboardQueries('month', null);
  const revenueQuery = queries.find(({ sql }) => sql.includes('SUM(b.total_amount)'));
  assert.ok(revenueQuery);
  assert.match(revenueQuery.sql, /b\.user_id = \?/);
  assert.deepEqual(revenueQuery.values, [adminUser.user_id]);
});

test('requires an authenticated shop identity before loading report data', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      getDashboardData('month', null),
      /authenticated admin user is required/i
    );
  } finally {
    console.error = originalError;
  }
});

const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/db');
const {
  buildMonthBuckets,
  getDashboardStats,
  percentageChange
} = require('../src/modules/superAdminDashboardModule');

test('builds a rolling twelve-month dashboard series across year boundaries', () => {
  const months = buildMonthBuckets('2026-02');

  assert.equal(months.length, 12);
  assert.equal(months[0].key, '2025-03');
  assert.equal(months[11].key, '2026-02');
});

test('calculates monthly percentage changes without dividing by zero', () => {
  assert.equal(percentageChange(15, 10), 50);
  assert.equal(percentageChange(0, 0), 0);
  assert.equal(percentageChange(4, 0), 100);
});

test('rejects invalid current-month values from the database', () => {
  assert.throws(() => buildMonthBuckets('2026-13'), /invalid current month/);
});

test('qualifies subscription creation dates in the joined stats query', async () => {
  const originalExecute = pool.execute;
  const queries = [];
  pool.execute = async (sql) => {
    queries.push(sql);
    if (sql.includes('FROM subscriptions s')) {
      return [[{
        active_subscriptions: 2,
        expired_subscriptions: 1,
        current_month_subscriptions: 1,
        previous_month_subscriptions: 0
      }], []];
    }
    return [[{}], []];
  };

  try {
    const stats = await getDashboardStats();
    const subscriptionQuery = queries.find((sql) => sql.includes('FROM subscriptions s'));

    assert.match(subscriptionQuery, /s\.created_at >=/);
    assert.match(subscriptionQuery, /s\.created_at </);
    assert.equal(subscriptionQuery.replaceAll('s.created_at', '').match(/\bcreated_at\s*[<>]/), null);
    assert.equal(stats.activeSubscriptions, 2);
  } finally {
    pool.execute = originalExecute;
  }
});

const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/db');
const { listCategories } = require('../src/modules/categoryModule');

test('managed categories include product counts scoped to their owner', async (context) => {
  const originalQuery = pool.query;
  let executedQuery = '';
  let queryParams = [];

  pool.query = async (query, params) => {
    executedQuery = query;
    queryParams = params;
    return [[{
      catId: 'CAT001',
      name: 'Necklace',
      subcategory: '[]',
      images: '[]',
      totalProducts: 3
    }]];
  };
  context.after(() => {
    pool.query = originalQuery;
  });

  const categories = await listCategories({
    includeAudit: true,
    userId: 'owner-user-id'
  });

  assert.match(executedQuery, /SELECT COUNT\(\*\) FROM products p/);
  assert.match(executedQuery, /p\.category = c\.name AND p\.created_by = c\.user_id/);
  assert.deepEqual(queryParams, ['owner-user-id']);
  assert.equal(categories[0].totalProducts, 3);
});

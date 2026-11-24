const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../src/config/db');
const {
  createEnquiry,
  deleteEnquiry,
  initializeEnquiryModule,
  listEnquiries,
  updateEnquiry,
  updateEnquiryStatus
} = require('../src/modules/enquiryModule');

test('adds creator audit columns to existing enquiry tables', async (context) => {
  const originalQuery = pool.query;
  const statements = [];
  pool.query = async (sql) => {
    statements.push(sql);
    if (sql === 'SHOW COLUMNS FROM enquiries') {
      return [[{ Field: 'assigned_to' }, { Field: 'source' }]];
    }
    if (sql.startsWith('SHOW INDEX FROM enquiries')) return [[]];
    return [[], []];
  };
  context.after(() => { pool.query = originalQuery; });

  await initializeEnquiryModule();

  assert.ok(statements.some((sql) => /created_by VARCHAR\(255\).*NULL/.test(sql)));
  assert.ok(statements.some((sql) => /updated_by VARCHAR\(255\).*NULL/.test(sql)));
  assert.ok(statements.some((sql) => sql.includes('CREATE INDEX idx_enquiries_created_by_created')));
});

test('scopes enquiry rows, totals, and summary stats to the creating admin', async (context) => {
  const originalExecute = pool.execute;
  const queries = [];
  pool.execute = async (sql, values) => {
    queries.push({ sql, values });
    if (sql.includes('COUNT(*) AS total')) {
      return [[{ total: 1, pending: 1, responded: 0, closed: 0 }], []];
    }
    return [[{
      id: 7,
      product_id: null,
      whatsapp_confirmation: 0,
      created_by: 'admin-a',
      updated_by: 'admin-a',
      created_by_name: 'Admin A',
      updated_by_name: 'Admin A'
    }], []];
  };
  context.after(() => { pool.execute = originalExecute; });

  const result = await listEnquiries({
    search: '',
    status: '',
    product: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 8,
    ownerUserId: 'admin-a'
  });

  assert.equal(queries.length, 3);
  for (const query of queries) {
    assert.match(query.sql, /created_by = \?/);
    assert.equal(query.values[0], 'admin-a');
  }
  assert.equal(result.pagination.total, 1);
  assert.equal(result.enquiries[0].created_by_name, 'Admin A');
  assert.equal(result.enquiries[0].updated_by_name, 'Admin A');
});

test('records the creator and restricts enquiry edits and deletion to that admin', async (context) => {
  const originalExecute = pool.execute;
  const queries = [];
  pool.execute = async (sql, values) => {
    queries.push({ sql, values });
    if (sql.startsWith('INSERT INTO enquiries')) return [{ insertId: 7 }, []];
    if (sql.startsWith('SELECT e.*')) {
      return [[{ id: 7, created_by: 'admin-a', updated_by: 'admin-a' }], []];
    }
    return [{ affectedRows: 1 }, []];
  };
  context.after(() => { pool.execute = originalExecute; });

  const enquiry = await createEnquiry({}, 'admin-a');
  assert.equal(enquiry.created_by, 'admin-a');
  assert.equal(enquiry.updated_by, 'admin-a');
  assert.deepEqual(queries[0].values.slice(-2), ['admin-a', 'admin-a']);
  assert.match(queries[1].sql, /WHERE e\.id = \? AND e\.created_by = \?/);
  assert.deepEqual(queries[1].values, [7, 'admin-a']);

  await updateEnquiryStatus(7, 'In Progress', 'admin-a', 'admin-a');
  assert.match(queries[2].sql, /SET status = \?, updated_by = \? WHERE id = \? AND created_by = \?/);
  assert.deepEqual(queries[2].values, ['In Progress', 'admin-a', 7, 'admin-a']);

  await updateEnquiry(7, { customer_name: 'Updated customer' }, 'admin-a', 'admin-a');
  const updateQuery = queries[3];
  assert.match(updateQuery.sql, /updated_by = \? WHERE id = \? AND created_by = \?/);
  assert.deepEqual(updateQuery.values.slice(-3), ['admin-a', 7, 'admin-a']);

  await deleteEnquiry(7, 'admin-a');
  assert.match(queries[4].sql, /DELETE FROM enquiries WHERE id = \? AND created_by = \?/);
  assert.deepEqual(queries[4].values, [7, 'admin-a']);
});

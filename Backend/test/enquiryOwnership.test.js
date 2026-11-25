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
  const originalExecute = pool.execute;
  const statements = [];
  const executions = [];
  pool.query = async (sql) => {
    statements.push(sql);
    if (sql === 'SHOW COLUMNS FROM enquiries') {
      return [[{ Field: 'assigned_to' }, { Field: 'source' }, { Field: 'created_at' }]];
    }
    if (sql.startsWith('SHOW INDEX FROM enquiries')) return [[]];
    return [[], []];
  };
  pool.execute = async (sql, values) => {
    executions.push({ sql, values });
    if (sql.includes('information_schema.STATISTICS')) return [[], []];
    if (sql.startsWith('SELECT id, created_by FROM enquiries')) {
      return [[
        { id: 1, created_by: 'admin-a' },
        { id: 2, created_by: 'admin-b' },
        { id: 3, created_by: 'admin-a' }
      ], []];
    }
    return [{ affectedRows: 1 }, []];
  };
  context.after(() => {
    pool.query = originalQuery;
    pool.execute = originalExecute;
  });

  await initializeEnquiryModule();

  assert.ok(statements.some((sql) => /ADD COLUMN enquiry_code VARCHAR\(30\) NULL/.test(sql)));
  assert.ok(statements.some((sql) => /created_by VARCHAR\(255\).*NULL/.test(sql)));
  assert.ok(statements.some((sql) => /updated_by VARCHAR\(255\).*NULL/.test(sql)));
  assert.ok(statements.some((sql) => /ADD UNIQUE KEY uq_enquiries_creator_code \(created_by, enquiry_code\)/.test(sql)));
  assert.ok(statements.some((sql) => sql.includes('CREATE INDEX idx_enquiries_created_by_created')));
  assert.deepEqual(
    executions.filter(({ sql }) => sql.startsWith('UPDATE enquiries SET enquiry_code')).map(({ values }) => values),
    [
      ['ENQ-000001', 1],
      ['ENQ-000001', 2],
      ['ENQ-000002', 3]
    ]
  );
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
    search: 'ENQ-000001',
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
  assert.match(queries[0].sql, /e\.enquiry_code LIKE \?/);
  assert.ok(queries[0].values.includes('%ENQ-000001%'));
});

test('records the creator and restricts enquiry edits and deletion to that admin', async (context) => {
  const originalGetConnection = pool.getConnection;
  const originalExecute = pool.execute;
  const queries = [];
  let insertedValues;
  pool.getConnection = async () => ({
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql, values) {
      queries.push({ sql, values });
      if (sql.includes('SELECT user_id FROM users')) return [[{ user_id: values[0] }], []];
      if (sql.includes('SELECT COALESCE(MAX(')) return [[{ max_code: 0 }], []];
      if (sql.startsWith('INSERT INTO enquiries')) {
        insertedValues = values;
        return [{ insertId: 7 }, []];
      }
      return [{ affectedRows: 1 }, []];
    }
  });
  pool.execute = async (sql, values) => {
    queries.push({ sql, values });
    if (sql.startsWith('SELECT e.*')) {
      return [[{
        id: 7,
        enquiry_code: 'ENQ-000001',
        created_by: 'admin-a',
        updated_by: 'admin-a'
      }], []];
    }
    return [{ affectedRows: 1 }, []];
  };
  context.after(() => {
    pool.getConnection = originalGetConnection;
    pool.execute = originalExecute;
  });

  const enquiry = await createEnquiry({}, 'admin-a');
  assert.equal(enquiry.enquiry_code, 'ENQ-000001');
  assert.equal(enquiry.created_by, 'admin-a');
  assert.equal(enquiry.updated_by, 'admin-a');
  assert.equal(insertedValues[0], 'ENQ-000001');
  assert.deepEqual(insertedValues.slice(-2), ['admin-a', 'admin-a']);
  assert.match(queries[3].sql, /WHERE e\.id = \? AND e\.created_by = \?/);
  assert.deepEqual(queries[3].values, [7, 'admin-a']);

  await updateEnquiryStatus(7, 'In Progress', 'admin-a', 'admin-a');
  assert.match(queries[4].sql, /SET status = \?, updated_by = \? WHERE id = \? AND created_by = \?/);
  assert.deepEqual(queries[4].values, ['In Progress', 'admin-a', 7, 'admin-a']);

  await updateEnquiry(7, { customer_name: 'Updated customer' }, 'admin-a', 'admin-a');
  const updateQuery = queries[5];
  assert.match(updateQuery.sql, /updated_by = \? WHERE id = \? AND created_by = \?/);
  assert.deepEqual(updateQuery.values.slice(-3), ['admin-a', 7, 'admin-a']);

  await deleteEnquiry(7, 'admin-a');
  assert.match(queries[6].sql, /DELETE FROM enquiries WHERE id = \? AND created_by = \?/);
  assert.deepEqual(queries[6].values, [7, 'admin-a']);
});

test('numbers enquiry codes independently by admin and safely for public enquiries', async (context) => {
  const originalGetConnection = pool.getConnection;
  const originalExecute = pool.execute;
  const nextCodeByCreator = new Map();
  const enquiriesById = new Map();
  let nextId = 1;

  pool.getConnection = async () => {
    let creatorUserId = null;
    return {
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
      release() {},
      async query(sql) {
        if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }], []];
        if (sql.includes('RELEASE_LOCK')) return [[{ released: 1 }], []];
        throw new Error(`Unexpected query: ${sql}`);
      },
      async execute(sql, values) {
        if (sql.includes('SELECT user_id FROM users')) {
          creatorUserId = values[0];
          return [[{ user_id: creatorUserId }], []];
        }
        if (sql.includes('SELECT COALESCE(MAX(')) {
          return [[{ max_code: nextCodeByCreator.get(creatorUserId) || 0 }], []];
        }
        if (sql.startsWith('INSERT INTO enquiries')) {
          const enquiryCode = values[0];
          const id = nextId++;
          enquiriesById.set(id, {
            id,
            enquiry_code: enquiryCode,
            created_by: creatorUserId,
            updated_by: creatorUserId
          });
          nextCodeByCreator.set(creatorUserId, Number(enquiryCode.slice(4)));
          return [{ insertId: id }, []];
        }
        throw new Error(`Unexpected statement: ${sql}`);
      }
    };
  };
  pool.execute = async (sql, values) => {
    if (sql.startsWith('SELECT e.*')) return [[enquiriesById.get(Number(values[0]))], []];
    throw new Error(`Unexpected statement: ${sql}`);
  };
  context.after(() => {
    pool.getConnection = originalGetConnection;
    pool.execute = originalExecute;
  });

  const codes = [];
  codes.push((await createEnquiry({}, 'admin-a')).enquiry_code);
  codes.push((await createEnquiry({}, 'admin-b')).enquiry_code);
  codes.push((await createEnquiry({}, 'admin-a')).enquiry_code);
  codes.push((await createEnquiry({})).enquiry_code);
  codes.push((await createEnquiry({})).enquiry_code);

  assert.deepEqual(codes, [
    'ENQ-000001',
    'ENQ-000001',
    'ENQ-000002',
    'ENQ-000001',
    'ENQ-000002'
  ]);
});

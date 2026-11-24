const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const { insertUser } = require('../src/modules/authModule');
const {
  createLoanCustomer,
  deleteLoanCustomer,
  getLoanCustomerById,
  listLoanCustomers,
  updateLoanCustomer
} = require('../src/modules/loanCustomerModule');
const {
  duplicateCustomerAccountMessage,
  normalizeCustomer,
  normalizeCustomerUsername
} = require('../src/controllers/loanCustomerController');

test('describes duplicate customer account fields clearly', () => {
  assert.equal(
    duplicateCustomerAccountMessage(new Error("Duplicate entry '9876543210' for key 'users.phone'")),
    'This mobile number is already registered. Use a different mobile number.'
  );
  assert.equal(
    duplicateCustomerAccountMessage(new Error("Duplicate entry 'customer@example.com' for key 'users.email'")),
    'This email address is already registered. Use a different email address.'
  );
  assert.equal(
    duplicateCustomerAccountMessage(new Error('Duplicate account')),
    'This customer account name, email, or mobile number is already registered.'
  );
});

test('stores the creating admin UUID in both customer audit fields', async () => {
  const originalGetConnection = pool.getConnection;
  const originalExecute = pool.execute;
  const adminUserId = '2c9f163f-e700-11f1-8318-51021565bd83';
  let insertedCustomerValues;
  let assignedCustomerCode;

  pool.getConnection = async () => ({
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql, values) {
      if (sql.includes('SELECT id FROM users')) return [[], []];
      if (sql.startsWith('INSERT INTO users')) return [{ insertId: 14 }, []];
      if (sql.startsWith('INSERT INTO loan_customers')) {
        insertedCustomerValues = values;
        return [{ insertId: 25 }, []];
      }
      if (sql.startsWith('UPDATE loan_customers SET customer_code')) {
        assignedCustomerCode = values[0];
      }
      return [{ affectedRows: 1 }, []];
    }
  });
  pool.execute = async () => [[{ id: 25, created_by: adminUserId, updated_by: adminUserId }], []];

  try {
    const customer = await createLoanCustomer(
      { full_name: 'Gold Customer', mobile: '9876543210' },
      'Gold Customer',
      'customer-pass-123',
      adminUserId
    );
    assert.equal(insertedCustomerValues[1], adminUserId);
    assert.equal(insertedCustomerValues[2], adminUserId);
    assert.equal(customer.created_by, adminUserId);
    assert.equal(customer.updated_by, adminUserId);
    assert.equal(assignedCustomerCode, 'CUS-000001');
  } finally {
    pool.getConnection = originalGetConnection;
    pool.execute = originalExecute;
  }
});

test('numbers customer codes independently for each admin', async () => {
  const originalGetConnection = pool.getConnection;
  const originalExecute = pool.execute;
  const nextCodeByAdmin = new Map();
  const assignedCodes = [];
  let nextCustomerId = 1;

  pool.getConnection = async () => {
    let ownerUserId;
    return {
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
      release() {},
      async execute(sql, values) {
        if (sql.includes('SELECT user_id FROM users WHERE user_id')) {
          ownerUserId = values[0];
          return [[], []];
        }
        if (sql.includes('SELECT id FROM users')) return [[], []];
        if (sql.startsWith('INSERT INTO users')) return [{ insertId: 100 }, []];
        if (sql.includes('SELECT COALESCE(MAX(')) {
          return [[{ max_code: nextCodeByAdmin.get(values[0]) || 0 }], []];
        }
        if (sql.startsWith('INSERT INTO loan_customers')) {
          return [{ insertId: nextCustomerId++ }, []];
        }
        if (sql.startsWith('UPDATE loan_customers SET customer_code')) {
          const code = values[0];
          assignedCodes.push({ ownerUserId, code });
          nextCodeByAdmin.set(ownerUserId, Number(code.slice(4)));
        }
        return [{ affectedRows: 1 }, []];
      }
    };
  };
  pool.execute = async () => [[{}], []];

  try {
    const customer = { full_name: 'Gold Customer', mobile: '9876543210' };
    await createLoanCustomer(customer, 'Customer One', 'customer-pass-123', 'admin-one');
    await createLoanCustomer(customer, 'Customer Two', 'customer-pass-123', 'admin-two');
    await createLoanCustomer(customer, 'Customer Three', 'customer-pass-123', 'admin-one');

    assert.deepEqual(assignedCodes, [
      { ownerUserId: 'admin-one', code: 'CUS-000001' },
      { ownerUserId: 'admin-two', code: 'CUS-000001' },
      { ownerUserId: 'admin-one', code: 'CUS-000002' }
    ]);
  } finally {
    pool.getConnection = originalGetConnection;
    pool.execute = originalExecute;
  }
});

test('scopes loan customer reads and mutations to the creating admin', async () => {
  const originalExecute = pool.execute;
  const adminUserId = '2c9f163f-e700-11f1-8318-51021565bd83';
  const calls = [];
  pool.execute = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('SELECT')) return [[], []];
    return [{ affectedRows: 1 }, []];
  };

  try {
    await listLoanCustomers('', {}, adminUserId);
    assert.match(calls[0].sql, /created_by = \?/);
    assert.equal(calls[0].values[calls[0].values.length - 1], adminUserId);

    await getLoanCustomerById(25, adminUserId);
    assert.match(calls[1].sql, /WHERE id = \? AND created_by = \?/);
    assert.deepEqual(calls[1].values, [25, adminUserId]);

    await updateLoanCustomer(25, { full_name: 'Updated Customer' }, adminUserId, adminUserId);
    assert.match(calls[2].sql, /updated_by = \?[\s\S]*WHERE id = \? AND created_by = \?/);
    assert.deepEqual(calls[2].values, ['Updated Customer', adminUserId, 25, adminUserId]);

    await deleteLoanCustomer(25, adminUserId);
    assert.match(calls[4].sql, /DELETE FROM loan_customers WHERE id = \? AND created_by = \?/);
    assert.deepEqual(calls[4].values, [25, adminUserId]);
  } finally {
    pool.execute = originalExecute;
  }
});

test('allows customer email and guarantor address to be omitted', () => {
  const { customer, error } = normalizeCustomer({
    full_name: 'Gold Customer',
    mobile: '9876543210',
    gender: 'Female',
    address: 'Customer address',
    city: 'Chennai',
    district: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600001',
    guarantor_name: 'Guarantor Name',
    guarantor_mobile: '9876543211',
    guarantor_relationship: 'Parent',
    photo_url: '/api/loan-customers/photos/27d248e2-50a3-4f3b-aba8-6735bafb40a3.jpg'
  });

  assert.equal(error, undefined);
  assert.equal(customer.email, null);
  assert.equal(customer.guarantor_address, null);
});

test('requires a customer photo', () => {
  const { error } = normalizeCustomer({
    full_name: 'Gold Customer',
    mobile: '9876543210'
  });

  assert.equal(error, 'Customer photo is required');
});

test('requires a non-empty customer account username', () => {
  assert.deepEqual(normalizeCustomerUsername('  '), { error: 'Username is required' });
  assert.deepEqual(normalizeCustomerUsername(null), { error: 'Username is required' });
});

test('trims customer account usernames and enforces the full-name limit', () => {
  assert.deepEqual(normalizeCustomerUsername('  gold.customer  '), { username: 'gold.customer' });
  assert.deepEqual(normalizeCustomerUsername('u'.repeat(151)), {
    error: 'Username must be 150 characters or fewer'
  });
});

test('uses the customer full name as the login username', () => {
  assert.deepEqual(normalizeCustomerUsername('  Full Name  '), { username: 'Full Name' });
});

test('creates an active customer user with a bcrypt-hashed password', async () => {
  let insertedValues;
  const connection = {
    async execute(_query, values) {
      insertedValues = values;
      return [{ insertId: 14 }];
    }
  };

  const userId = await insertUser(connection, {
    username: 'gold.customer',
    name: 'Gold Customer',
    email: 'customer@example.com',
    phone: '9876543210',
    password: 'customer-pass-123',
    status: 'Active',
    role: 'user'
  });

  assert.equal(userId, 14);
  assert.match(insertedValues[0], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(insertedValues[1], 'gold.customer');
  assert.equal(insertedValues[2], 'Gold Customer');
  assert.equal(insertedValues[3], 'customer@example.com');
  assert.equal(insertedValues[4], '9876543210');
  assert.equal(await bcrypt.compare('customer-pass-123', insertedValues[5]), true);
  assert.equal(insertedValues[6], 'user');
  assert.equal(insertedValues[7], 'active');
});

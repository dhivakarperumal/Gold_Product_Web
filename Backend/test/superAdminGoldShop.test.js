const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const {
  calculateEndDate,
  calculateTrialEndDate,
  createGoldShop,
  expireSubscriptions,
  getPlanPrice,
  isValidDate,
  approveGoldShop,
  listGoldShops,
  rejectGoldShop
} = require('../src/modules/superAdminGoldShopModule');
const { getSubscriptionAccountPlan } = require('../src/utils/subscriptionPlanType');
const {
  validateShop,
  validateLoginCredentials,
  validatePaymentConfirmation,
  validateDocumentConsent,
  validateSubscription
} = require('../src/controllers/superAdminGoldShopController');
const goldShopModule = require('../src/modules/superAdminGoldShopModule');
const { postShopRegistration } = require('../src/controllers/superAdminGoldShopController');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('calculates subscription expiry with month-end clamping', () => {
  assert.equal(calculateEndDate('2024-01-31', 'monthly'), '2024-02-29');
  assert.equal(calculateEndDate('2023-11-30', 'quarterly'), '2024-02-29');
  assert.equal(calculateEndDate('2024-02-29', 'yearly'), '2025-02-28');
});

test('rejects invalid subscription dates without throwing', () => {
  assert.equal(isValidDate('2024-02-29'), true);
  assert.equal(isValidDate('2023-02-29'), false);
  assert.equal(isValidDate('9999-99-99'), false);
  assert.equal(validateSubscription({ planId: 1, duration: 'monthly', startDate: '9999-99-99' }).error,
    'Enter a valid subscription start date');
});

test('calculates the trial period and account status from assigned trial days', () => {
  assert.equal(calculateTrialEndDate('2026-11-25', 3), '2026-11-27');
  assert.equal(calculateTrialEndDate('2026-11-25', 5), '2026-11-29');
  const subscription = {
    plan_name: 'Basic',
    start_date: '2026-11-25',
    end_date: '2026-12-25',
    trial_days: 3,
    trial_start_date: '2026-11-25',
    trial_end_date: '2026-11-27',
    payment_status: 'pending'
  };
  assert.deepEqual(
    {
      type: getSubscriptionAccountPlan({ ...subscription, database_date: '2026-11-25' }).account_plan_type,
      remaining: getSubscriptionAccountPlan({ ...subscription, database_date: '2026-11-25' }).trial_days_remaining
    },
    { type: 'trial', remaining: 3 }
  );
  assert.equal(getSubscriptionAccountPlan({ ...subscription, database_date: '2026-11-27' }).trial_days_remaining, 1);
  assert.equal(getSubscriptionAccountPlan({ ...subscription, database_date: '2026-11-28' }).account_plan_type, 'expired');
  assert.equal(getSubscriptionAccountPlan({
    ...subscription,
    payment_status: 'paid',
    database_date: '2026-11-26'
  }).account_plan_type, 'trial');
  assert.equal(getSubscriptionAccountPlan({
    ...subscription,
    payment_status: 'paid',
    database_date: '2026-11-28'
  }).account_plan_type, 'live');
  assert.equal(getSubscriptionAccountPlan({
    ...subscription,
    payment_status: 'paid',
    database_date: '2026-11-28'
  }).account_end_date, '2026-12-25');
  assert.equal(getSubscriptionAccountPlan({
    ...subscription,
    trial_days: 0,
    database_date: '2026-11-28'
  }).account_plan_type, 'pending');
  assert.equal(getSubscriptionAccountPlan({
    ...subscription,
    payment_status: 'paid',
    trial_days: 0,
    database_date: '2026-11-28'
  }).account_plan_type, 'live');
});

test('includes account plan type with each listed gold shop', async () => {
  const originalExecute = pool.execute;
  pool.execute = async (sql) => {
    if (sql.includes('SELECT gs.id, gs.shop_uuid')) {
      return [[{
        id: 5,
        plan_name: 'Basic',
        trial_days: 3,
        trial_start_date: '2026-11-25',
        trial_end_date: '2026-11-27',
        start_date: '2026-11-25',
        end_date: '2026-12-25',
        payment_status: 'paid',
        database_date: '2026-11-25'
      }], []];
    }
    if (sql.includes('COUNT(*) AS total FROM gold_shops gs')) return [[{ total: 1 }], []];
    if (sql.includes('COUNT(*) AS total_shops')) return [[{ total_shops: 1 }], []];
    if (sql.includes('COUNT(*) AS expired_subscriptions')) return [[{ expired_subscriptions: 0 }], []];
    return [{ affectedRows: 0 }, []];
  };

  try {
    const result = await listGoldShops({ search: '', status: 'all', planId: null, page: 1, pageSize: 10 });
    assert.equal(result.shops[0].account_plan_type, 'trial');
    assert.equal(result.shops[0].account_end_date, '2026-11-27');
  } finally {
    pool.execute = originalExecute;
  }
});

test('keeps shops and admin accounts active during their unpaid trial dates', async () => {
  const originalExecute = pool.execute;
  const queries = [];
  pool.execute = async (sql) => {
    queries.push(String(sql).replace(/\s+/g, ' '));
    return [[], []];
  };

  try {
    await expireSubscriptions();
    const deactivationQueries = queries.filter((sql) => sql.includes('SET s.status = \'inactive\'')
      || sql.includes('SET u.status = \'inactive\''));
    assert.equal(deactivationQueries.length, 2);
    for (const query of deactivationQueries) {
      assert.match(query, /trial_days > 0/);
      assert.match(query, /trial_start_date <= CURRENT_DATE\(\)/);
      assert.match(query, /trial_end_date >= CURRENT_DATE\(\)/);
    }
  } finally {
    pool.execute = originalExecute;
  }
});

test('uses the database plan price for the selected duration', () => {
  assert.equal(getPlanPrice({
    plan_name: 'Standard',
    monthly_price: '700.00',
    quarterly_price: '2100.00',
    yearly_price: '8400.00',
    amount: 1
  }, 'quarterly'), 2100);
  assert.throws(() => getPlanPrice({ plan_name: 'Basic', monthly_price: 0 }, 'monthly'), /not configured/);
});

test('validates required shop identity and normalizes contact details', () => {
  const result = validateShop({
    shopName: '  Gold House ',
    ownerName: '  A Owner ',
    mobile: '(98765) 43210',
    email: ' OWNER@EXAMPLE.COM ',
    aadhaarNumber: '123456789012',
    gstNumber: '33abcde1234f1z5',
    pincode: '600001',
    maxBranches: '2',
    maxStaff: '5'
  }, { creating: true });

  assert.equal(result.error, undefined);
  assert.equal(result.shop.shop_name, 'Gold House');
  assert.equal(result.shop.owner_name, 'A Owner');
  assert.equal(result.shop.mobile, '9876543210');
  assert.equal(result.shop.email, 'owner@example.com');
  assert.equal(result.shop.aadhaar_number, '123456789012');
  assert.equal(result.shop.gst_number, '33ABCDE1234F1Z5');
  assert.equal(result.shop.pincode, '600001');
  assert.equal(validateShop({
    shopName: 'Gold House',
    ownerName: 'A Owner',
    mobile: '9876543210',
    aadhaarNumber: ' 123456789012 ',
    maxBranches: 1,
    maxStaff: 1
  }).shop.aadhaar_number, '123456789012');
  assert.equal(validateShop({
    shopName: 'Gold House',
    ownerName: 'A Owner',
    mobile: '9876543210',
    aadhaarNumber: '12345678901',
    maxBranches: 1,
    maxStaff: 1
  }).error, 'Aadhaar number must contain exactly 12 digits');
  assert.equal(validateShop({
    shopName: 'Gold House',
    ownerName: 'A Owner',
    mobile: '12345',
    maxBranches: 1,
    maxStaff: 1
  }).error, 'Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9');
  assert.equal(validateShop({
    shopName: 'Gold House',
    ownerName: 'A Owner',
    mobile: '5123456789',
    maxBranches: 1,
    maxStaff: 1
  }).error, 'Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9');
  assert.equal(validateShop({
    shopName: 'Gold House',
    ownerName: 'A Owner',
    mobile: '9876543210',
    email: 'invalid-email',
    maxBranches: 1,
    maxStaff: 1
  }).error, 'Enter a valid email address');
  assert.equal(validateShop({
    shopName: 'Gold House',
    ownerName: 'A Owner',
    mobile: '9876543210',
    gstNumber: 'INVALIDGSTNUMBER',
    maxBranches: 1,
    maxStaff: 1
  }).error, 'Enter a valid 15-character GSTIN');
  assert.equal(validateShop({
    shopName: 'Gold House',
    ownerName: 'A Owner',
    mobile: '9876543210',
    pincode: '01234A',
    maxBranches: 1,
    maxStaff: 1
  }).error, 'Pincode must be a valid 6-digit Indian postal code');
  assert.equal(validateShop({ maxBranches: 1, maxStaff: 1 }).error,
    'Shop name, owner name, and mobile number are required');
  assert.equal(validateShop({
    shopName: 'Gold House',
    ownerName: 'A Owner',
    mobile: '9876543210',
    maxBranches: 1,
    maxStaff: 1,
    status: 'suspended'
  }, { creating: true }).shop.status, 'pending');
});

test('validates custom shop admin credentials', () => {
  const result = validateLoginCredentials(
    { username: 'shop.owner', password: 'secure-password' },
    'owner@example.com'
  );
  assert.equal(result.error, undefined);
  assert.deepEqual(result.credentials, { username: 'shop.owner', password: 'secure-password' });
  assert.equal(validateLoginCredentials({ username: 'bad user', password: 'secure-password' }, 'owner@example.com').error,
    'Username must be 3 to 150 letters, numbers, or . _ @ + - characters');
  assert.equal(validateLoginCredentials({ username: 'shop.owner', password: 'short' }, 'owner@example.com').error,
    'Password must be at least 8 characters and no more than 72 bytes');
  assert.equal(validateLoginCredentials({ username: 'shop.owner', password: 'secure-password' }, null).error,
    'An email address is required for the Shop Admin login');
});

test('public shop registration creates a pending application without an admin actor', async () => {
  const originalCreateGoldShop = goldShopModule.createGoldShop;
  let createdShop;
  goldShopModule.createGoldShop = async (input, actorId, documents, actorUserId) => {
    createdShop = { input, actorId, documents, actorUserId };
  };
  const res = createResponse();

  try {
    await postShopRegistration({
      body: {
        payload: JSON.stringify({
          shopName: 'Gold House',
          ownerName: 'A Owner',
          mobile: '9876543210',
          email: 'owner@example.com',
          maxBranches: 99,
          maxStaff: 99,
          notes: 'should not be stored',
          credentials: { username: 'gold.owner', password: 'secure-password' },
          subscription: { planId: 1, duration: 'monthly', startDate: '2026-11-25' }
        })
      },
      files: {}
    }, res, assert.ifError);

    assert.equal(res.statusCode, 201);
    assert.equal(createdShop.actorId, null);
    assert.equal(createdShop.actorUserId, null);
    assert.equal(createdShop.input.status, 'pending');
    assert.equal(createdShop.input.max_branches, 1);
    assert.equal(createdShop.input.max_staff, 1);
    assert.equal(createdShop.input.notes, null);
    assert.match(res.body.message, /Super Admin approval/);
  } finally {
    goldShopModule.createGoldShop = originalCreateGoldShop;
  }
});

test('requires owner authorization for uploaded identity and business documents', () => {
  const documents = [{ document_type: 'aadhaar_card' }];
  assert.equal(validateDocumentConsent({}, documents).error,
    'Confirm authorization to upload the shop owner documents');
  assert.deepEqual(validateDocumentConsent({ documentConsent: true }, documents), {});
  assert.deepEqual(validateDocumentConsent({}, [{ document_type: 'profile_photo' }]), {});
});

test('creation never accepts client-supplied price or paid status', () => {
  const result = validateSubscription({
    planId: 1,
    duration: 'monthly',
    startDate: '2024-01-31',
    amount: 0.01,
    paymentStatus: 'paid',
    subscriptionStatus: 'active'
  });

  assert.deepEqual(result.subscription, {
    plan_id: 1,
    duration: 'monthly',
    start_date: '2024-01-31'
  });
});

test('requires a transaction reference and supported method for manual payment confirmation', () => {
  assert.deepEqual(validatePaymentConfirmation({
    transactionId: '  UPI-REF-2048  ',
    paymentMethod: 'upi'
  }), {
    confirmation: {
      transactionId: 'UPI-REF-2048',
      paymentMethod: 'UPI'
    }
  });
  assert.equal(validatePaymentConfirmation({ transactionId: '', paymentMethod: 'upi' }).error,
    'Enter a valid transaction/reference ID (up to 120 characters)');
  assert.equal(validatePaymentConfirmation({ transactionId: 'REF-1', paymentMethod: 'unknown' }).error,
    'Select a valid payment method');
  assert.ok(validatePaymentConfirmation({ transactionId: `REF${'\n'}1`, paymentMethod: 'cash' }).error);
});

test('creates the shop admin user only after approval and preserves the submitted password', async () => {
  const originalGetConnection = pool.getConnection;
  const originalExecute = pool.execute;
  const state = {
    pendingCredentials: null,
    user: null,
    shop: {
      id: 7,
      email: 'owner@example.com',
      mobile: '9876543210',
      owner_name: 'Shop Owner',
      owner_user_id: null,
      approval_status: 'pending'
    }
  };
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (sql, values = []) => {
      if (sql.includes('SELECT * FROM gold_shops')) return [[state.shop], []];
      if (sql.includes('SELECT user_id FROM users WHERE email = ?')) return [[], []];
      if (sql.includes('SELECT gold_shop_id FROM gold_shop_pending_credentials')) return [[], []];
      if (sql.includes('INSERT INTO gold_shops')) {
        state.shop.created_by = values[15];
        state.shop.updated_by = values[16];
        return [{ insertId: state.shop.id }, []];
      }
      if (sql.includes('UPDATE gold_shops SET shop_code')) return [{ affectedRows: 1 }, []];
      if (sql.includes('INSERT INTO gold_shop_pending_credentials')) {
        state.pendingCredentials = { username: values[1], password_hash: values[2] };
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('FROM subscription_plans WHERE id')) {
        return [[{
          id: 1,
          plan_name: 'Basic',
          monthly_price: 500,
          quarterly_price: 1500,
          half_yearly_price: 3000,
          yearly_price: 6000
        }], []];
      }
      if (sql.includes('INSERT INTO subscriptions')) return [{ insertId: 12 }, []];
      if (sql.includes('SELECT username, password_hash FROM gold_shop_pending_credentials')) {
        return [[state.pendingCredentials], []];
      }
      if (sql.includes('SELECT user_id FROM users WHERE email = ? OR phone = ? OR username = ?')) return [[], []];
      if (sql.includes('INSERT INTO users')) {
        state.user = {
          user_id: values[0],
          username: values[1],
          email: values[3],
          gold_shop_id: values[5],
          password_hash: values[6],
          role: 'admin',
          status: 'active'
        };
        return [{ insertId: 50 }, []];
      }
      if (sql.includes("SET approval_status='approved'")) {
        state.shop.owner_user_id = values[0];
        state.shop.updated_by = values[1];
        state.shop.approval_status = 'approved';
        state.shop.approved_at = new Date();
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('DELETE FROM gold_shop_pending_credentials')) {
        state.pendingCredentials = null;
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 1 }, []];
    }
  };
  pool.getConnection = async () => connection;
  pool.execute = async (sql) => {
    if (sql.includes('FROM gold_shops gs')) return [[state.shop], []];
    return [[], []];
  };

  try {
    await createGoldShop({
      shop_name: 'Gold House',
      owner_name: state.shop.owner_name,
      mobile: state.shop.mobile,
      email: state.shop.email,
      max_branches: 1,
      max_staff: 1,
      credentials: { username: 'shop.owner', password: 'secure-password' },
      subscription: { plan_id: 1, duration: 'monthly', start_date: '2026-01-01' }
    }, 3, [], 'admin-user-uuid');

    assert.equal(state.user, null);
    assert.equal(state.pendingCredentials.username, 'shop.owner');
    assert.equal(state.shop.created_by, 'admin-user-uuid');
    assert.equal(state.shop.updated_by, 'admin-user-uuid');
    assert.equal(await bcrypt.compare('secure-password', state.pendingCredentials.password_hash), true);

    await approveGoldShop(state.shop.id, 3, 'admin-user-uuid');

    assert.equal(state.user.username, 'shop.owner');
    assert.equal(state.user.email, state.shop.email);
    assert.equal(state.user.gold_shop_id, state.shop.id);
    assert.equal(state.shop.owner_user_id, state.user.user_id);
    assert.match(state.user.user_id, /^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
    assert.equal(state.user.role, 'admin');
    assert.equal(state.user.status, 'active');
    assert.equal(await bcrypt.compare('secure-password', state.user.password_hash), true);
    assert.equal(state.pendingCredentials, null);
    assert.equal(state.shop.approval_status, 'approved');
    assert.equal(state.shop.updated_by, 'admin-user-uuid');
    await assert.rejects(approveGoldShop(state.shop.id, 3), /already been approved/);
    assert.equal(state.user.gold_shop_id, state.shop.id);
  } finally {
    pool.getConnection = originalGetConnection;
    pool.execute = originalExecute;
  }
});

test('approves an existing shop account by user_id and links its gold_shop_id', async () => {
  const originalGetConnection = pool.getConnection;
  const originalExecute = pool.execute;
  const ownerUserId = 'c0dd8c2c-33b9-4a2f-93f6-50cd674ab3de';
  const state = {
    shop: {
      id: 11,
      email: 'owner@example.com',
      owner_name: 'Shop Owner',
      owner_user_id: ownerUserId,
      approval_status: 'pending'
    },
    linkedShopId: null
  };
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (sql, values = []) => {
      if (sql.includes('SELECT * FROM gold_shops')) return [[state.shop], []];
      if (sql.includes('SELECT user_id FROM users WHERE user_id = ?')) {
        assert.deepEqual(values, [ownerUserId]);
        return [[{ user_id: ownerUserId }], []];
      }
      if (sql.includes("SET role='admin', status='active', gold_shop_id=?")) {
        state.linkedShopId = values[0];
        assert.equal(values[1], ownerUserId);
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("SET approval_status='approved'")) {
        state.shop.approval_status = 'approved';
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 1 }, []];
    }
  };
  pool.getConnection = async () => connection;
  pool.execute = async (sql) => (sql.includes('FROM gold_shops gs') ? [[state.shop], []] : [[], []]);

  try {
    await approveGoldShop(state.shop.id, 3, 'admin-user-uuid');
    assert.equal(state.linkedShopId, state.shop.id);
    assert.equal(state.shop.approval_status, 'approved');
  } finally {
    pool.getConnection = originalGetConnection;
    pool.execute = originalExecute;
  }
});

test('rejecting a pending shop removes credentials without creating a user', async () => {
  const originalGetConnection = pool.getConnection;
  const originalExecute = pool.execute;
  const state = {
    pendingCredentials: { username: 'shop.owner', password_hash: 'bcrypt-hash' },
    user: null,
    shop: { id: 8, approval_status: 'pending', status: 'pending' }
  };
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (sql, values = []) => {
      if (sql.includes('SELECT id, approval_status FROM gold_shops')) return [[state.shop], []];
      if (sql.includes("SET approval_status = 'rejected'")) {
        state.shop.approval_status = 'rejected';
        state.shop.status = 'inactive';
        state.shop.updated_by = values[0];
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('DELETE FROM gold_shop_pending_credentials')) {
        state.pendingCredentials = null;
      }
      return [{ affectedRows: 1 }, []];
    }
  };
  pool.getConnection = async () => connection;
  pool.execute = async () => [[], []];

  try {
    await rejectGoldShop(state.shop.id, 3, 'admin-user-uuid');
    assert.equal(state.shop.approval_status, 'rejected');
    assert.equal(state.shop.status, 'inactive');
    assert.equal(state.shop.updated_by, 'admin-user-uuid');
    assert.equal(state.pendingCredentials, null);
    assert.equal(state.user, null);
  } finally {
    pool.getConnection = originalGetConnection;
    pool.execute = originalExecute;
  }
});

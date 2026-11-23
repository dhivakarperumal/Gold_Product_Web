const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const {
  calculateEndDate,
  createGoldShop,
  getPlanPrice,
  isValidDate,
  approveGoldShop
} = require('../src/modules/superAdminGoldShopModule');
const {
  validateShop,
  validateLoginCredentials,
  validatePaymentConfirmation,
  validateDocumentConsent,
  validateSubscription
} = require('../src/controllers/superAdminGoldShopController');

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
    mobile: '+91 (98765) 43210',
    email: ' OWNER@EXAMPLE.COM ',
    maxBranches: '2',
    maxStaff: '5'
  }, { creating: true });

  assert.equal(result.error, undefined);
  assert.equal(result.shop.shop_name, 'Gold House');
  assert.equal(result.shop.owner_name, 'A Owner');
  assert.equal(result.shop.mobile, '+919876543210');
  assert.equal(result.shop.email, 'owner@example.com');
  assert.equal(validateShop({ maxBranches: 1, maxStaff: 1 }).error,
    'Shop name, owner name, and mobile number are required');
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
      mobile: '+919876543210',
      owner_name: 'Shop Owner',
      owner_user_id: null
    }
  };
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (sql, values = []) => {
      if (sql.includes('SELECT * FROM gold_shops')) return [[state.shop], []];
      if (sql.includes('SELECT id FROM users WHERE email = ?')) return [[], []];
      if (sql.includes('SELECT gold_shop_id FROM gold_shop_pending_credentials')) return [[], []];
      if (sql.includes('INSERT INTO gold_shops')) return [{ insertId: state.shop.id }, []];
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
      if (sql.includes('SELECT id, payment_status, subscription_status')) {
        return [[{ id: 12, payment_status: 'paid', subscription_status: 'pending', is_current: 1 }], []];
      }
      if (sql.includes('SELECT username, password_hash FROM gold_shop_pending_credentials')) {
        return [[state.pendingCredentials], []];
      }
      if (sql.includes('SELECT id FROM users WHERE email = ? OR phone = ? OR username = ?')) return [[], []];
      if (sql.includes('INSERT INTO users')) {
        state.user = {
          username: values[1],
          email: values[3],
          password_hash: values[5],
          role: 'admin',
          status: 'active'
        };
        return [{ insertId: 50 }, []];
      }
      if (sql.includes('DELETE FROM gold_shop_pending_credentials')) {
        state.pendingCredentials = null;
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("UPDATE gold_shops\n       SET status='active'")) {
        state.shop.owner_user_id = values[0];
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
    }, 3);

    assert.equal(state.user, null);
    assert.equal(state.pendingCredentials.username, 'shop.owner');
    assert.equal(await bcrypt.compare('secure-password', state.pendingCredentials.password_hash), true);

    await approveGoldShop(state.shop.id, 3);

    assert.equal(state.user.username, 'shop.owner');
    assert.equal(state.user.email, state.shop.email);
    assert.equal(state.user.role, 'admin');
    assert.equal(state.user.status, 'active');
    assert.equal(await bcrypt.compare('secure-password', state.user.password_hash), true);
    assert.equal(state.pendingCredentials, null);
  } finally {
    pool.getConnection = originalGetConnection;
    pool.execute = originalExecute;
  }
});

const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const authModule = require('../src/modules/authModule');
const shopSubscriptionModule = require('../src/modules/shopSubscriptionModule');

const originalAuthMethods = {
  findUserForLogin: authModule.findUserForLogin,
  getUserByUserId: authModule.getUserByUserId,
  verifyPassword: authModule.verifyPassword,
  createAccessToken: authModule.createAccessToken,
  createSubscriptionAccessToken: authModule.createSubscriptionAccessToken
};
const originalGetAccountPlanForOwner = shopSubscriptionModule.getAccountPlanForOwner;
const state = {
  user: {
    id: 8,
    user_id: 'shop-admin-uuid',
    role: 'admin',
    status: 'Active',
    password_hash: 'hash'
  },
  accountPlan: { account_plan_type: 'live' }
};

authModule.findUserForLogin = async () => state.user;
authModule.getUserByUserId = async () => state.user;
authModule.verifyPassword = async () => true;
authModule.createAccessToken = () => 'admin-token';
authModule.createSubscriptionAccessToken = () => 'checkout-token';
shopSubscriptionModule.getAccountPlanForOwner = async () => state.accountPlan;
const { createSubscriptionAccess, login } = require('../src/controllers/authController');
const requireAdmin = require('../src/middleware/requireAdmin');

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

test('blocks normal login after an unpaid trial expires, including inactive trial admins', async () => {
  state.user = { ...state.user, status: 'Inactive' };
  state.accountPlan = { account_plan_type: 'expired' };
  const res = createResponse();

  await login({ body: { identifier: 'owner@example.com', password: 'password' } }, res, assert.ifError);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'TRIAL_EXPIRED');
  assert.equal(res.body.accountPlan.account_plan_type, 'expired');
});

test('allows an expired trial admin to get checkout access but not a normal session', async () => {
  state.user = { ...state.user, status: 'Inactive' };
  state.accountPlan = { account_plan_type: 'expired' };
  const res = createResponse();

  await createSubscriptionAccess(
    { body: { identifier: 'owner@example.com', password: 'password' } },
    res,
    assert.ifError
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.checkoutToken, 'checkout-token');
});

test('requires payment before login when the assigned plan has no trial', async () => {
  state.user = { ...state.user, status: 'Active' };
  state.accountPlan = { account_plan_type: 'pending' };
  const loginResponse = createResponse();

  await login({ body: { identifier: 'owner@example.com', password: 'password' } }, loginResponse, assert.ifError);
  assert.equal(loginResponse.statusCode, 403);
  assert.equal(loginResponse.body.code, 'SUBSCRIPTION_REQUIRED');

  const checkoutResponse = createResponse();
  await createSubscriptionAccess(
    { body: { identifier: 'owner@example.com', password: 'password' } },
    checkoutResponse,
    assert.ifError
  );
  assert.equal(checkoutResponse.statusCode, 200);
  assert.equal(checkoutResponse.body.checkoutToken, 'checkout-token');
});

test('allows normal login and admin access during an unpaid trial', async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-subscription-secret';
  state.user = { ...state.user, status: 'Active' };
  state.accountPlan = {
    account_plan_type: 'trial',
    trial_active: true,
    payment_status: 'pending'
  };
  const loginResponse = createResponse();

  try {
    await login(
      { body: { identifier: 'owner@example.com', password: 'password' } },
      loginResponse,
      assert.ifError
    );
    assert.equal(loginResponse.statusCode, 200);
    assert.equal(loginResponse.body.token, 'admin-token');

    const token = jwt.sign({ user_id: state.user.user_id, role: 'admin' }, process.env.JWT_SECRET);
    const adminResponse = createResponse();
    let nextCalled = false;
    await requireAdmin(
      { get: () => `Bearer ${token}` },
      adminResponse,
      () => { nextCalled = true; }
    );
    assert.equal(nextCalled, true);
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test('blocks existing admin sessions after an unpaid trial expires', async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-subscription-secret';
  state.user = { ...state.user, status: 'Active' };
  state.accountPlan = { account_plan_type: 'expired' };
  const token = jwt.sign({ user_id: state.user.user_id, role: 'admin' }, process.env.JWT_SECRET);
  const res = createResponse();

  try {
    await requireAdmin({ get: () => `Bearer ${token}` }, res, assert.ifError);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'TRIAL_EXPIRED');
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test('allows a paid account to sign in normally', async () => {
  state.user = { ...state.user, status: 'Active' };
  state.accountPlan = { account_plan_type: 'live' };
  const res = createResponse();

  await login({ body: { identifier: 'owner@example.com', password: 'password' } }, res, assert.ifError);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.token, 'admin-token');
});

test.after(() => {
  Object.assign(authModule, originalAuthMethods);
  shopSubscriptionModule.getAccountPlanForOwner = originalGetAccountPlanForOwner;
});

const assert = require('node:assert/strict');
const test = require('node:test');
const authModule = require('../src/modules/authModule');
const { pool } = require('../src/config/db');

const controllerPath = require.resolve('../src/controllers/authController');

async function withAuthMocks(mocks, run) {
  const originals = {};
  for (const [name, implementation] of Object.entries(mocks)) {
    originals[name] = authModule[name];
    authModule[name] = implementation;
  }
  delete require.cache[controllerPath];
  try {
    await run(require(controllerPath).deactivateMyAccount);
  } finally {
    for (const [name, implementation] of Object.entries(originals)) {
      authModule[name] = implementation;
    }
    delete require.cache[controllerPath];
  }
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('requires current password to deactivate an admin account', async () => {
  await withAuthMocks({}, async (deactivateMyAccount) => {
    const res = responseRecorder();
    await deactivateMyAccount({ body: {}, storeUser: { role: 'admin' } }, res, assert.ifError);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /current password/i);
  });
});

test('does not deactivate an account when its current password is incorrect', async () => {
  let deactivationCalled = false;
  await withAuthMocks({
    getPasswordHash: async () => 'stored-hash',
    verifyPassword: async () => false,
    deactivateOwnAccount: async () => {
      deactivationCalled = true;
      return true;
    }
  }, async (deactivateMyAccount) => {
    const res = responseRecorder();
    await deactivateMyAccount({
      body: { currentPassword: 'wrong-password' },
      storeUser: { user_id: 'admin-uuid', role: 'admin' }
    }, res, assert.ifError);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Current password is incorrect');
    assert.equal(deactivationCalled, false);
  });
});

test('deactivates the authenticated admin account after password verification', async () => {
  let deactivatedUserId;
  await withAuthMocks({
    getPasswordHash: async () => 'stored-hash',
    verifyPassword: async (password, hash) => password === 'correct-password' && hash === 'stored-hash',
    deactivateOwnAccount: async (userId) => {
      deactivatedUserId = userId;
      return true;
    }
  }, async (deactivateMyAccount) => {
    const res = responseRecorder();
    await deactivateMyAccount({
      body: { currentPassword: 'correct-password' },
      storeUser: { user_id: 'admin-uuid', role: 'admin' }
    }, res, assert.ifError);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { message: 'Account deactivated successfully' });
    assert.equal(deactivatedUserId, 'admin-uuid');
  });
});

test('does not allow non-admin users to deactivate through the admin profile action', async () => {
  await withAuthMocks({
    getPasswordHash: async () => 'stored-hash',
    verifyPassword: async () => true
  }, async (deactivateMyAccount) => {
    const res = responseRecorder();
    await deactivateMyAccount({
      body: { currentPassword: 'password' },
      storeUser: { user_id: 'customer-uuid', role: 'user' }
    }, res, assert.ifError);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /only admin/i);
  });
});

test('marks only the authenticated active account inactive', async (context) => {
  const originalExecute = pool.execute;
  let executedQuery;
  let executedValues;
  pool.execute = async (query, values) => {
    executedQuery = query;
    executedValues = values;
    return [{ affectedRows: 1 }];
  };
  context.after(() => {
    pool.execute = originalExecute;
  });

  assert.equal(await authModule.deactivateOwnAccount('admin-uuid'), true);
  assert.match(executedQuery, /UPDATE users SET status = 'inactive'/);
  assert.match(executedQuery, /status = 'active'/);
  assert.deepEqual(executedValues, ['admin-uuid']);
});

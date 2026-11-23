const assert = require('node:assert/strict');
const test = require('node:test');

const goldRateModulePath = require.resolve('../src/modules/goldRateModule');
const goldRateControllerPath = require.resolve('../src/controllers/goldRateController');
const goldRateModule = require(goldRateModulePath);

async function withControllerMocks(mocks, run) {
  const originals = {};
  for (const [name, implementation] of Object.entries(mocks)) {
    originals[name] = goldRateModule[name];
    goldRateModule[name] = implementation;
  }
  delete require.cache[goldRateControllerPath];

  try {
    await run(require(goldRateControllerPath));
  } finally {
    for (const [name, implementation] of Object.entries(originals)) {
      goldRateModule[name] = implementation;
    }
    delete require.cache[goldRateControllerPath];
  }
}

function responseRecorder() {
  return {
    statusCode: null,
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

function validRequest(extra = {}) {
  return {
    rate_date: '2026-06-01',
    effective_from: '2026-06-01T09:00',
    making_charge_type: 'Percentage',
    making_charge_value: 12,
    wastage_percentage: 2,
    reason: 'Daily market update',
    rates: {
      gold_999: 10000,
      gold_916: 9160,
      gold_833: 8330,
      gold_750: 7500,
      gold_585: 5850,
      silver_999: 150,
      platinum_950: 3500,
      platinum_900: 3300,
      diamond_df_vvs: 250000,
      diamond_gh_vs: 150000,
      diamond_ij_si: 90000
    },
    ...extra
  };
}

test('daily rate create and edit use authenticated users.user_id for audit values', async () => {
  const actors = [];
  await withControllerMocks({
    createRateBatch: async (batch, actorUserId) => {
      actors.push(actorUserId);
      return { id: 1 };
    },
    updateRateBatch: async (id, batch, actorUserId) => {
      actors.push(actorUserId);
      return { batch: { id: Number(id) } };
    }
  }, async ({ postRates, putRates }) => {
    const user = { id: 12, user_id: 'authenticated-user-uuid' };
    const createRes = responseRecorder();
    await postRates({ body: validRequest(), adminUser: user }, createRes, (error) => { throw error; });

    const updateRes = responseRecorder();
    await putRates({
      params: { id: '1' },
      body: validRequest({ expected_version: 1 }),
      adminUser: user
    }, updateRes, (error) => { throw error; });

    assert.deepEqual(actors, ['authenticated-user-uuid', 'authenticated-user-uuid']);
    assert.equal(createRes.statusCode, 201);
    assert.equal(updateRes.body.id, 1);
  });
});

test('rate activation audits with user_id and retains numeric ID only for product price history', async () => {
  let activationArgs;
  await withControllerMocks({
    activateRateBatch: async (...args) => {
      activationArgs = args;
      return { batch: { id: 1 }, priceRecalculation: null };
    }
  }, async ({ activateRates }) => {
    const res = responseRecorder();
    await activateRates({
      params: { id: '1' },
      body: { reason: 'Market update' },
      adminUser: { id: 12, user_id: 'authenticated-user-uuid' }
    }, res, (error) => { throw error; });

    assert.deepEqual(activationArgs, ['1', 'Market update', 'authenticated-user-uuid', 12]);
    assert.equal(res.body.id, 1);
  });
});

test('daily rate history is requested only for the authenticated owner user_id', async () => {
  const scopes = [];
  await withControllerMocks({
    listRateHistory: async (options) => {
      scopes.push(options);
      return [];
    },
    listRateBatches: async (options) => {
      scopes.push(options);
      return [];
    }
  }, async ({ getHistory }) => {
    const res = responseRecorder();
    await getHistory({
      adminUser: { user_id: 'authenticated-user-uuid' }
    }, res, (error) => { throw error; });

    assert.deepEqual(scopes, [
      { userId: 'authenticated-user-uuid' },
      { limit: 100, userId: 'authenticated-user-uuid' }
    ]);
    assert.deepEqual(res.body, { history: [], batches: [] });
  });
});

test('current daily rates are requested for the authenticated user_id', async () => {
  let requestedUserId;
  await withControllerMocks({
    getCurrentGoldRates: async (userId) => {
      requestedUserId = userId;
      return { user_id: userId };
    }
  }, async ({ getCurrent }) => {
    const res = responseRecorder();
    await getCurrent({
      adminUser: { user_id: 'authenticated-user-uuid' }
    }, res, (error) => { throw error; });

    assert.equal(requestedUserId, 'authenticated-user-uuid');
    assert.deepEqual(res.body, { user_id: 'authenticated-user-uuid' });
  });
});

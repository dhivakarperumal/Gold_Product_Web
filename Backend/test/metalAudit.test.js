const assert = require('node:assert/strict');
const test = require('node:test');

const metalModule = require('../src/modules/metalModule');
const controllerPath = require.resolve('../src/controllers/metalController');

async function withControllerMocks(mocks, run) {
  const originals = {};
  for (const [name, implementation] of Object.entries(mocks)) {
    originals[name] = metalModule[name];
    metalModule[name] = implementation;
  }
  delete require.cache[controllerPath];

  try {
    await run(require(controllerPath));
  } finally {
    for (const [name, implementation] of Object.entries(originals)) {
      metalModule[name] = implementation;
    }
    delete require.cache[controllerPath];
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

test('metal creation records creator and updater from the authenticated admin', async () => {
  let insertedMetal;
  await withControllerMocks({
    createMetal: async (metal) => {
      insertedMetal = metal;
      return { id: 21, ...metal };
    }
  }, async ({ postMetal }) => {
    const res = responseRecorder();
    await postMetal({
      body: { name: 'Gold', createdBy: 'untrusted-user', updatedBy: 'untrusted-user' },
      adminUser: { user_id: 'authenticated-user-uuid' }
    }, res, (error) => { throw error; });

    assert.equal(res.statusCode, 201);
    assert.equal(insertedMetal.createdBy, 'authenticated-user-uuid');
    assert.equal(insertedMetal.updatedBy, 'authenticated-user-uuid');
  });
});

test('metal updates record updated_by from the authenticated admin', async () => {
  let updateArgs;
  let lookupArgs;
  await withControllerMocks({
    getMetalById: async (...args) => {
      lookupArgs = args;
      return { id: 21, image: null };
    },
    updateMetal: async (...args) => {
      updateArgs = args;
      return { id: args[0], ...args[1] };
    }
  }, async ({ putMetal }) => {
    const res = responseRecorder();
    await putMetal({
      params: { id: '21' },
      body: { name: 'Gold', updatedBy: 'untrusted-user' },
      adminUser: { user_id: 'authenticated-user-uuid' }
    }, res, (error) => { throw error; });

    assert.equal(updateArgs[0], 21);
    assert.equal(updateArgs[1].updatedBy, 'authenticated-user-uuid');
    assert.equal(updateArgs[1].ownerUserId, 'authenticated-user-uuid');
    assert.deepEqual(lookupArgs, [21, { createdBy: 'authenticated-user-uuid' }]);
    assert.equal(res.body.id, 21);
  });
});

test('metal deletion is scoped to the authenticated admin', async () => {
  let lookupArgs;
  let deleteArgs;
  await withControllerMocks({
    getMetalById: async (...args) => {
      lookupArgs = args;
      return { id: 21, image: null };
    },
    deleteMetal: async (...args) => {
      deleteArgs = args;
      return true;
    }
  }, async ({ removeMetal }) => {
    const res = responseRecorder();
    await removeMetal({
      params: { id: '21' },
      adminUser: { user_id: 'authenticated-user-uuid' }
    }, res, (error) => { throw error; });

    assert.deepEqual(lookupArgs, [21, { createdBy: 'authenticated-user-uuid' }]);
    assert.deepEqual(deleteArgs, [21, 'authenticated-user-uuid']);
    assert.equal(res.body.message, 'Metal deleted successfully');
  });
});

test('managed metal listing filters by the authenticated admin while public listing stays compatible', async () => {
  const listOptions = [];
  await withControllerMocks({
    listMetals: async (options) => {
      listOptions.push(options);
      return [];
    }
  }, async ({ getMetals, getManagedMetals }) => {
    await getMetals({}, responseRecorder(), (error) => { throw error; });
    await getManagedMetals({
      adminUser: { user_id: 'authenticated-user-uuid' }
    }, responseRecorder(), (error) => { throw error; });

    assert.deepEqual(listOptions, [
      undefined,
      { includeAudit: true, createdBy: 'authenticated-user-uuid' }
    ]);
  });
});

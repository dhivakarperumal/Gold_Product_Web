const assert = require('node:assert/strict');
const test = require('node:test');

const categoryModulePath = require.resolve('../src/modules/categoryModule');
const categoryControllerPath = require.resolve('../src/controllers/categoryController');
const categoryModule = require(categoryModulePath);

async function withControllerMocks(mocks, run) {
  const originals = {};
  for (const [name, implementation] of Object.entries(mocks)) {
    originals[name] = categoryModule[name];
    categoryModule[name] = implementation;
  }
  delete require.cache[categoryControllerPath];

  try {
    await run(require(categoryControllerPath));
  } finally {
    for (const [name, implementation] of Object.entries(originals)) {
      categoryModule[name] = implementation;
    }
    delete require.cache[categoryControllerPath];
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

test('category creation uses authenticated owner and audit user IDs', async () => {
  let insertedCategory;
  await withControllerMocks({
    createCategory: async (category) => {
      insertedCategory = category;
      return { catId: category.catId };
    }
  }, async ({ postCategory }) => {
    const res = responseRecorder();
    await postCategory({
      body: { catId: 'CAT001', name: 'Rings', user_id: '5' },
      files: [],
      adminUser: { user_id: 'authenticated-user-uuid', id: 12 }
    }, res, (error) => { throw error; });

    assert.equal(res.statusCode, 201);
    assert.equal(insertedCategory.createdBy, 'authenticated-user-uuid');
    assert.equal(insertedCategory.updatedBy, 'authenticated-user-uuid');
    assert.equal(insertedCategory.userId, 12);
  });
});

test('category updates set updated_by from authentication without changing created_by', async () => {
  let updateArgs;
  const ownerFilters = [];
  await withControllerMocks({
    getCategoryById: async (...args) => {
      ownerFilters.push(args);
      return { catId: 'CAT001', images: [] };
    },
    updateCategory: async (...args) => {
      updateArgs = args;
      return { catId: args[0] };
    }
  }, async ({ putCategory }) => {
    const res = responseRecorder();
    await putCategory({
      params: { catId: 'CAT001' },
      body: { name: 'Updated Rings', user_id: '5' },
      files: [],
      adminUser: { user_id: 'authenticated-user-uuid', id: 12 }
    }, res, (error) => { throw error; });

    assert.equal(updateArgs[0], 'CAT001');
    assert.equal(updateArgs[1].updatedBy, 'authenticated-user-uuid');
    assert.equal(updateArgs[1].userId, 12);
    assert.equal(updateArgs[1].ownerUserId, 'authenticated-user-uuid');
    assert.deepEqual(ownerFilters[0], ['CAT001', {
      userId: 'authenticated-user-uuid',
      legacyUserId: 12
    }]);
    assert.equal(res.body.catId, 'CAT001');
  });
});

test('category management list requests audit details separately from the public category list', async () => {
  const listOptions = [];
  await withControllerMocks({
    listCategories: async (options) => {
      listOptions.push(options);
      return [];
    }
  }, async ({ getCategories, getManagedCategories }) => {
    await getCategories({}, responseRecorder(), (error) => { throw error; });
    await getManagedCategories({
      adminUser: { user_id: 'authenticated-user-uuid', id: 12 }
    }, responseRecorder(), (error) => { throw error; });

    assert.deepEqual(listOptions, [
      undefined,
      {
        includeAudit: true,
        userId: 'authenticated-user-uuid',
        legacyUserId: 12
      }
    ]);
  });
});

test('category deletion is scoped to the authenticated user', async () => {
  let lookupArgs;
  let deleteArgs;
  await withControllerMocks({
    getCategoryById: async (...args) => {
      lookupArgs = args;
      return { catId: 'CAT001', images: [] };
    },
    deleteCategory: async (...args) => {
      deleteArgs = args;
      return true;
    }
  }, async ({ removeCategory }) => {
    const res = responseRecorder();
    await removeCategory({
      params: { catId: 'CAT001' },
      adminUser: { user_id: 'authenticated-user-uuid', id: 12 }
    }, res, (error) => { throw error; });

    assert.deepEqual(lookupArgs, ['CAT001', {
      userId: 'authenticated-user-uuid',
      legacyUserId: 12
    }]);
    assert.deepEqual(deleteArgs, ['CAT001', 'authenticated-user-uuid', 12]);
    assert.equal(res.body.message, 'Category deleted successfully');
  });
});

const assert = require('node:assert/strict');
const test = require('node:test');

const categoryModulePath = require.resolve('../src/modules/categoryModule');
const categoryControllerPath = require.resolve('../src/controllers/categoryController');
const categoryModule = require(categoryModulePath);
const { pool } = require('../src/config/db');

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

test('category creation ignores submitted IDs and uses the authenticated owner', async () => {
  let insertedCategory;
  await withControllerMocks({
    createCategory: async (category) => {
      insertedCategory = category;
      return { catId: 'CAT001' };
    }
  }, async ({ postCategory }) => {
    const res = responseRecorder();
    await postCategory({
      body: { catId: 'CAT999', name: 'Rings', user_id: 'another-user' },
      files: [],
      adminUser: { user_id: 'authenticated-user-uuid', id: 12 }
    }, res, (error) => { throw error; });

    assert.equal(res.statusCode, 201);
    assert.equal(insertedCategory.ownerUserId, 'authenticated-user-uuid');
    assert.equal(Object.hasOwn(insertedCategory, 'catId'), false);
    assert.equal(Object.hasOwn(insertedCategory, 'user_id'), false);
    assert.equal(res.body.catId, 'CAT001');
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
    assert.equal(updateArgs[1].ownerUserId, 'authenticated-user-uuid');
    assert.deepEqual(ownerFilters[0], ['CAT001', { userId: 'authenticated-user-uuid' }]);
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
        userId: 'authenticated-user-uuid'
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

    assert.deepEqual(lookupArgs, ['CAT001', { userId: 'authenticated-user-uuid' }]);
    assert.deepEqual(deleteArgs, ['CAT001', 'authenticated-user-uuid']);
    assert.equal(res.body.message, 'Category deleted successfully');
  });
});

test('category IDs increment from the owner-specific maximum under a user-row transaction lock', async () => {
  const originalGetConnection = pool.getConnection;
  const ownerUserId = 'admin-a-uuid';
  const newOwnerUserId = 'admin-b-uuid';
  const executedQueries = [];
  const insertedValues = [];
  let nextRecordId = 42;
  const categoriesByOwner = new Map([
    [ownerUserId, [{ catId: 'CAT004' }, { catId: 'CAT011' }, { catId: 'CAT007' }]],
    [newOwnerUserId, []]
  ]);
  const connection = {
    async beginTransaction() {
      executedQueries.push('BEGIN');
    },
    async commit() {
      executedQueries.push('COMMIT');
    },
    async rollback() {
      executedQueries.push('ROLLBACK');
    },
    release() {},
    async execute(query, params) {
      executedQueries.push(query);
      if (query.includes('FROM users WHERE user_id = ? FOR UPDATE')) {
        return [[{ user_id: params[0] }], []];
      }
      if (query.includes('SELECT catId FROM categories WHERE user_id = ? FOR UPDATE')) {
        return [categoriesByOwner.get(params[0]) || [], []];
      }
      if (query.includes('INSERT INTO categories')) {
        insertedValues.push(params);
        const ownerCategories = categoriesByOwner.get(params[5]) || [];
        ownerCategories.push({ catId: params[0] });
        categoriesByOwner.set(params[5], ownerCategories);
        return [{ affectedRows: 1 }, []];
      }
      if (query.includes('FROM categories c')) {
        return [[{
          id: nextRecordId++,
          catId: params[0],
          name: 'Rings',
          description: null,
          subcategory: '[]',
          images: '[]',
          user_id: params[1],
          created_by: params[1],
          created_by_name: 'Admin',
          updated_by: params[1],
          updated_by_name: 'Admin',
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date()
        }], []];
      }
      throw new Error(`Unexpected category query: ${query}`);
    }
  };
  pool.getConnection = async () => connection;

  try {
    const category = await categoryModule.createCategory({
      name: 'Rings',
      description: '',
      subcategory: [],
      images: [],
      ownerUserId
    });
    const firstCategoryForNewOwner = await categoryModule.createCategory({
      name: 'Bracelets',
      description: '',
      subcategory: [],
      images: [],
      ownerUserId: newOwnerUserId
    });

    assert.equal(insertedValues[0][0], 'CAT012');
    assert.equal(insertedValues[0][5], ownerUserId);
    assert.equal(insertedValues[0][6], ownerUserId);
    assert.equal(insertedValues[0][7], ownerUserId);
    assert.equal(category.catId, 'CAT012');
    assert.equal(insertedValues[1][0], 'CAT001');
    assert.equal(insertedValues[1][5], newOwnerUserId);
    assert.equal(firstCategoryForNewOwner.catId, 'CAT001');
    assert.equal(executedQueries.filter((query) => query.includes('FROM users WHERE user_id = ? FOR UPDATE')).length, 2);
    assert.equal(executedQueries.filter((query) => query.includes('SELECT catId FROM categories WHERE user_id = ? FOR UPDATE')).length, 2);
    assert.equal(executedQueries[executedQueries.length - 1], 'COMMIT');
  } finally {
    pool.getConnection = originalGetConnection;
  }
});

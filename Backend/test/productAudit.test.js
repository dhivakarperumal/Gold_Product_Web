const assert = require('node:assert/strict');
const test = require('node:test');

const productModulePath = require.resolve('../src/modules/productModule');
const productControllerPath = require.resolve('../src/controllers/productController');
const productModule = require(productModulePath);

async function withControllerMocks(mocks, run) {
  const originals = {};
  for (const [name, implementation] of Object.entries(mocks)) {
    originals[name] = productModule[name];
    productModule[name] = implementation;
  }
  delete require.cache[productControllerPath];

  try {
    await run(require(productControllerPath));
  } finally {
    for (const [name, implementation] of Object.entries(originals)) {
      productModule[name] = implementation;
    }
    delete require.cache[productControllerPath];
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

test('product creation stores the authenticated user UUID and ignores client audit fields', async () => {
  let insertedProduct;
  await withControllerMocks({
    createProduct: async (product) => {
      insertedProduct = product;
      return { id: 1, product_code: product.product_code };
    }
  }, async ({ postProduct }) => {
    const res = responseRecorder();
    await postProduct({
      body: {
        product_code: 'SKU-1',
        name: 'Gold Ring',
        category: 'Rings',
        created_by: 'forged-user-id',
        updated_by: 'forged-user-id'
      },
      adminUser: { id: 12, user_id: 'authenticated-user-uuid' }
    }, res, (error) => { throw error; });

    assert.equal(res.statusCode, 201);
    assert.equal(insertedProduct.created_by, 'authenticated-user-uuid');
    assert.equal(insertedProduct.updated_by, undefined);
  });
});

test('product updates store the authenticated user UUID as updated_by', async () => {
  let updatedProduct;
  const existingProduct = {
    id: 1,
    product_code: 'SKU-1',
    gold_rate_per_gram: null,
    gold_rate_date: null,
    final_selling_price: 0
  };
  await withControllerMocks({
    getProductById: async () => existingProduct,
    updateProduct: async (id, product) => {
      updatedProduct = product;
      return { ...existingProduct, ...product };
    }
  }, async ({ putProduct }) => {
    const res = responseRecorder();
    await putProduct({
      params: { id: '1' },
      body: {
        product_code: 'SKU-1',
        name: 'Gold Ring',
        category: 'Rings',
        updated_by: 'forged-user-id'
      },
      adminUser: { id: 12, user_id: 'authenticated-user-uuid' }
    }, res, (error) => { throw error; });

    assert.equal(res.statusCode, null);
    assert.equal(updatedProduct.updated_by, 'authenticated-user-uuid');
  });
});

test('the admin product list is scoped to the authenticated user without changing the public catalog list', async () => {
  const filters = [];
  const result = { products: [], pagination: {}, stats: {}, filters: {} };
  await withControllerMocks({
    listProducts: async (options) => {
      filters.push(options);
      return result;
    }
  }, async ({ getMyProducts, getProducts }) => {
    const mineResponse = responseRecorder();
    await getMyProducts({
      query: {},
      adminUser: { user_id: 'authenticated-user-uuid' }
    }, mineResponse, (error) => { throw error; });

    const publicResponse = responseRecorder();
    await getProducts({ query: {} }, publicResponse, (error) => { throw error; });

    assert.equal(filters[0].createdByUserId, 'authenticated-user-uuid');
    assert.equal(filters[1].createdByUserId, undefined);
    assert.equal(mineResponse.body, result);
    assert.equal(publicResponse.body, result);
  });
});

test('latest product codes are requested for the authenticated user UUID', async () => {
  let requestedUserId;
  await withControllerMocks({
    getLatestProductCode: async (userId) => {
      requestedUserId = userId;
      return 'GOLD-PRD-001';
    }
  }, async ({ latestProductCode }) => {
    const res = responseRecorder();
    await latestProductCode({
      adminUser: { user_id: 'authenticated-user-uuid' }
    }, res, (error) => { throw error; });

    assert.equal(requestedUserId, 'authenticated-user-uuid');
    assert.deepEqual(res.body, { latestCode: 'GOLD-PRD-001' });
  });
});

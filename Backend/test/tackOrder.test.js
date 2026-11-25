const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeTackOrder } = require('../src/controllers/tackOrderController');
const { getTackOrderProductsByIds } = require('../src/modules/tackOrderModule');
const { pool } = require('../src/config/db');

const product = {
  id: 12,
  name: 'Gold chain',
  category: 'Chain',
  purity: '22K',
  final_selling_price: 100,
  offer_price: 90,
  mrp: 120,
  status: 'Active'
};

const orderInput = (overrides = {}) => ({
  customer: {
    name: 'A Customer',
    phone: '9876543210',
    email: 'a@example.com',
    city: 'Chennai',
    district: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600001',
    address: '12 Gold Street'
  },
  items: [{
    product_id: 12,
    quantity: 2,
    variant_color: 'Yellow',
    variant_size: 'Free Size'
  }],
  gst_included: true,
  gst_rate: 10,
  discount_type: 'Fixed',
  discount_value: 10,
  advance_amount: 50,
  ...overrides
});

test('normalizes tack-order items and calculates total, advance, and balance from catalog prices', () => {
  const result = normalizeTackOrder(orderInput(), [product]);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.tackOrder.customer, {
    name: 'A Customer',
    phone: '9876543210',
    email: 'a@example.com',
    city: 'Chennai',
    district: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600001',
    address: '12 Gold Street'
  });
  assert.deepEqual(result.tackOrder.items[0], {
    product_id: 12,
    product_name: 'Gold chain',
    category: 'Chain',
    purity: '22K',
    variant_color: 'Yellow',
    variant_size: 'Free Size',
    quantity: 2,
    price: 100,
    total_price: 200
  });
  assert.equal(result.tackOrder.sub_total, 200);
  assert.equal(result.tackOrder.gst_amount, 20);
  assert.equal(result.tackOrder.discount_amount, 10);
  assert.equal(result.tackOrder.total_amount, 210);
  assert.equal(result.tackOrder.advance_amount, 50);
  assert.equal(result.tackOrder.balance_due, 160);
});

test('rejects invalid quantities, inactive products, and advances above the total', () => {
  assert.match(
    normalizeTackOrder(orderInput({
      items: [{ product_id: 12, quantity: 0 }]
    }), [product]).error,
    /quantity/i
  );
  assert.match(
    normalizeTackOrder(orderInput(), [{ ...product, status: 'Inactive' }]).error,
    /no longer active/i
  );
  assert.match(
    normalizeTackOrder(orderInput({ advance_amount: 999 }), [product]).error,
    /advance amount cannot exceed/i
  );
  assert.match(
    normalizeTackOrder(orderInput({
      customer: { ...orderInput().customer, pincode: '123' }
    }), [product]).error,
    /PIN code must contain 6 digits/i
  );
});

test('only resolves products owned by the authenticated shop', async () => {
  const originalExecute = pool.execute;
  let capturedQuery;
  pool.execute = async (query, values) => {
    capturedQuery = { query, values };
    return [[product], []];
  };
  try {
    assert.deepEqual(await getTackOrderProductsByIds([12], 'shop-user-1'), [product]);
  } finally {
    pool.execute = originalExecute;
  }
  assert.match(capturedQuery.query, /WHERE id IN \(\?\) AND created_by = \?/);
  assert.deepEqual(capturedQuery.values, [12, 'shop-user-1']);
});

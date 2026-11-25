const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeTackOrder } = require('../src/controllers/tackOrderController');
const { getTackOrderProductsByIds, listTackOrders } = require('../src/modules/tackOrderModule');
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

test('recalculates the unit price and stores the entered net weight', () => {
  const pricedProduct = {
    ...product,
    net_gold_weight: 2,
    gold_rate_per_gram: 100,
    making_charge_type: 'Fixed',
    making_charge: 10,
    wastage_type: 'Percentage',
    wastage: 0,
    stone_charges: 5,
    other_charges: 2,
    gst_rate: 0,
    price_includes_gst: false,
    offer_type: 'None',
    offer: 0,
    fixed_discount_amount: 0
  };
  const result = normalizeTackOrder(orderInput({
    items: [{
      product_id: 12,
      quantity: 2,
      variant_color: 'Yellow',
      variant_size: 'Free Size',
      net_gold_weight: 3
    }],
    discount_value: 0,
    advance_amount: 0
  }), [pricedProduct]);

  assert.equal(result.error, undefined);
  assert.equal(result.tackOrder.items[0].net_gold_weight, 3);
  assert.equal(result.tackOrder.items[0].price, 317);
  assert.equal(result.tackOrder.items[0].total_price, 634);
  assert.equal(result.tackOrder.sub_total, 634);
});

test('rejects invalid custom weight precision and scales price when no gold rate is available', () => {
  const pricedProduct = {
    ...product,
    net_gold_weight: 2,
    gold_rate_per_gram: 100,
    making_charge_type: 'Fixed',
    making_charge: 0,
    wastage_type: 'Fixed',
    wastage: 0,
    stone_charges: 0,
    other_charges: 0,
    gst_rate: 0,
    price_includes_gst: false,
    offer_type: 'None',
    offer: 0,
    fixed_discount_amount: 0
  };
  const customWeightOrder = (netGoldWeight) => orderInput({
    items: [{ product_id: 12, quantity: 1, net_gold_weight: netGoldWeight }],
    advance_amount: 0
  });

  assert.match(
    normalizeTackOrder(customWeightOrder(2.1234), [pricedProduct]).error,
    /at most 3 decimal places/i
  );
  const result = normalizeTackOrder(
    customWeightOrder(3),
    [{ ...pricedProduct, gold_rate_per_gram: null }]
  );
  assert.equal(result.error, undefined);
  assert.equal(result.tackOrder.items[0].price, 150);
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

test('lists only tack orders owned by the authenticated shop', async () => {
  const originalExecute = pool.execute;
  let capturedQuery;
  pool.execute = async (query, values) => {
    capturedQuery = { query, values };
    return [[{ id: 1, order_no: 'TACK-20261125-AB12CD34' }], []];
  };
  try {
    const orders = await listTackOrders('shop-user-1');
    assert.equal(orders[0].order_no, 'TACK-20261125-AB12CD34');
  } finally {
    pool.execute = originalExecute;
  }
  assert.match(capturedQuery.query, /WHERE user_id = \?/);
  assert.match(capturedQuery.query, /ORDER BY created_at DESC, id DESC/);
  assert.deepEqual(capturedQuery.values, ['shop-user-1']);
});

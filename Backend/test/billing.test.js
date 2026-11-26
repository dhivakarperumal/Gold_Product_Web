const assert = require('node:assert/strict');
const test = require('node:test');
const { mapSelectedProducts, normalizeBilling } = require('../src/controllers/billingController');
const { pool } = require('../src/config/db');
const { createBilling, getBillingById, listBillings } = require('../src/modules/billingModule');
const { getTackOrderById } = require('../src/modules/tackOrderModule');

const billingInput = (overrides = {}) => ({
  customers: [{
    name: 'A Customer',
    phone: '9876543210',
    email: 'a@example.com',
    address: '12 Gold Street'
  }],
  products: [
    { product_name: 'Gold chain', category: 'Chain', purity: '22K', price: 10000 },
    { product_name: 'Gold ring', category: 'Ring', purity: '18K', price: 5000 }
  ],
  exchanges: [],
  payment_type: 'FULL_PAYMENT',
  ...overrides
});

const currentRates = {
  rates: [
    { metal_type: 'Gold', purity: '916', rate_per_gram: 1000, rate_per_unit: 1000, rate_unit: 'gram' },
    { metal_type: 'Silver', purity: '999', rate_per_gram: 80, rate_per_unit: 80, rate_unit: 'gram' }
  ]
};
const exchangeItem = (overrides = {}) => ({
  product_name: 'Old chain',
  category: 'Chain',
  metal_type: 'Gold',
  purity: '22K',
  weight: 4,
  wastage_weight: 2,
  credit_amount: 1,
  ...overrides
});
const enabledTaxSettings = (gst_rate, tax_mode = 'Tax Exclusive') => ({
  gst_enabled: true,
  gst_rate,
  tax_mode
});

test('defaults GST to 0% for full-payment billing totals', () => {
  const result = normalizeBilling(billingInput());
  assert.equal(result.error, undefined);
  assert.equal(result.billing.sub_total, 15000);
  assert.equal(result.billing.gst_amount, 0);
  assert.equal(result.billing.total_amount, 15000);
  assert.match(result.billing.invoice_no, /^BILL-\d{8}-[A-F0-9]{8}$/);
});

test('preserves each customer address in the saved billing payload', () => {
  const result = normalizeBilling(billingInput());
  assert.equal(result.billing.customers[0].address, '12 Gold Street');
});

test('requires a phone number for every bill customer', () => {
  const input = billingInput();
  input.customers[0].phone = '';
  assert.match(normalizeBilling(input).error, /customers 1 phone is required/i);
});

test('deducts exchange credit before calculating configured GST', () => {
  const result = normalizeBilling(billingInput({
    payment_type: 'EXCHANGE_GOLD',
    gst_rate: 3,
    exchanges: [exchangeItem()]
  }), currentRates, enabledTaxSettings(3));
  assert.equal(result.error, undefined);
  assert.equal(result.billing.sub_total, 15000);
  assert.equal(result.billing.exchanges[0].metal_type, 'Gold');
  assert.equal(result.billing.exchanges[0].weight, 4);
  assert.equal(result.billing.exchanges[0].wastage_weight, 2);
  assert.equal(result.billing.exchanges[0].net_weight, 2);
  assert.equal(result.billing.exchanges[0].credit_amount, 2000);
  assert.equal(result.billing.gst_amount, 390);
  assert.equal(result.billing.total_amount, 13390);
});

test('values exchange credit using active daily rate and rejects wastage above weight', () => {
  const invalid = normalizeBilling(billingInput({
    payment_type: 'EXCHANGE_GOLD',
    exchanges: [exchangeItem({ weight: 2, wastage_weight: 3 })]
  }), currentRates);
  assert.match(invalid.error, /wastage weight cannot exceed/i);
});

test('generates an exchange item name when none is provided', () => {
  const unnamedItem = exchangeItem({ product_name: '' });
  delete unnamedItem.credit_amount;
  const result = normalizeBilling(billingInput({
    payment_type: 'EXCHANGE_GOLD',
    exchanges: [unnamedItem]
  }), currentRates);
  assert.equal(result.error, undefined);
  assert.equal(result.billing.exchanges[0].product_name, 'Gold 22K exchange item');
});

test('uses the selected metal purity daily rate for exchange credit', () => {
  const result = normalizeBilling(billingInput({
    payment_type: 'EXCHANGE_GOLD',
    exchanges: [exchangeItem({ metal_type: 'Silver', purity: '999', weight: 5, wastage_weight: 1 })]
  }), currentRates);
  assert.equal(result.error, undefined);
  assert.equal(result.billing.exchanges[0].net_weight, 4);
  assert.equal(result.billing.exchanges[0].credit_amount, 320);
  assert.equal(result.billing.exchanges[0].weight_unit, 'gram');
});

test('allows a manually entered exchange rate and calculates the exchange amount from it', () => {
  const result = normalizeBilling(billingInput({
    payment_type: 'EXCHANGE_GOLD',
    exchanges: [exchangeItem({ rate_per_unit: 1250 })]
  }), currentRates);
  assert.equal(result.error, undefined);
  assert.equal(result.billing.exchanges[0].rate_per_unit, 1250);
  assert.equal(result.billing.exchanges[0].credit_amount, 2500);
});

test('accepts a manual exchange rate when no daily rate is available', () => {
  const result = normalizeBilling(billingInput({
    payment_type: 'EXCHANGE_GOLD',
    exchanges: [exchangeItem({ rate_per_unit: 900 })]
  }));
  assert.equal(result.error, undefined);
  assert.equal(result.billing.exchanges[0].credit_amount, 1800);
});

test('rejects invalid manually entered exchange rates', () => {
  const result = normalizeBilling(billingInput({
    payment_type: 'EXCHANGE_GOLD',
    exchanges: [exchangeItem({ rate_per_unit: -1 })]
  }), currentRates);
  assert.match(result.error, /rate/i);
});

test('uses the owner tax settings instead of a client-supplied GST rate', () => {
  const result = normalizeBilling(billingInput({ gst_rate: 3.33 }));
  const configured = normalizeBilling(billingInput({ gst_rate: 100 }), null, enabledTaxSettings(3.33));
  assert.equal(result.error, undefined);
  assert.equal(result.billing.gst_amount, 0);
  assert.equal(configured.error, undefined);
  assert.equal(configured.billing.gst_amount, 499.5);
  assert.equal(configured.billing.total_amount, 15499.5);
});

test('calculates included GST without increasing the inclusive bill total', () => {
  const result = normalizeBilling(
    billingInput({ gst_rate: 99 }),
    null,
    enabledTaxSettings(12, 'Tax Inclusive')
  );
  assert.equal(result.error, undefined);
  assert.equal(result.billing.gst_amount, 1607.14);
  assert.equal(result.billing.total_amount, 15000);
  assert.equal(result.billing.gst_rate, 12);
  assert.equal(result.billing.tax_mode, 'Tax Inclusive');
});

test('applies a fixed discount before exchange credit and GST', () => {
  const result = normalizeBilling(billingInput({
    discount_amount: 1000,
    gst_rate: 3,
    payment_type: 'EXCHANGE_GOLD',
    exchanges: [exchangeItem()]
  }), currentRates, enabledTaxSettings(3));
  assert.equal(result.error, undefined);
  assert.equal(result.billing.discount_amount, 1000);
  assert.equal(result.billing.gst_amount, 360);
  assert.equal(result.billing.total_amount, 12360);
});

test('preserves tack-order quantity and custom net weight in billing totals', () => {
  const result = normalizeBilling(billingInput({
    products: [{
      product_id: 12,
      product_name: 'Custom chain',
      category: 'Chain',
      purity: '22K',
      net_gold_weight: 50.172,
      quantity: 2,
      price: 55.19
    }]
  }));
  assert.equal(result.error, undefined);
  assert.equal(result.billing.products[0].net_gold_weight, 50.172);
  assert.equal(result.billing.products[0].quantity, 2);
  assert.equal(result.billing.products[0].total_price, 110.38);
  assert.equal(result.billing.sub_total, 110.38);
});

test('preserves tack-order GST and discount amounts when converting to a bill', () => {
  const result = normalizeBilling(billingInput({
    products: [{ product_name: 'Tack item', category: 'Chain', purity: '22K', price: 499.4 }],
    discount_amount: 49.94,
  }), null, enabledTaxSettings(12), 59.93);
  assert.equal(result.error, undefined);
  assert.equal(result.billing.gst_amount, 59.93);
  assert.equal(result.billing.total_amount, 509.39);
});

test('rejects invalid billing quantities', () => {
  const result = normalizeBilling(billingInput({
    products: [{
      product_name: 'Gold chain',
      category: 'Chain',
      purity: '22K',
      price: 10000,
      quantity: 0
    }]
  }));
  assert.match(result.error, /quantity must be between 1 and 10000/i);
});

test('rejects discounts and exchange credits that exceed the products subtotal', () => {
  assert.match(normalizeBilling(billingInput({ discount_amount: 15001 })).error, /discount/i);
  assert.match(normalizeBilling(billingInput({
    discount_amount: 14000,
    payment_type: 'EXCHANGE_GOLD',
    exchanges: [exchangeItem()]
  }), currentRates).error, /cannot exceed/i);
});

test('rejects an invalid saved GST rate', () => {
  assert.match(normalizeBilling(billingInput(), null, enabledTaxSettings(-1)).error, /saved GST rate/i);
  assert.match(normalizeBilling(billingInput(), null, enabledTaxSettings(101)).error, /saved GST rate/i);
});

test('rejects exchange credits over subtotal and missing exchange items', () => {
  assert.match(normalizeBilling(billingInput({
    payment_type: 'EXCHANGE_GOLD',
    exchanges: [exchangeItem({ weight: 20, wastage_weight: 0 })]
  }), currentRates).error, /cannot exceed/i);
  assert.match(normalizeBilling(billingInput({ payment_type: 'EXCHANGE_GOLD' })).error, /at least one exchange/i);
});

test('uses catalog details and catalog price instead of client-submitted product values', () => {
  const selected = mapSelectedProducts([{
    product_id: 12,
    product_name: 'Forged product',
    category: 'Forged category',
    purity: '24K',
    price: 1
  }], [{
    id: 12,
    name: 'Catalog necklace',
    category: 'Necklace',
    purity: '22K',
    gross_weight: 8.25,
    net_gold_weight: 7.5,
    making_charge_type: 'Fixed Amount',
    making_charge: 1200,
    gold_rate_per_gram: 7200,
    offer_price: 12000,
    final_selling_price: 12500,
    mrp: 15000,
    status: 'Active'
  }]);
  assert.deepEqual(selected, {
    products: [{
      product_id: 12,
      quantity: 1,
      product_name: 'Catalog necklace',
      category: 'Necklace',
      purity: '22K',
      gross_weight: 8.25,
      net_gold_weight: 7.5,
      making_charge_type: 'Fixed Amount',
      making_charge: 1200,
      rate_per_gram: 7200,
      gold_value: null,
      mrp: 15000,
      offer_type: 'None',
      offer_price: 12000,
      discount_amount: 0,
      tax_amount: 0,
      price: 12500
    }]
  });
});

test('rejects products that are missing from or inactive in the catalog', () => {
  assert.match(mapSelectedProducts([{ product_id: 99 }], []).error, /no longer active/i);
  assert.match(mapSelectedProducts([{ product_id: 12 }], [{
    id: 12, name: 'Inactive', category: 'Ring', purity: '18K', status: 'Inactive'
  }]).error, /no longer active/i);
});

test('lists only bills owned by the authenticated user', async () => {
  const originalExecute = pool.execute;
  let capturedQuery;
  pool.execute = async (query, values) => {
    capturedQuery = { query, values };
    return [[{ id: 1 }], []];
  };
  try {
    const rows = await listBillings('shop-user-1');
    assert.deepEqual(rows, [{ id: 1 }]);
  } finally {
    pool.execute = originalExecute;
  }
  assert.match(capturedQuery.query, /WHERE b\.user_id = \?/);
  assert.deepEqual(capturedQuery.values, ['shop-user-1']);
});

test('only returns a bill when it belongs to the authenticated user', async () => {
  const originalExecute = pool.execute;
  let capturedQuery;
  pool.execute = async (query, values) => {
    capturedQuery = { query, values };
    return [[], []];
  };
  try {
    assert.equal(await getBillingById(42, 'shop-user-1'), null);
  } finally {
    pool.execute = originalExecute;
  }
  assert.match(capturedQuery.query, /WHERE b\.id = \? AND b\.user_id = \?/);
  assert.deepEqual(capturedQuery.values, [42, 'shop-user-1']);
});

test('only returns a tack order when it belongs to the authenticated user', async () => {
  const originalExecute = pool.execute;
  let capturedQuery;
  pool.execute = async (query, values) => {
    capturedQuery = { query, values };
    return [[], []];
  };
  try {
    assert.equal(await getTackOrderById(42, 'shop-user-1'), null);
  } finally {
    pool.execute = originalExecute;
  }
  assert.match(capturedQuery.query, /WHERE id = \? AND user_id = \?/);
  assert.deepEqual(capturedQuery.values, [42, 'shop-user-1']);
});

test('records a transferred tack-order advance with the bill and fund ledger atomically', async () => {
  const originalExecute = pool.execute;
  const originalGetConnection = pool.getConnection;
  const executions = [];
  let committed = false;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => { committed = true; },
    rollback: async () => {},
    release: () => {},
    execute: async (query, values) => {
      executions.push({ query, values });
      if (query.includes('INSERT INTO billings')) return [{ insertId: 84 }, []];
      if (query.includes('SELECT user_id FROM users')) return [[{ user_id: 'shop-user-1' }], []];
      if (query.includes('AS balance')) return [[{ balance: 0 }], []];
      return [{ insertId: 1 }, []];
    }
  };
  pool.getConnection = async () => connection;
  pool.execute = async (query, values) => {
    executions.push({ query, values });
    return [[{ id: 84, paid_amount: 25, balance_due: 75 }], []];
  };
  try {
    const bill = await createBilling({
      invoice_no: 'BILL-TEST',
      customers: [{ name: 'A Customer' }],
      products: [],
      exchanges: [],
      payment_type: 'FULL_PAYMENT',
      sub_total: 100,
      discount_amount: 0,
      gst_amount: 0,
      total_amount: 100
    }, 'shop-user-1', {
      amount: 25,
      payment_method: 'Other',
      payment_date: '2026-01-01 12:00:00',
      reference_number: 'TACK-TEST',
      idempotency_key: 'tack-order-advance:shop-user-1:42',
      created_by: 7,
      updated_by: 'shop-user-1',
      created_by_user_id: 'shop-user-1',
      admin_name: 'Shop Admin'
    });
    assert.deepEqual(bill, { id: 84, paid_amount: 25, balance_due: 75 });
  } finally {
    pool.execute = originalExecute;
    pool.getConnection = originalGetConnection;
  }
  assert.equal(committed, true);
  const billInsert = executions.find(({ query }) => query.includes('INSERT INTO billings'));
  assert.deepEqual(billInsert.values.slice(10, 12), ['25.00', '75.00']);
  const paymentInsert = executions.find(({ query }) => query.includes('INSERT INTO billing_payments'));
  assert.equal(paymentInsert.values[1], '25.00');
  const fundInsert = executions.find(({ query }) => query.includes('INSERT INTO funds'));
  assert.equal(fundInsert.values[2], 'CREDIT');
  assert.equal(fundInsert.values[4], '25.00');
});

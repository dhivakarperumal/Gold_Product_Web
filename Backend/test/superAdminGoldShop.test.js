const assert = require('node:assert/strict');
const test = require('node:test');
const {
  calculateEndDate,
  getPlanPrice,
  isValidDate
} = require('../src/modules/superAdminGoldShopModule');
const {
  validateShop,
  validateSubscription
} = require('../src/controllers/superAdminGoldShopController');

test('calculates subscription expiry with month-end clamping', () => {
  assert.equal(calculateEndDate('2024-01-31', 'monthly'), '2024-02-29');
  assert.equal(calculateEndDate('2023-11-30', 'quarterly'), '2024-02-29');
  assert.equal(calculateEndDate('2024-02-29', 'yearly'), '2025-02-28');
});

test('rejects invalid subscription dates without throwing', () => {
  assert.equal(isValidDate('2024-02-29'), true);
  assert.equal(isValidDate('2023-02-29'), false);
  assert.equal(isValidDate('9999-99-99'), false);
  assert.equal(validateSubscription({ planId: 1, duration: 'monthly', startDate: '9999-99-99' }).error,
    'Enter a valid subscription start date');
});

test('uses the database plan price for the selected duration', () => {
  assert.equal(getPlanPrice({
    plan_name: 'Standard',
    monthly_price: '700.00',
    quarterly_price: '2100.00',
    yearly_price: '8400.00',
    amount: 1
  }, 'quarterly'), 2100);
  assert.throws(() => getPlanPrice({ plan_name: 'Basic', monthly_price: 0 }, 'monthly'), /not configured/);
});

test('validates required shop identity and normalizes contact details', () => {
  const result = validateShop({
    shopName: '  Gold House ',
    ownerName: '  A Owner ',
    mobile: '+91 (98765) 43210',
    email: ' OWNER@EXAMPLE.COM ',
    maxBranches: '2',
    maxStaff: '5'
  }, { creating: true });

  assert.equal(result.error, undefined);
  assert.equal(result.shop.shop_name, 'Gold House');
  assert.equal(result.shop.owner_name, 'A Owner');
  assert.equal(result.shop.mobile, '+919876543210');
  assert.equal(result.shop.email, 'owner@example.com');
  assert.equal(validateShop({ maxBranches: 1, maxStaff: 1 }).error,
    'Shop name, owner name, and mobile number are required');
});

test('creation never accepts client-supplied price or paid status', () => {
  const result = validateSubscription({
    planId: 1,
    duration: 'monthly',
    startDate: '2024-01-31',
    amount: 0.01,
    paymentStatus: 'paid',
    subscriptionStatus: 'active'
  });

  assert.deepEqual(result.subscription, {
    plan_id: 1,
    duration: 'monthly',
    start_date: '2024-01-31'
  });
});

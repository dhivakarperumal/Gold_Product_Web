const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizePlan,
  SubscriptionPlanError
} = require('../src/modules/subscriptionPlanModule');

test('normalizes plan values and preserves independent prices', () => {
  const plan = normalizePlan({
    planName: ' Premium ',
    planCode: 'premium-01',
    monthlyPrice: 999,
    quarterlyPrice: 2700,
    halfYearlyPrice: 5200,
    yearlyPrice: 9999,
    maxBranches: 5,
    maxStaff: 10,
    maxUsers: 20,
    features: { salesBilling: true },
    status: 'active'
  });

  assert.equal(plan.plan_name, 'Premium');
  assert.equal(plan.plan_code, 'PREMIUM-01');
  assert.equal(plan.quarterly_price, 2700);
  assert.equal(plan.half_yearly_price, 5200);
  assert.equal(plan.yearly_price, 9999);
  assert.equal(plan.features.salesBilling, true);
});

test('rejects negative prices', () => {
  assert.throws(
    () => normalizePlan({ planName: 'Bad Plan', monthlyPrice: -1 }),
    SubscriptionPlanError
  );
});

test('rejects invalid plan status and unsafe limits', () => {
  assert.throws(
    () => normalizePlan({ planName: 'Plan', status: 'disabled' }),
    /status is invalid/
  );
  assert.throws(
    () => normalizePlan({ planName: 'Plan', maxBranches: 1.5 }),
    /max branches is invalid/
  );
});

const assert = require('node:assert/strict');
const test = require('node:test');
const { calculatePaidSubscriptionPeriod } = require('../src/modules/shopSubscriptionModule');

test('starts a paid month after the remaining active trial days', () => {
  assert.deepEqual(
    calculatePaidSubscriptionPeriod('2026-11-25', '2026-11-26', 'monthly'),
    {
      startDate: '2026-11-27',
      endDate: '2026-12-27',
      trialDays: 2,
      trialStartDate: '2026-11-25',
      trialEndDate: '2026-11-26'
    }
  );
});

test('starts the paid term immediately when no active trial remains', () => {
  assert.deepEqual(
    calculatePaidSubscriptionPeriod('2026-11-25', '2026-11-24', 'monthly'),
    {
      startDate: '2026-11-25',
      endDate: '2026-12-25',
      trialDays: 0,
      trialStartDate: null,
      trialEndDate: null
    }
  );
});

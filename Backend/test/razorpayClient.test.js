const assert = require('node:assert/strict');
const test = require('node:test');
const { createRazorpayOrder } = require('../src/services/razorpayClient');

const originalFetch = global.fetch;
const originalConsoleError = console.error;
const originalKeyId = process.env.RAZORPAY_KEY_ID;
const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;

test('logs Razorpay rejection details without exposing API credentials', async () => {
  const keyId = 'rzp_test_diagnostic_key';
  const keySecret = 'diagnostic_secret_value';
  process.env.RAZORPAY_KEY_ID = keyId;
  process.env.RAZORPAY_KEY_SECRET = keySecret;
  global.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({
      error: {
        code: 'AUTHENTICATION_ERROR',
        description: `Invalid credentials ${keySecret}`
      }
    })
  });
  let log;
  console.error = (...args) => {
    log = args;
  };

  try {
    await assert.rejects(
      createRazorpayOrder({ amount: 10000, currency: 'INR', receipt: 'test-receipt' }),
      /Razorpay could not process the payment request/
    );
    assert.deepEqual(log, [
      'Razorpay API request rejected',
      {
        status: 401,
        resource: 'orders',
        code: 'AUTHENTICATION_ERROR',
        description: 'Invalid credentials [redacted]'
      }
    ]);
    assert.equal(JSON.stringify(log).includes(keyId), false);
    assert.equal(JSON.stringify(log).includes(keySecret), false);
  } finally {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
    if (originalKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = originalKeyId;
    if (originalKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
  }
});

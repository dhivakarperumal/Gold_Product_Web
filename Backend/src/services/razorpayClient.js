const crypto = require('node:crypto');

class RazorpayClientError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function razorpayCredentials() {
  const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keyId || !keySecret) {
    throw new RazorpayClientError(503, 'Razorpay is not configured. Set its API key and secret before accepting payments.');
  }
  return { keyId, keySecret };
}

async function razorpayRequest(path, { method = 'GET', body } = {}) {
  const { keyId, keySecret } = razorpayCredentials();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal
    });
    let responseBody;
    try {
      responseBody = await response.json();
    } catch {
      throw new RazorpayClientError(502, 'Razorpay returned an unreadable response.');
    }
    if (!response.ok) {
      const providerError = responseBody?.error || {};
      const description = String(providerError.description || '')
        .slice(0, 200)
        .split(keyId).join('[redacted]')
        .split(keySecret).join('[redacted]');
      console.error('Razorpay API request rejected', {
        status: response.status,
        resource: String(path).split('/').filter(Boolean)[0] || 'unknown',
        code: String(providerError.code || 'UNKNOWN').slice(0, 80),
        description
      });
      throw new RazorpayClientError(502, 'Razorpay could not process the payment request.');
    }
    return responseBody;
  } catch (error) {
    if (error instanceof RazorpayClientError) throw error;
    if (error.name === 'AbortError') {
      throw new RazorpayClientError(504, 'Razorpay did not respond in time. Please try again.');
    }
    throw new RazorpayClientError(502, 'Razorpay is temporarily unavailable. Please try again.');
  } finally {
    clearTimeout(timeout);
  }
}

async function createRazorpayOrder(order) {
  const response = await razorpayRequest('/orders', { method: 'POST', body: order });
  if (!response?.id || response.amount !== order.amount || response.currency !== order.currency) {
    throw new RazorpayClientError(502, 'Razorpay returned an invalid order.');
  }
  return response;
}

async function getRazorpayPayment(paymentId) {
  if (!/^pay_[A-Za-z0-9]+$/.test(String(paymentId || ''))) {
    throw new RazorpayClientError(400, 'Razorpay payment ID is invalid.');
  }
  return razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
}

function signaturesMatch(expected, received) {
  if (!/^[a-f0-9]{64}$/i.test(String(expected || ''))
    || !/^[a-f0-9]{64}$/i.test(String(received || ''))) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}

function verifyCheckoutSignature(orderId, paymentId, signature) {
  const { keySecret } = razorpayCredentials();
  const expected = crypto.createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return signaturesMatch(expected, signature);
}

module.exports = {
  RazorpayClientError,
  createRazorpayOrder,
  getRazorpayPayment,
  razorpayCredentials,
  verifyCheckoutSignature
};

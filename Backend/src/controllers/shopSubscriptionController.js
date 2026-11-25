const {
  ShopSubscriptionError,
  createSubscriptionOrder,
  handleCapturedWebhook,
  listAvailableSubscriptionPlans,
  requestSubscriptionAssistance,
  verifySubscriptionCheckout
} = require('../modules/shopSubscriptionModule');
const {
  RazorpayClientError,
  verifyWebhookSignature
} = require('../services/razorpayClient');

const DURATIONS = new Set(['monthly', 'quarterly', 'half_yearly', 'yearly']);

function handleSubscriptionError(error, res, next) {
  if (error instanceof ShopSubscriptionError
    || error instanceof RazorpayClientError
    || Number.isInteger(error.status)) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

async function getPlans(req, res, next) {
  try {
    return res.json({ plans: await listAvailableSubscriptionPlans() });
  } catch (error) {
    return next(error);
  }
}

async function postAssistanceRequest(req, res, next) {
  try {
    await requestSubscriptionAssistance(req.subscriptionUser);
    return res.status(201).json({ message: 'Your subscription assistance request was sent to the Super Admin.' });
  } catch (error) {
    return handleSubscriptionError(error, res, next);
  }
}

async function postOrder(req, res, next) {
  const planId = Number(req.body?.planId);
  const duration = String(req.body?.duration || '').trim().toLowerCase();
  if (!Number.isSafeInteger(planId) || planId < 1) {
    return res.status(400).json({ message: 'Select a valid subscription plan.' });
  }
  if (!DURATIONS.has(duration)) {
    return res.status(400).json({ message: 'Select a valid subscription duration.' });
  }
  try {
    return res.status(201).json({
      message: 'Razorpay order created.',
      order: await createSubscriptionOrder(req.subscriptionUser, planId, duration)
    });
  } catch (error) {
    return handleSubscriptionError(error, res, next);
  }
}

async function postVerifyPayment(req, res, next) {
  try {
    return res.json({
      message: 'Subscription payment verified.',
      payment: await verifySubscriptionCheckout(req.subscriptionUser, req.body)
    });
  } catch (error) {
    return handleSubscriptionError(error, res, next);
  }
}

async function postWebhook(req, res, next) {
  const signature = req.get('x-razorpay-signature') || '';
  if (!Buffer.isBuffer(req.rawBody)) {
    return res.status(400).json({ message: 'Webhook request body is unavailable.' });
  }
  try {
    if (!verifyWebhookSignature(req.rawBody, signature)) {
      return res.status(401).json({ message: 'Razorpay webhook signature is invalid.' });
    }
    if (req.body?.event !== 'payment.captured') {
      return res.json({ received: true });
    }
    await handleCapturedWebhook(req.body?.payload?.payment?.entity);
    return res.json({ received: true });
  } catch (error) {
    return handleSubscriptionError(error, res, next);
  }
}

module.exports = {
  getPlans,
  postAssistanceRequest,
  postOrder,
  postVerifyPayment,
  postWebhook
};

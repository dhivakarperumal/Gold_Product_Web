const express = require('express');
const requireSubscriptionAccount = require('../middleware/requireSubscriptionAccount');
const {
  getPlans,
  postAssistanceRequest,
  postOrder,
  postVerifyPayment,
  postWebhook
} = require('../controllers/shopSubscriptionController');

const router = express.Router();

router.post('/razorpay/webhook', postWebhook);
router.use(requireSubscriptionAccount);
router.get('/plans', getPlans);
router.post('/requests', postAssistanceRequest);
router.post('/orders', postOrder);
router.post('/verify', postVerifyPayment);

module.exports = router;

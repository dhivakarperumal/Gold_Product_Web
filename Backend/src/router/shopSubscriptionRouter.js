const express = require('express');
const requireSubscriptionAccount = require('../middleware/requireSubscriptionAccount');
const {
  getPlans,
  postAssistanceRequest,
  postOrder,
  postVerifyPayment
} = require('../controllers/shopSubscriptionController');

const router = express.Router();

router.use(requireSubscriptionAccount);
router.get('/plans', getPlans);
router.post('/requests', postAssistanceRequest);
router.post('/orders', postOrder);
router.post('/verify', postVerifyPayment);

module.exports = router;

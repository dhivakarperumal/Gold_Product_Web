const express = require('express');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const subscriptionPlanController = require('../controllers/subscriptionPlanController');
const {
  deleteGoldShop,
  getGoldShop,
  getGoldShopPayments,
  getGoldShops,
  getPlans,
  patchGoldShopStatus,
  postGoldShop,
  postSubscription,
  putGoldShop
} = require('../controllers/superAdminGoldShopController');

const router = express.Router();

router.use(requireSuperAdmin);
router.get('/subscription-plans', subscriptionPlanController.getPlans);
router.post('/subscription-plans', subscriptionPlanController.postPlan);
router.get('/subscription-plans/:id', subscriptionPlanController.getPlan);
router.put('/subscription-plans/:id', subscriptionPlanController.putPlan);
router.patch('/subscription-plans/:id/status', subscriptionPlanController.patchPlanStatus);
router.post('/subscription-plans/:id/duplicate', subscriptionPlanController.duplicatePlan);
router.delete('/subscription-plans/:id', subscriptionPlanController.deletePlan);
router.get('/gold-shops', getGoldShops);
router.post('/gold-shops', postGoldShop);
router.get('/gold-shops/:id/payments', getGoldShopPayments);
router.post('/gold-shops/:id/subscription', postSubscription);
router.patch('/gold-shops/:id/status', patchGoldShopStatus);
router.get('/gold-shops/:id', getGoldShop);
router.put('/gold-shops/:id', putGoldShop);
router.delete('/gold-shops/:id', deleteGoldShop);

module.exports = router;

const express = require('express');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const { handleGoldShopDocumentUpload } = require('../middleware/goldShopDocumentUpload');
const subscriptionPlanController = require('../controllers/subscriptionPlanController');
const dashboardController = require('../controllers/superAdminDashboardController');
const revenueReportRouter = require('./revenueReportRouter');
const paymentManagementRouter = require('./paymentManagementRouter');
const {
  approveShop,
  deleteGoldShop,
  downloadGoldShopDocument,
  getGoldShop,
  getGoldShopPayments,
  getGoldShops,
  getPlans,
  patchGoldShopStatus,
  postGoldShop,
  postConfirmShopPayment,
  postSubscription,
  rejectShop,
  putGoldShop
} = require('../controllers/superAdminGoldShopController');

const router = express.Router();

router.use(requireSuperAdmin);
router.get('/dashboard/stats', dashboardController.getStats);
router.get('/dashboard/analytics', dashboardController.getAnalytics);
router.use('/revenue-reports', revenueReportRouter);
router.use('/payments', paymentManagementRouter);
router.get('/subscription-plans', subscriptionPlanController.getPlans);
router.post('/subscription-plans', subscriptionPlanController.postPlan);
router.get('/subscription-plans/:id', subscriptionPlanController.getPlan);
router.put('/subscription-plans/:id', subscriptionPlanController.putPlan);
router.patch('/subscription-plans/:id/status', subscriptionPlanController.patchPlanStatus);
router.post('/subscription-plans/:id/duplicate', subscriptionPlanController.duplicatePlan);
router.delete('/subscription-plans/:id', subscriptionPlanController.deletePlan);
router.get('/gold-shops', getGoldShops);
router.post('/gold-shops', handleGoldShopDocumentUpload, postGoldShop);
router.get('/gold-shops/:id/payments', getGoldShopPayments);
router.post('/gold-shops/:id/payments/:paymentId/confirm', postConfirmShopPayment);
router.get('/gold-shops/:id/documents/:documentId', downloadGoldShopDocument);
router.post('/gold-shops/:id/subscription', postSubscription);
router.post('/gold-shops/:id/approve', approveShop);
router.post('/gold-shops/:id/reject', rejectShop);
router.patch('/gold-shops/:id/status', patchGoldShopStatus);
router.get('/gold-shops/:id', getGoldShop);
router.put('/gold-shops/:id', handleGoldShopDocumentUpload, putGoldShop);
router.delete('/gold-shops/:id', deleteGoldShop);

module.exports = router;

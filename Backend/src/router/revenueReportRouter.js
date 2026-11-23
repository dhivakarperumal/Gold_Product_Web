const express = require('express');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const revenueReportController = require('../controllers/revenueReportController');

const router = express.Router();

router.use(requireSuperAdmin);

router.get('/overview', revenueReportController.getOverview);
router.get('/analytics', revenueReportController.getAnalytics);
router.get('/shop-revenue', revenueReportController.getShopRevenue);
router.get('/subscription-revenue', revenueReportController.getSubscriptionRevenue);
router.get('/payments', revenueReportController.getPayments);
router.get('/shops/:id/details', revenueReportController.getShopDetails);
router.get('/payments/:id/details', revenueReportController.getPaymentDetails);
router.post('/payments/:id/refund', revenueReportController.postRefund);
router.get('/export', revenueReportController.exportReport);

module.exports = router;

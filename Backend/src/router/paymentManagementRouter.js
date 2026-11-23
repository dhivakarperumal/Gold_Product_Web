const express = require('express');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const paymentManagementController = require('../controllers/paymentManagementController');

const router = express.Router();

router.use(requireSuperAdmin);

router.get('/overview', paymentManagementController.getOverview);
router.get('/', paymentManagementController.getPayments);
router.get('/:id', paymentManagementController.getPayment);
router.post('/:id/approve', paymentManagementController.postApprovePayment);
router.post('/:id/reject', paymentManagementController.postRejectPayment);
router.post('/:id/refund', paymentManagementController.postRefundPayment);

module.exports = router;

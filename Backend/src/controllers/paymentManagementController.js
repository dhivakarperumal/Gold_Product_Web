const paymentManagementModule = require('../modules/paymentManagementModule');

async function getOverview(req, res) {
  try {
    const data = await paymentManagementModule.getPaymentOverview();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching payment overview:', error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to fetch payment overview' });
  }
}

async function getPayments(req, res) {
  try {
    const data = await paymentManagementModule.listPayments(req.query);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching payments list:', error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to fetch payments list' });
  }
}

async function getPayment(req, res) {
  try {
    const { id } = req.params;
    const data = await paymentManagementModule.getPaymentById(Number(id));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to fetch payment details' });
  }
}

async function postApprovePayment(req, res) {
  try {
    const { id } = req.params;
    const result = await paymentManagementModule.approvePayment(
      Number(id),
      req.body || {},
      req.adminUser?.id
    );
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error approving payment:', error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to approve payment' });
  }
}

async function postRejectPayment(req, res) {
  try {
    const { id } = req.params;
    const result = await paymentManagementModule.rejectPayment(
      Number(id),
      req.body || {},
      req.adminUser?.id
    );
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error rejecting payment:', error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to reject payment' });
  }
}

async function postRefundPayment(req, res) {
  try {
    const { id } = req.params;
    const result = await paymentManagementModule.refundPayment(
      Number(id),
      req.body || {},
      req.adminUser?.id
    );
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error refunding payment:', error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to process refund' });
  }
}

module.exports = {
  getOverview,
  getPayments,
  getPayment,
  postApprovePayment,
  postRejectPayment,
  postRefundPayment
};

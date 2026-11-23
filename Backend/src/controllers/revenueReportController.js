const revenueReportModule = require('../modules/revenueReportModule');

async function getOverview(req, res) {
  try {
    const data = await revenueReportModule.getRevenueOverview(req.query);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching revenue overview:', error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to fetch revenue overview' });
  }
}

async function getAnalytics(req, res) {
  try {
    const data = await revenueReportModule.getRevenueAnalytics(req.query);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to fetch revenue analytics' });
  }
}

async function getShopRevenue(req, res) {
  try {
    const data = await revenueReportModule.getShopWiseRevenue(req.query);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching shop revenue:', error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to fetch shop-wise revenue' });
  }
}

async function getSubscriptionRevenue(req, res) {
  try {
    const data = await revenueReportModule.getSubscriptionRevenue(req.query);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching subscription revenue:', error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to fetch subscription revenue' });
  }
}

async function getPayments(req, res) {
  try {
    const data = await revenueReportModule.getPaymentTransactions(req.query);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching payment transactions:', error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to fetch payment transactions' });
  }
}

async function getShopDetails(req, res) {
  try {
    const { id } = req.params;
    const data = await revenueReportModule.getShopRevenueDetails(Number(id));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching shop revenue details:', error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to fetch shop revenue details' });
  }
}

async function getPaymentDetails(req, res) {
  try {
    const { id } = req.params;
    const data = await revenueReportModule.getPaymentDetails(Number(id));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to fetch payment details' });
  }
}

async function postRefund(req, res) {
  try {
    const { id } = req.params;
    const result = await revenueReportModule.recordPaymentRefund(Number(id), req.body, req.adminUser?.id);
    res.json({ success: true, data: result, message: 'Refund recorded successfully' });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to process refund' });
  }
}

async function exportReport(req, res) {
  try {
    const { reportType = 'payments', format = 'csv' } = req.query;

    if (reportType === 'shop_revenue') {
      const data = await revenueReportModule.getShopWiseRevenue({ ...req.query, limit: 1000 });
      if (format === 'csv') {
        const headers = ['S.No', 'Shop Name', 'Shop ID', 'Plan', 'Total Amount (INR)', 'Paid Amount (INR)', 'Pending Amount (INR)', 'Status', 'Last Payment Date'];
        const csvRows = [headers.join(',')];
        for (const item of data.items) {
          csvRows.push([
            item.sNo,
            `"${(item.shopName || '').replace(/"/g, '""')}"`,
            `"${item.shopCode || ''}"`,
            `"${item.planName || ''}"`,
            item.totalAmount.toFixed(2),
            item.paidAmount.toFixed(2),
            item.pendingAmount.toFixed(2),
            `"${item.paymentStatus}"`,
            `"${item.lastPaymentDate ? new Date(item.lastPaymentDate).toISOString().slice(0, 10) : 'N/A'}"`
          ].join(','));
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="shop_revenue_report.csv"');
        return res.send(csvRows.join('\r\n'));
      }
      return res.json({ success: true, data });
    }

    if (reportType === 'subscription_revenue') {
      const data = await revenueReportModule.getSubscriptionRevenue();
      if (format === 'csv') {
        const headers = ['Plan Name', 'Subscribers', 'Monthly Price (INR)', 'Active Subscriptions', 'Expired Subscriptions', 'Total Revenue (INR)', 'Revenue Share %'];
        const csvRows = [headers.join(',')];
        for (const item of data.items) {
          csvRows.push([
            `"${(item.planName || '').replace(/"/g, '""')}"`,
            item.subscribersCount,
            item.monthlyPrice.toFixed(2),
            item.activeSubscriptions,
            item.expiredSubscriptions,
            item.totalRevenue.toFixed(2),
            `${item.percentageShare}%`
          ].join(','));
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="subscription_revenue_report.csv"');
        return res.send(csvRows.join('\r\n'));
      }
      return res.json({ success: true, data });
    }

    // Default: payments history
    const data = await revenueReportModule.getPaymentTransactions({ ...req.query, limit: 2000 });
    if (format === 'csv') {
      const headers = ['Transaction ID', 'Invoice Number', 'Shop Name', 'Shop ID', 'Plan Name', 'Payment Date', 'Payment Method', 'Amount (INR)', 'Refunded (INR)', 'Status'];
      const csvRows = [headers.join(',')];
      for (const item of data.items) {
        csvRows.push([
          `"${(item.transactionId || '').replace(/"/g, '""')}"`,
          `"${(item.invoiceNumber || '').replace(/"/g, '""')}"`,
          `"${(item.shopName || '').replace(/"/g, '""')}"`,
          `"${item.shopCode || ''}"`,
          `"${item.planName || ''}"`,
          `"${item.paymentDate ? new Date(item.paymentDate).toISOString().slice(0, 10) : 'N/A'}"`,
          `"${item.paymentMethod || 'N/A'}"`,
          item.amount.toFixed(2),
          item.refundAmount.toFixed(2),
          `"${item.paymentStatus}"`
        ].join(','));
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="payment_history_report.csv"');
      return res.send(csvRows.join('\r\n'));
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({ message: 'Failed to export report' });
  }
}

module.exports = {
  getOverview,
  getAnalytics,
  getShopRevenue,
  getSubscriptionRevenue,
  getPayments,
  getShopDetails,
  getPaymentDetails,
  postRefund,
  exportReport
};

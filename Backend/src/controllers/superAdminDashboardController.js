const dashboardModule = require('../modules/superAdminDashboardModule');

async function getStats(req, res, next) {
  try {
    const data = await dashboardModule.getDashboardStats();
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function getAnalytics(req, res, next) {
  try {
    const data = await dashboardModule.getDashboardAnalytics();
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getStats, getAnalytics };

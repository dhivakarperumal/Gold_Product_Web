const { pool } = require('../config/db');

class RevenueReportError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Ensures required columns exist in the payments table
 * and backfills invoice numbers for historical records.
 */
async function initializeRevenueReportModule() {
  const [cols] = await pool.execute(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'"
  );
  const colSet = new Set(cols.map((c) => c.COLUMN_NAME));

  if (!colSet.has('invoice_number')) {
    await pool.query('ALTER TABLE payments ADD COLUMN invoice_number VARCHAR(100) NULL AFTER transaction_id');
  }
  if (!colSet.has('refund_amount')) {
    await pool.query('ALTER TABLE payments ADD COLUMN refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER amount');
  }
  if (!colSet.has('refund_date')) {
    await pool.query('ALTER TABLE payments ADD COLUMN refund_date DATETIME NULL AFTER payment_date');
  }
  if (!colSet.has('notes')) {
    await pool.query('ALTER TABLE payments ADD COLUMN notes TEXT NULL AFTER refund_date');
  }

  // Update enum if needed to allow 'failed' and 'refunded'
  const [statusCol] = await pool.execute(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'payment_status'"
  );
  const colType = statusCol[0]?.COLUMN_TYPE || '';
  if (!colType.includes('failed') || !colType.includes('refunded')) {
    await pool.query(
      "ALTER TABLE payments MODIFY COLUMN payment_status ENUM('paid','pending','unpaid','failed','refunded') NOT NULL DEFAULT 'pending'"
    );
  }

  // Backfill invoice numbers for existing records
  await pool.query(`
    UPDATE payments
    SET invoice_number = CONCAT('INV-', YEAR(COALESCE(payment_date, created_at)), '-', LPAD(id, 5, '0'))
    WHERE invoice_number IS NULL OR invoice_number = ''
  `);
}

/**
 * Helper to build date range WHERE clause for payments
 */
function buildDateCondition(startDate, endDate, prefix = 'p') {
  const conditions = [];
  const params = [];
  const dateField = `DATE(COALESCE(${prefix}.payment_date, ${prefix}.created_at))`;

  if (startDate) {
    conditions.push(`${dateField} >= ?`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`${dateField} <= ?`);
    params.push(endDate);
  }

  return { conditions, params };
}

/**
 * 1. Overview Summary Cards
 */
async function getRevenueOverview(filters = {}) {
  const { startDate, endDate, planId, status } = filters;

  // Base overall revenue metrics
  const [overallRows] = await pool.execute(`
    SELECT
      COALESCE(SUM(CASE WHEN p.payment_status = 'paid' THEN p.amount - COALESCE(p.refund_amount, 0) ELSE 0 END), 0) AS total_revenue,
      COALESCE(SUM(CASE WHEN p.payment_status = 'paid' AND DATE(COALESCE(p.payment_date, p.created_at)) = CURRENT_DATE() THEN p.amount - COALESCE(p.refund_amount, 0) ELSE 0 END), 0) AS today_revenue,
      COALESCE(SUM(CASE WHEN p.payment_status = 'paid' AND DATE(COALESCE(p.payment_date, p.created_at)) = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY) THEN p.amount - COALESCE(p.refund_amount, 0) ELSE 0 END), 0) AS yesterday_revenue,
      COALESCE(SUM(CASE WHEN p.payment_status = 'paid' AND YEAR(COALESCE(p.payment_date, p.created_at)) = YEAR(CURRENT_DATE()) AND MONTH(COALESCE(p.payment_date, p.created_at)) = MONTH(CURRENT_DATE()) THEN p.amount - COALESCE(p.refund_amount, 0) ELSE 0 END), 0) AS this_month_revenue,
      COALESCE(SUM(CASE WHEN p.payment_status = 'paid' AND YEAR(COALESCE(p.payment_date, p.created_at)) = YEAR(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)) AND MONTH(COALESCE(p.payment_date, p.created_at)) = MONTH(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)) THEN p.amount - COALESCE(p.refund_amount, 0) ELSE 0 END), 0) AS last_month_revenue,
      COALESCE(SUM(CASE WHEN p.payment_status = 'paid' AND YEAR(COALESCE(p.payment_date, p.created_at)) = YEAR(CURRENT_DATE()) THEN p.amount - COALESCE(p.refund_amount, 0) ELSE 0 END), 0) AS this_year_revenue,
      COALESCE(SUM(CASE WHEN p.payment_status = 'paid' AND YEAR(COALESCE(p.payment_date, p.created_at)) = YEAR(CURRENT_DATE()) - 1 THEN p.amount - COALESCE(p.refund_amount, 0) ELSE 0 END), 0) AS last_year_revenue,
      COALESCE(SUM(CASE WHEN p.payment_status = 'paid' AND p.subscription_id IS NOT NULL THEN p.amount - COALESCE(p.refund_amount, 0) ELSE 0 END), 0) AS total_subscription_revenue,
      COALESCE(SUM(CASE WHEN p.payment_status IN ('pending', 'unpaid') THEN p.amount ELSE 0 END), 0) AS pending_payments_amount,
      COUNT(CASE WHEN p.payment_status IN ('pending', 'unpaid') THEN 1 ELSE NULL END) AS pending_payments_count,
      COALESCE(SUM(CASE WHEN p.payment_status = 'failed' THEN p.amount ELSE 0 END), 0) AS failed_payments_amount,
      COUNT(CASE WHEN p.payment_status = 'failed' THEN 1 ELSE NULL END) AS failed_payments_count,
      COALESCE(SUM(CASE WHEN p.payment_status = 'refunded' THEN p.amount ELSE COALESCE(p.refund_amount, 0) END), 0) AS refunded_amount,
      COUNT(p.id) AS total_transactions,
      COUNT(CASE WHEN p.payment_status = 'paid' THEN 1 ELSE NULL END) AS paid_transactions
    FROM payments p
    JOIN gold_shops gs ON gs.id = p.gold_shop_id AND gs.deleted_at IS NULL
  `);

  const overall = overallRows[0] || {};

  // Active subscriptions count
  const [subCountRows] = await pool.execute(`
    SELECT
      COUNT(DISTINCT id) AS active_subscriptions,
      COUNT(DISTINCT gold_shop_id) AS active_subscribers
    FROM subscriptions
    WHERE subscription_status = 'active' AND end_date >= CURRENT_DATE()
  `);
  const activeSubs = subCountRows[0] || { active_subscriptions: 0, active_subscribers: 0 };

  // Total registered shops
  const [shopCountRows] = await pool.execute(`
    SELECT COUNT(*) AS total_shops FROM gold_shops WHERE deleted_at IS NULL
  `);
  const totalShops = shopCountRows[0]?.total_shops || 0;

  // Filtered metrics if date or plan or status filter applied
  const whereClauses = ['gs.deleted_at IS NULL'];
  const params = [];

  const { conditions: dateConds, params: dateParams } = buildDateCondition(startDate, endDate, 'p');
  if (dateConds.length) {
    whereClauses.push(...dateConds);
    params.push(...dateParams);
  }
  if (planId && planId !== 'all') {
    whereClauses.push('s.plan_id = ?');
    params.push(Number(planId));
  }
  if (status && status !== 'all') {
    whereClauses.push('p.payment_status = ?');
    params.push(status);
  }

  let filteredSummary = null;
  if (whereClauses.length > 1) {
    const [filteredRows] = await pool.execute(`
      SELECT
        COALESCE(SUM(CASE WHEN p.payment_status = 'paid' THEN p.amount - COALESCE(p.refund_amount, 0) ELSE 0 END), 0) AS filtered_revenue,
        COALESCE(SUM(CASE WHEN p.payment_status IN ('pending', 'unpaid') THEN p.amount ELSE 0 END), 0) AS filtered_pending,
        COUNT(p.id) AS filtered_transactions,
        COUNT(CASE WHEN p.payment_status = 'paid' THEN 1 ELSE NULL END) AS filtered_paid_count
      FROM payments p
      JOIN gold_shops gs ON gs.id = p.gold_shop_id
      LEFT JOIN subscriptions s ON s.id = p.subscription_id
      WHERE ${whereClauses.join(' AND ')}
    `, params);
    filteredSummary = filteredRows[0];
  }

  // Calculate percentage growth rates
  const todayRev = Number(overall.today_revenue || 0);
  const yestRev = Number(overall.yesterday_revenue || 0);
  const todayGrowth = yestRev > 0 ? Number((((todayRev - yestRev) / yestRev) * 100).toFixed(1)) : (todayRev > 0 ? 100 : 0);

  const monthRev = Number(overall.this_month_revenue || 0);
  const lastMonthRev = Number(overall.last_month_revenue || 0);
  const monthGrowth = lastMonthRev > 0 ? Number((((monthRev - lastMonthRev) / lastMonthRev) * 100).toFixed(1)) : (monthRev > 0 ? 100 : 0);

  const yearRev = Number(overall.this_year_revenue || 0);
  const lastYearRev = Number(overall.last_year_revenue || 0);
  const yearGrowth = lastYearRev > 0 ? Number((((yearRev - lastYearRev) / lastYearRev) * 100).toFixed(1)) : (yearRev > 0 ? 100 : 0);

  return {
    totalRevenue: Number(overall.total_revenue || 0),
    todayRevenue: todayRev,
    todayGrowth,
    thisMonthRevenue: monthRev,
    monthGrowth,
    thisYearRevenue: yearRev,
    yearGrowth,
    totalSubscriptionRevenue: Number(overall.total_subscription_revenue || 0),
    pendingPaymentsAmount: Number(overall.pending_payments_amount || 0),
    pendingPaymentsCount: Number(overall.pending_payments_count || 0),
    failedPaymentsAmount: Number(overall.failed_payments_amount || 0),
    failedPaymentsCount: Number(overall.failed_payments_count || 0),
    refundedAmount: Number(overall.refunded_amount || 0),
    totalTransactions: Number(overall.total_transactions || 0),
    paidTransactions: Number(overall.paid_transactions || 0),
    activeSubscriptions: Number(activeSubs.active_subscriptions || 0),
    activeSubscribers: Number(activeSubs.active_subscribers || 0),
    totalGoldShops: Number(totalShops || 0),
    filteredSummary: filteredSummary ? {
      filteredRevenue: Number(filteredSummary.filtered_revenue || 0),
      filteredPending: Number(filteredSummary.filtered_pending || 0),
      filteredTransactions: Number(filteredSummary.filtered_transactions || 0),
      filteredPaidCount: Number(filteredSummary.filtered_paid_count || 0)
    } : null
  };
}

/**
 * 2. Revenue Analytics (Daily, Weekly, Monthly, Yearly, Growth)
 */
async function getRevenueAnalytics(filters = {}) {
  const { startDate, endDate, planId } = filters;

  // Monthly revenue for the current year (12 months)
  const currentYear = new Date().getFullYear();
  const [monthlyRows] = await pool.execute(`
    SELECT
      MONTH(COALESCE(p.payment_date, p.created_at)) AS month_num,
      SUM(CASE WHEN p.payment_status = 'paid' THEN p.amount - COALESCE(p.refund_amount, 0) ELSE 0 END) AS revenue,
      COUNT(CASE WHEN p.payment_status = 'paid' THEN 1 ELSE NULL END) AS transaction_count
    FROM payments p
    JOIN gold_shops gs ON gs.id = p.gold_shop_id AND gs.deleted_at IS NULL
    WHERE YEAR(COALESCE(p.payment_date, p.created_at)) = ?
    GROUP BY month_num
    ORDER BY month_num ASC
  `, [currentYear]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyMap = new Map();
  for (const row of monthlyRows) {
    monthlyMap.set(Number(row.month_num), {
      revenue: Number(row.revenue || 0),
      count: Number(row.transaction_count || 0)
    });
  }

  const monthly = monthNames.map((name, index) => {
    const monthNum = index + 1;
    const entry = monthlyMap.get(monthNum) || { revenue: 0, count: 0 };
    return {
      month: monthNum,
      label: name,
      revenue: entry.revenue,
      count: entry.count
    };
  });

  // Daily revenue (last 30 days or filtered range)
  let dailyQuery = `
    SELECT
      DATE_FORMAT(COALESCE(p.payment_date, p.created_at), '%Y-%m-%d') AS date_str,
      DATE_FORMAT(COALESCE(p.payment_date, p.created_at), '%d %b') AS label,
      SUM(CASE WHEN p.payment_status = 'paid' THEN p.amount - COALESCE(p.refund_amount, 0) ELSE 0 END) AS revenue,
      COUNT(CASE WHEN p.payment_status = 'paid' THEN 1 ELSE NULL END) AS count
    FROM payments p
    JOIN gold_shops gs ON gs.id = p.gold_shop_id AND gs.deleted_at IS NULL
    WHERE p.payment_status = 'paid'
  `;
  const dailyParams = [];
  if (startDate && endDate) {
    dailyQuery += ' AND DATE(COALESCE(p.payment_date, p.created_at)) BETWEEN ? AND ?';
    dailyParams.push(startDate, endDate);
  } else {
    dailyQuery += ' AND DATE(COALESCE(p.payment_date, p.created_at)) >= DATE_SUB(CURRENT_DATE(), INTERVAL 29 DAY)';
  }
  dailyQuery += ' GROUP BY date_str, label ORDER BY date_str ASC';

  const [dailyRows] = await pool.execute(dailyQuery, dailyParams);

  // Weekly revenue for the last 12 weeks
  const [weeklyRows] = await pool.execute(`
    SELECT
      YEARWEEK(COALESCE(p.payment_date, p.created_at), 1) AS yw,
      MIN(DATE_FORMAT(COALESCE(p.payment_date, p.created_at), '%d %b')) AS start_label,
      SUM(CASE WHEN p.payment_status = 'paid' THEN p.amount - COALESCE(p.refund_amount, 0) ELSE 0 END) AS revenue,
      COUNT(CASE WHEN p.payment_status = 'paid' THEN 1 ELSE NULL END) AS count
    FROM payments p
    JOIN gold_shops gs ON gs.id = p.gold_shop_id AND gs.deleted_at IS NULL
    WHERE p.payment_status = 'paid'
      AND COALESCE(p.payment_date, p.created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 WEEK)
    GROUP BY yw
    ORDER BY yw ASC
  `);

  const weekly = weeklyRows.map((r, i) => ({
    week: String(r.yw),
    label: `Wk ${i + 1} (${r.start_label || ''})`,
    revenue: Number(r.revenue || 0),
    count: Number(r.count || 0)
  }));

  // Yearly revenue (past 5 years)
  const [yearlyRows] = await pool.execute(`
    SELECT
      YEAR(COALESCE(p.payment_date, p.created_at)) AS year_val,
      SUM(CASE WHEN p.payment_status = 'paid' THEN p.amount - COALESCE(p.refund_amount, 0) ELSE 0 END) AS revenue,
      COUNT(CASE WHEN p.payment_status = 'paid' THEN 1 ELSE NULL END) AS count
    FROM payments p
    JOIN gold_shops gs ON gs.id = p.gold_shop_id AND gs.deleted_at IS NULL
    WHERE p.payment_status = 'paid'
    GROUP BY year_val
    ORDER BY year_val ASC
  `);

  const yearly = yearlyRows.map((r) => ({
    year: r.year_val,
    label: String(r.year_val),
    revenue: Number(r.revenue || 0),
    count: Number(r.count || 0)
  }));

  // Growth calculation based on monthly progression
  let cumulative = 0;
  const growth = monthly.map((item, idx) => {
    cumulative += item.revenue;
    const prevRevenue = idx > 0 ? monthly[idx - 1].revenue : 0;
    const rate = prevRevenue > 0
      ? Number((((item.revenue - prevRevenue) / prevRevenue) * 100).toFixed(1))
      : (item.revenue > 0 ? 100 : 0);
    return {
      label: item.label,
      revenue: item.revenue,
      cumulative,
      growthRate: rate
    };
  });

  return {
    daily: dailyRows.map((r) => ({
      date: r.date_str,
      label: r.label,
      revenue: Number(r.revenue || 0),
      count: Number(r.count || 0)
    })),
    weekly,
    monthly,
    yearly,
    growth
  };
}

/**
 * 3. Shop-wise Revenue List
 */
async function getShopWiseRevenue(params = {}) {
  const {
    search = '',
    planId,
    status = 'all',
    page = 1,
    limit = 10,
    sortBy = 'total_amount',
    sortOrder = 'DESC'
  } = params;

  const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
  const safeLimit = Math.max(1, Math.min(100, Number(limit)));

  const whereClauses = ['gs.deleted_at IS NULL'];
  const queryParams = [];

  if (search.trim()) {
    whereClauses.push('(gs.shop_name LIKE ? OR gs.shop_code LIKE ? OR gs.owner_name LIKE ? OR gs.mobile LIKE ?)');
    const term = `%${search.trim()}%`;
    queryParams.push(term, term, term, term);
  }

  // Count total matching shops
  const [countResult] = await pool.execute(`
    SELECT COUNT(DISTINCT gs.id) AS total
    FROM gold_shops gs
    WHERE ${whereClauses.join(' AND ')}
  `, queryParams);
  const total = countResult[0]?.total || 0;

  // Ordering validation
  const validSortCols = {
    total_amount: 'total_amount',
    paid_amount: 'paid_amount',
    pending_amount: 'pending_amount',
    shop_name: 'gs.shop_name',
    shop_code: 'gs.shop_code',
    last_payment_date: 'pay_stats.last_payment_date'
  };
  const sortColumn = validSortCols[sortBy] || 'total_amount';
  const orderDirection = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const sql = `
    SELECT
      gs.id AS shop_id,
      gs.shop_code,
      gs.shop_name,
      gs.owner_name,
      gs.mobile,
      gs.email,
      gs.city,
      gs.status AS shop_status,
      COALESCE(latest_sub.plan_name, 'No Plan') AS plan_name,
      COALESCE(latest_sub.duration, 'N/A') AS subscription_duration,
      COALESCE(latest_sub.subscription_status, 'none') AS subscription_status,
      COALESCE(sub_stats.total_subscription_amount, 0) AS total_amount,
      COALESCE(pay_stats.paid_amount, 0) AS paid_amount,
      GREATEST(0, COALESCE(sub_stats.total_subscription_amount, 0) - COALESCE(pay_stats.paid_amount, 0)) AS pending_amount,
      CASE
        WHEN COALESCE(pay_stats.paid_amount, 0) >= COALESCE(sub_stats.total_subscription_amount, 0) AND COALESCE(sub_stats.total_subscription_amount, 0) > 0 THEN 'paid'
        WHEN COALESCE(pay_stats.paid_amount, 0) > 0 THEN 'partial'
        WHEN COALESCE(sub_stats.total_subscription_amount, 0) > 0 THEN 'pending'
        ELSE 'unpaid'
      END AS payment_status,
      pay_stats.last_payment_date,
      COALESCE(pay_stats.transaction_count, 0) AS transaction_count
    FROM gold_shops gs
    LEFT JOIN (
      SELECT
        s.gold_shop_id,
        SUM(s.amount) AS total_subscription_amount,
        COUNT(s.id) AS subscription_count
      FROM subscriptions s
      GROUP BY s.gold_shop_id
    ) sub_stats ON sub_stats.gold_shop_id = gs.id
    LEFT JOIN (
      SELECT
        p.gold_shop_id,
        SUM(CASE WHEN p.payment_status = 'paid' THEN p.amount - COALESCE(p.refund_amount, 0) ELSE 0 END) AS paid_amount,
        MAX(CASE WHEN p.payment_status = 'paid' THEN COALESCE(p.payment_date, p.created_at) ELSE NULL END) AS last_payment_date,
        COUNT(p.id) AS transaction_count
      FROM payments p
      GROUP BY p.gold_shop_id
    ) pay_stats ON pay_stats.gold_shop_id = gs.id
    LEFT JOIN (
      SELECT
        s1.gold_shop_id,
        sp.plan_name,
        s1.duration,
        s1.subscription_status
      FROM subscriptions s1
      JOIN subscription_plans sp ON sp.id = s1.plan_id
      WHERE s1.id = (
        SELECT MAX(s2.id) FROM subscriptions s2 WHERE s2.gold_shop_id = s1.gold_shop_id
      )
    ) latest_sub ON latest_sub.gold_shop_id = gs.id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY ${sortColumn} ${orderDirection}
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [...queryParams, safeLimit, offset]);

  // Compute status filter in JS if provided
  let filteredRows = rows.map((r, i) => ({
    sNo: offset + i + 1,
    shopId: r.shop_id,
    shopCode: r.shop_code,
    shopName: r.shop_name,
    ownerName: r.owner_name,
    mobile: r.mobile,
    email: r.email,
    city: r.city,
    shopStatus: r.shop_status,
    planName: r.plan_name,
    subscriptionDuration: r.subscription_duration,
    subscriptionStatus: r.subscription_status,
    totalAmount: Number(r.total_amount || 0),
    paidAmount: Number(r.paid_amount || 0),
    pendingAmount: Number(r.pending_amount || 0),
    paymentStatus: r.payment_status,
    lastPaymentDate: r.last_payment_date,
    transactionCount: Number(r.transaction_count || 0)
  }));

  if (status && status !== 'all') {
    filteredRows = filteredRows.filter((r) => r.paymentStatus === status);
  }

  return {
    items: filteredRows,
    pagination: {
      total,
      page: Number(page),
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit)
    }
  };
}

/**
 * 4. Subscription Revenue based on Plans
 */
async function getSubscriptionRevenue() {
  const [rows] = await pool.execute(`
    SELECT
      sp.id AS plan_id,
      sp.plan_name,
      sp.monthly_price,
      sp.quarterly_price,
      sp.yearly_price,
      sp.status AS plan_status,
      COUNT(DISTINCT s.gold_shop_id) AS subscribers_count,
      COUNT(DISTINCT s.id) AS total_subscriptions_count,
      COUNT(DISTINCT CASE WHEN s.subscription_status = 'active' AND s.end_date >= CURRENT_DATE() THEN s.id END) AS active_subscriptions,
      COUNT(DISTINCT CASE WHEN s.subscription_status = 'expired' OR (s.subscription_status = 'active' AND s.end_date < CURRENT_DATE()) THEN s.id END) AS expired_subscriptions,
      COUNT(DISTINCT CASE WHEN s.subscription_status = 'pending' THEN s.id END) AS pending_subscriptions,
      COALESCE(SUM(CASE WHEN p.payment_status = 'paid' THEN p.amount - COALESCE(p.refund_amount, 0) ELSE 0 END), 0) AS total_revenue,
      COALESCE(SUM(CASE WHEN p.payment_status IN ('pending', 'unpaid') THEN p.amount ELSE 0 END), 0) AS pending_revenue
    FROM subscription_plans sp
    LEFT JOIN subscriptions s ON s.plan_id = sp.id
    LEFT JOIN payments p ON p.subscription_id = s.id
    GROUP BY sp.id, sp.plan_name, sp.monthly_price, sp.quarterly_price, sp.yearly_price, sp.status
    ORDER BY total_revenue DESC, sp.id ASC
  `);

  const totalAllRevenue = rows.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0);

  const items = rows.map((r) => {
    const rev = Number(r.total_revenue || 0);
    const share = totalAllRevenue > 0 ? Number(((rev / totalAllRevenue) * 100).toFixed(1)) : 0;
    return {
      planId: r.plan_id,
      planName: r.plan_name,
      monthlyPrice: Number(r.monthly_price || 0),
      quarterlyPrice: Number(r.quarterly_price || 0),
      yearlyPrice: Number(r.yearly_price || 0),
      planStatus: r.plan_status,
      subscribersCount: Number(r.subscribers_count || 0),
      totalSubscriptionsCount: Number(r.total_subscriptions_count || 0),
      activeSubscriptions: Number(r.active_subscriptions || 0),
      expiredSubscriptions: Number(r.expired_subscriptions || 0),
      pendingSubscriptions: Number(r.pending_subscriptions || 0),
      totalRevenue: rev,
      pendingRevenue: Number(r.pending_revenue || 0),
      percentageShare: share
    };
  });

  return {
    items,
    totalAllRevenue
  };
}

/**
 * 5. Payment Transaction History
 */
async function getPaymentTransactions(params = {}) {
  const {
    search = '',
    planId,
    status = 'all',
    startDate,
    endDate,
    paymentMethod,
    page = 1,
    limit = 10,
    sortBy = 'id',
    sortOrder = 'DESC'
  } = params;

  const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
  const safeLimit = Math.max(1, Math.min(100, Number(limit)));

  const whereClauses = ['gs.deleted_at IS NULL'];
  const queryParams = [];

  if (search.trim()) {
    whereClauses.push('(p.transaction_id LIKE ? OR p.invoice_number LIKE ? OR gs.shop_name LIKE ? OR gs.shop_code LIKE ?)');
    const term = `%${search.trim()}%`;
    queryParams.push(term, term, term, term);
  }

  if (status && status !== 'all') {
    whereClauses.push('p.payment_status = ?');
    queryParams.push(status);
  }

  if (planId && planId !== 'all') {
    whereClauses.push('s.plan_id = ?');
    queryParams.push(Number(planId));
  }

  if (paymentMethod && paymentMethod !== 'all') {
    whereClauses.push('p.payment_method = ?');
    queryParams.push(paymentMethod);
  }

  const { conditions: dateConds, params: dateParams } = buildDateCondition(startDate, endDate, 'p');
  if (dateConds.length) {
    whereClauses.push(...dateConds);
    queryParams.push(...dateParams);
  }

  const whereSql = whereClauses.join(' AND ');

  const [countResult] = await pool.execute(`
    SELECT COUNT(p.id) AS total
    FROM payments p
    JOIN gold_shops gs ON gs.id = p.gold_shop_id
    LEFT JOIN subscriptions s ON s.id = p.subscription_id
    WHERE ${whereSql}
  `, queryParams);
  const total = countResult[0]?.total || 0;

  const validSortCols = {
    id: 'p.id',
    payment_date: 'COALESCE(p.payment_date, p.created_at)',
    amount: 'p.amount',
    shop_name: 'gs.shop_name'
  };
  const sortCol = validSortCols[sortBy] || 'p.id';
  const orderDir = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const sql = `
    SELECT
      p.id,
      p.gold_shop_id,
      p.subscription_id,
      COALESCE(p.transaction_id, 'PENDING') AS transaction_id,
      COALESCE(p.invoice_number, CONCAT('INV-', YEAR(COALESCE(p.payment_date, p.created_at)), '-', LPAD(p.id, 5, '0'))) AS invoice_number,
      p.amount,
      p.refund_amount,
      p.payment_method,
      p.payment_status,
      p.payment_date,
      p.created_at,
      p.notes,
      gs.shop_name,
      gs.shop_code,
      gs.owner_name,
      gs.mobile,
      gs.email,
      COALESCE(sp.plan_name, 'Custom') AS plan_name,
      s.duration,
      s.start_date,
      s.end_date,
      s.subscription_status,
      creator.username AS created_by_name
    FROM payments p
    JOIN gold_shops gs ON gs.id = p.gold_shop_id
    LEFT JOIN subscriptions s ON s.id = p.subscription_id
    LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
    LEFT JOIN users creator ON creator.id = p.created_by
    WHERE ${whereSql}
    ORDER BY ${sortCol} ${orderDir}
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [...queryParams, safeLimit, offset]);

  const items = rows.map((r) => ({
    id: r.id,
    transactionId: r.transaction_id,
    invoiceNumber: r.invoice_number,
    shopId: r.gold_shop_id,
    shopCode: r.shop_code,
    shopName: r.shop_name,
    ownerName: r.owner_name,
    mobile: r.mobile,
    email: r.email,
    planName: r.plan_name,
    duration: r.duration,
    startDate: r.start_date,
    endDate: r.end_date,
    amount: Number(r.amount || 0),
    refundAmount: Number(r.refund_amount || 0),
    paymentMethod: r.payment_method || 'N/A',
    paymentStatus: r.payment_status,
    paymentDate: r.payment_date || r.created_at,
    createdAt: r.created_at,
    notes: r.notes,
    createdByName: r.created_by_name || 'System'
  }));

  return {
    items,
    pagination: {
      total,
      page: Number(page),
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit)
    }
  };
}

/**
 * 8. Revenue Details for a Single Shop
 */
async function getShopRevenueDetails(shopId) {
  const [shopRows] = await pool.execute(`
    SELECT
      gs.id, gs.shop_uuid, gs.shop_code, gs.shop_name, gs.owner_name,
      gs.mobile, gs.email, gs.gst_number, gs.address, gs.city, gs.state,
      gs.pincode, gs.status, gs.notes, gs.created_at, gs.approved_at
    FROM gold_shops gs
    WHERE gs.id = ? AND gs.deleted_at IS NULL
  `, [shopId]);

  if (!shopRows.length) {
    throw new RevenueReportError(404, 'Gold Shop not found');
  }
  const shop = shopRows[0];

  // Subscriptions for this shop
  const [subRows] = await pool.execute(`
    SELECT
      s.id, s.plan_id, s.duration, s.amount, s.start_date, s.end_date,
      s.payment_status, s.subscription_status, s.created_at,
      sp.plan_name, sp.monthly_price
    FROM subscriptions s
    LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE s.gold_shop_id = ?
    ORDER BY s.id DESC
  `, [shopId]);

  // Payments for this shop
  const [payRows] = await pool.execute(`
    SELECT
      p.id, p.subscription_id, p.transaction_id, p.invoice_number,
      p.amount, p.refund_amount, p.payment_method, p.payment_status,
      p.payment_date, p.created_at, p.notes,
      creator.username AS created_by_name
    FROM payments p
    LEFT JOIN users creator ON creator.id = p.created_by
    WHERE p.gold_shop_id = ?
    ORDER BY p.id DESC
  `, [shopId]);

  // Totals
  const totalInvoiced = subRows.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const totalPaid = payRows
    .filter((p) => p.payment_status === 'paid')
    .reduce((sum, p) => sum + (Number(p.amount || 0) - Number(p.refund_amount || 0)), 0);
  const totalRefunded = payRows
    .reduce((sum, p) => sum + Number(p.refund_amount || 0), 0);
  const pendingBalance = Math.max(0, totalInvoiced - totalPaid);

  return {
    shop,
    subscriptions: subRows,
    payments: payRows.map((p) => ({
      ...p,
      amount: Number(p.amount || 0),
      refund_amount: Number(p.refund_amount || 0)
    })),
    financialSummary: {
      totalInvoiced,
      totalPaid,
      totalRefunded,
      pendingBalance,
      isFullyPaid: pendingBalance === 0 && totalInvoiced > 0
    }
  };
}

/**
 * 8b. Single Payment Transaction Details (for Invoice / Receipt Modal)
 */
async function getPaymentDetails(paymentId) {
  const [rows] = await pool.execute(`
    SELECT
      p.id,
      p.gold_shop_id,
      p.subscription_id,
      p.transaction_id,
      COALESCE(p.invoice_number, CONCAT('INV-', YEAR(COALESCE(p.payment_date, p.created_at)), '-', LPAD(p.id, 5, '0'))) AS invoice_number,
      p.amount,
      p.refund_amount,
      p.payment_method,
      p.payment_status,
      p.payment_date,
      p.created_at,
      p.notes,
      gs.shop_name,
      gs.shop_code,
      gs.owner_name,
      gs.mobile,
      gs.email,
      gs.gst_number,
      gs.address,
      gs.city,
      gs.state,
      gs.pincode,
      sp.plan_name,
      s.duration,
      s.start_date,
      s.end_date,
      s.subscription_status,
      creator.username AS created_by_name
    FROM payments p
    JOIN gold_shops gs ON gs.id = p.gold_shop_id
    LEFT JOIN subscriptions s ON s.id = p.subscription_id
    LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
    LEFT JOIN users creator ON creator.id = p.created_by
    WHERE p.id = ?
  `, [paymentId]);

  if (!rows.length) {
    throw new RevenueReportError(404, 'Payment record not found');
  }

  const r = rows[0];
  return {
    id: r.id,
    transactionId: r.transaction_id || 'PENDING',
    invoiceNumber: r.invoice_number,
    amount: Number(r.amount || 0),
    refundAmount: Number(r.refund_amount || 0),
    netAmount: Number(r.amount || 0) - Number(r.refund_amount || 0),
    paymentMethod: r.payment_method || 'N/A',
    paymentStatus: r.payment_status,
    paymentDate: r.payment_date || r.created_at,
    createdAt: r.created_at,
    notes: r.notes,
    createdByName: r.created_by_name || 'System',
    shop: {
      id: r.gold_shop_id,
      name: r.shop_name,
      code: r.shop_code,
      owner: r.owner_name,
      mobile: r.mobile,
      email: r.email,
      gst: r.gst_number,
      address: r.address,
      city: r.city,
      state: r.state,
      pincode: r.pincode
    },
    subscription: {
      id: r.subscription_id,
      planName: r.plan_name,
      duration: r.duration,
      startDate: r.start_date,
      endDate: r.end_date,
      status: r.subscription_status
    }
  };
}

/**
 * Handle Payment Refund
 */
async function recordPaymentRefund(paymentId, input = {}, actorId = null) {
  const { refundAmount, reason } = input;
  const numRefund = Number(refundAmount);
  if (!Number.isFinite(numRefund) || numRefund <= 0) {
    throw new RevenueReportError(400, 'Valid refund amount is required');
  }

  const [payments] = await pool.execute(
    'SELECT id, amount, refund_amount, payment_status FROM payments WHERE id = ?',
    [paymentId]
  );
  const payment = payments[0];
  if (!payment) throw new RevenueReportError(404, 'Payment not found');
  if (payment.payment_status !== 'paid') {
    throw new RevenueReportError(409, 'Only paid transactions can be refunded');
  }

  const existingRefund = Number(payment.refund_amount || 0);
  const maxRefundAllowed = Number(payment.amount) - existingRefund;
  if (numRefund > maxRefundAllowed) {
    throw new RevenueReportError(400, `Refund cannot exceed remaining paid balance of ₹${maxRefundAllowed.toFixed(2)}`);
  }

  const newTotalRefund = existingRefund + numRefund;
  const newStatus = newTotalRefund >= Number(payment.amount) ? 'refunded' : 'paid';

  await pool.execute(`
    UPDATE payments
    SET refund_amount = ?, refund_date = CURRENT_TIMESTAMP, payment_status = ?, notes = ?, updated_by = ?
    WHERE id = ?
  `, [newTotalRefund, newStatus, reason || 'Refund processed by Super Admin', actorId, paymentId]);

  return { success: true, paymentId, refundAmount: numRefund, newStatus };
}

module.exports = {
  RevenueReportError,
  initializeRevenueReportModule,
  getRevenueOverview,
  getRevenueAnalytics,
  getShopWiseRevenue,
  getSubscriptionRevenue,
  getPaymentTransactions,
  getShopRevenueDetails,
  getPaymentDetails,
  recordPaymentRefund
};

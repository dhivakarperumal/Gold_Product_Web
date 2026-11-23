const crypto = require('node:crypto');
const { pool } = require('../config/db');

class PaymentManagementError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Ensures required columns exist in the payments table:
 * payment_id (UUID), payment_reference, rejection_reason,
 * and updates enum for payment_status.
 */
async function initializePaymentManagementModule() {
  const [cols] = await pool.execute(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'"
  );
  const colSet = new Set(cols.map((c) => c.COLUMN_NAME));

  if (!colSet.has('payment_id')) {
    await pool.query(
      'ALTER TABLE payments ADD COLUMN payment_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER id'
    );
  }
  if (!colSet.has('payment_reference')) {
    await pool.query('ALTER TABLE payments ADD COLUMN payment_reference VARCHAR(150) NULL AFTER payment_method');
  }
  if (!colSet.has('rejection_reason')) {
    await pool.query('ALTER TABLE payments ADD COLUMN rejection_reason TEXT NULL AFTER notes');
  }

  // Update enum if needed to allow 'cancelled'
  const [statusCol] = await pool.execute(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'payment_status'"
  );
  const colType = statusCol[0]?.COLUMN_TYPE || '';
  if (!colType.includes('cancelled')) {
    await pool.query(
      "ALTER TABLE payments MODIFY COLUMN payment_status ENUM('paid','pending','unpaid','failed','refunded','cancelled') NOT NULL DEFAULT 'pending'"
    );
  }

  // Backfill missing payment_id (UUID)
  const [rowsWithoutUuid] = await pool.execute(
    'SELECT id FROM payments WHERE payment_id IS NULL OR payment_id = ""'
  );
  for (const r of rowsWithoutUuid) {
    await pool.execute('UPDATE payments SET payment_id = ? WHERE id = ?', [crypto.randomUUID(), r.id]);
  }
}

/**
 * Helper to log activity
 */
async function logActivity(connection, shopId, actorId, action, details) {
  await connection.execute(
    `INSERT INTO gold_shop_activity_logs (gold_shop_id, actor_id, action, details)
     VALUES (?, ?, ?, ?)`,
    [shopId || null, actorId || null, action, JSON.stringify(details || {})]
  );
}

/**
 * 1. Payment Overview Cards
 */
async function getPaymentOverview() {
  const [rows] = await pool.execute(`
    SELECT
      COUNT(p.id) AS total_payments,
      COALESCE(SUM(CASE WHEN p.payment_status = 'paid' THEN p.amount - COALESCE(p.refund_amount, 0) ELSE 0 END), 0) AS total_collected_amount,
      COUNT(CASE WHEN p.payment_status IN ('pending', 'unpaid') THEN 1 ELSE NULL END) AS pending_payments_count,
      COALESCE(SUM(CASE WHEN p.payment_status IN ('pending', 'unpaid') THEN p.amount ELSE 0 END), 0) AS pending_payments_amount,
      COUNT(CASE WHEN p.payment_status = 'failed' THEN 1 ELSE NULL END) AS failed_payments_count,
      COALESCE(SUM(CASE WHEN p.payment_status = 'failed' THEN p.amount ELSE 0 END), 0) AS failed_payments_amount,
      COUNT(CASE WHEN p.payment_status = 'refunded' OR (p.payment_status = 'paid' AND COALESCE(p.refund_amount, 0) > 0) THEN 1 ELSE NULL END) AS refunded_payments_count,
      COALESCE(SUM(CASE WHEN p.payment_status = 'refunded' THEN p.amount ELSE COALESCE(p.refund_amount, 0) END), 0) AS refunded_payments_amount,
      COUNT(CASE WHEN p.payment_status = 'cancelled' THEN 1 ELSE NULL END) AS cancelled_payments_count,
      COALESCE(SUM(CASE WHEN p.payment_status = 'cancelled' THEN p.amount ELSE 0 END), 0) AS cancelled_payments_amount
    FROM payments p
    JOIN gold_shops gs ON gs.id = p.gold_shop_id AND gs.deleted_at IS NULL
  `);

  const r = rows[0] || {};
  return {
    totalPayments: Number(r.total_payments || 0),
    totalAmountCollected: Number(r.total_collected_amount || 0),
    pendingPaymentsCount: Number(r.pending_payments_count || 0),
    pendingPaymentsAmount: Number(r.pending_payments_amount || 0),
    failedPaymentsCount: Number(r.failed_payments_count || 0),
    failedPaymentsAmount: Number(r.failed_payments_amount || 0),
    refundedPaymentsCount: Number(r.refunded_payments_count || 0),
    refundedPaymentsAmount: Number(r.refunded_payments_amount || 0),
    cancelledPaymentsCount: Number(r.cancelled_payments_count || 0),
    cancelledPaymentsAmount: Number(r.cancelled_payments_amount || 0)
  };
}

/**
 * 2. Payment List with Search, Filters, Sorting, and Pagination
 */
async function listPayments(params = {}) {
  const {
    search = '',
    status = 'all',
    planId,
    paymentMethod,
    paymentDate,
    startDate,
    endDate,
    page = 1,
    limit = 10,
    sortBy = 'id',
    sortOrder = 'DESC'
  } = params;

  const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
  const safeLimit = Math.max(1, Math.min(100, Number(limit)));

  const whereClauses = ['gs.deleted_at IS NULL'];
  const queryParams = [];

  // Search by Shop Name, Owner Name, Transaction ID, Invoice Number, Reference, Shop ID
  if (search.trim()) {
    whereClauses.push(
      '(gs.shop_name LIKE ? OR gs.owner_name LIKE ? OR gs.shop_code LIKE ? OR p.transaction_id LIKE ? OR p.invoice_number LIKE ? OR p.payment_reference LIKE ?)'
    );
    const term = `%${search.trim()}%`;
    queryParams.push(term, term, term, term, term, term);
  }

  // Filter by Status
  if (status && status !== 'all') {
    if (status === 'pending') {
      whereClauses.push("p.payment_status IN ('pending', 'unpaid')");
    } else {
      whereClauses.push('p.payment_status = ?');
      queryParams.push(status);
    }
  }

  // Filter by Subscription Plan
  if (planId && planId !== 'all') {
    whereClauses.push('s.plan_id = ?');
    queryParams.push(Number(planId));
  }

  // Filter by Payment Method
  if (paymentMethod && paymentMethod !== 'all') {
    whereClauses.push('p.payment_method = ?');
    queryParams.push(paymentMethod);
  }

  // Filter by Payment Date (single date or range)
  if (paymentDate) {
    whereClauses.push('DATE(COALESCE(p.payment_date, p.created_at)) = ?');
    queryParams.push(paymentDate);
  } else {
    if (startDate) {
      whereClauses.push('DATE(COALESCE(p.payment_date, p.created_at)) >= ?');
      queryParams.push(startDate);
    }
    if (endDate) {
      whereClauses.push('DATE(COALESCE(p.payment_date, p.created_at)) <= ?');
      queryParams.push(endDate);
    }
  }

  const whereSql = whereClauses.join(' AND ');

  // Total count query
  const [countResult] = await pool.execute(`
    SELECT COUNT(p.id) AS total
    FROM payments p
    JOIN gold_shops gs ON gs.id = p.gold_shop_id
    LEFT JOIN subscriptions s ON s.id = p.subscription_id
    WHERE ${whereSql}
  `, queryParams);
  const total = countResult[0]?.total || 0;

  // Sorting
  const validSortCols = {
    id: 'p.id',
    payment_date: 'COALESCE(p.payment_date, p.created_at)',
    amount: 'p.amount',
    shop_name: 'gs.shop_name',
    owner_name: 'gs.owner_name',
    status: 'p.payment_status'
  };
  const sortCol = validSortCols[sortBy] || 'p.id';
  const orderDir = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const sql = `
    SELECT
      p.id,
      COALESCE(p.payment_id, '') AS payment_id,
      p.gold_shop_id,
      p.subscription_id,
      COALESCE(p.transaction_id, 'PENDING') AS transaction_id,
      COALESCE(p.invoice_number, CONCAT('INV-', YEAR(COALESCE(p.payment_date, p.created_at)), '-', LPAD(p.id, 5, '0'))) AS invoice_number,
      p.payment_reference,
      p.amount,
      p.refund_amount,
      p.payment_method,
      p.payment_status,
      p.payment_date,
      p.refund_date,
      p.notes,
      p.rejection_reason,
      p.created_at,
      p.updated_at,
      gs.shop_name,
      gs.shop_code,
      gs.owner_name,
      gs.mobile,
      gs.email,
      gs.city,
      gs.status AS shop_status,
      COALESCE(sp.plan_name, 'No Plan') AS plan_name,
      s.duration AS subscription_duration,
      s.start_date AS subscription_start_date,
      s.end_date AS subscription_end_date,
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

  const items = rows.map((r, i) => ({
    sNo: offset + i + 1,
    id: r.id,
    paymentId: r.payment_id || `PAY-${r.id}`,
    transactionId: r.transaction_id,
    invoiceNumber: r.invoice_number,
    paymentReference: r.payment_reference || '—',
    shopId: r.gold_shop_id,
    shopCode: r.shop_code,
    shopName: r.shop_name,
    ownerName: r.owner_name,
    mobile: r.mobile,
    email: r.email,
    city: r.city,
    shopStatus: r.shop_status,
    planName: r.plan_name,
    subscriptionDuration: r.subscription_duration || 'monthly',
    subscriptionStartDate: r.subscription_start_date,
    subscriptionEndDate: r.subscription_end_date,
    subscriptionStatus: r.subscription_status,
    amount: Number(r.amount || 0),
    refundAmount: Number(r.refund_amount || 0),
    netAmount: Number(r.amount || 0) - Number(r.refund_amount || 0),
    paymentMethod: r.payment_method || 'N/A',
    paymentDate: r.payment_date || r.created_at,
    refundDate: r.refund_date,
    paymentStatus: r.payment_status === 'unpaid' ? 'pending' : r.payment_status,
    notes: r.notes,
    rejectionReason: r.rejection_reason,
    createdByName: r.created_by_name || 'System',
    createdAt: r.created_at,
    updatedAt: r.updated_at
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
 * 4a. View Details for a Single Payment
 */
async function getPaymentById(id) {
  const [rows] = await pool.execute(`
    SELECT
      p.id,
      p.payment_id,
      p.gold_shop_id,
      p.subscription_id,
      COALESCE(p.transaction_id, 'PENDING') AS transaction_id,
      COALESCE(p.invoice_number, CONCAT('INV-', YEAR(COALESCE(p.payment_date, p.created_at)), '-', LPAD(p.id, 5, '0'))) AS invoice_number,
      p.payment_reference,
      p.amount,
      p.refund_amount,
      p.payment_method,
      p.payment_status,
      p.payment_date,
      p.refund_date,
      p.notes,
      p.rejection_reason,
      p.created_at,
      p.updated_at,
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
      gs.status AS shop_status,
      sp.id AS plan_id,
      sp.plan_name,
      sp.monthly_price,
      s.duration,
      s.start_date,
      s.end_date,
      s.subscription_status,
      s.payment_status AS sub_payment_status,
      creator.username AS created_by_name,
      updater.username AS updated_by_name
    FROM payments p
    JOIN gold_shops gs ON gs.id = p.gold_shop_id
    LEFT JOIN subscriptions s ON s.id = p.subscription_id
    LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
    LEFT JOIN users creator ON creator.id = p.created_by
    LEFT JOIN users updater ON updater.id = p.updated_by
    WHERE p.id = ?
  `, [id]);

  if (!rows.length) {
    throw new PaymentManagementError(404, 'Payment transaction not found');
  }

  const r = rows[0];
  return {
    id: r.id,
    paymentId: r.payment_id || `PAY-${r.id}`,
    transactionId: r.transaction_id,
    invoiceNumber: r.invoice_number,
    paymentReference: r.payment_reference || '—',
    amount: Number(r.amount || 0),
    refundAmount: Number(r.refund_amount || 0),
    netAmount: Number(r.amount || 0) - Number(r.refund_amount || 0),
    paymentMethod: r.payment_method || 'N/A',
    paymentStatus: r.payment_status === 'unpaid' ? 'pending' : r.payment_status,
    paymentDate: r.payment_date || r.created_at,
    refundDate: r.refund_date,
    notes: r.notes,
    rejectionReason: r.rejection_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    createdByName: r.created_by_name || 'System',
    updatedByName: r.updated_by_name || '—',
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
      pincode: r.pincode,
      status: r.shop_status
    },
    subscription: {
      id: r.subscription_id,
      planId: r.plan_id,
      planName: r.plan_name,
      duration: r.duration,
      startDate: r.start_date,
      endDate: r.end_date,
      status: r.subscription_status,
      paymentStatus: r.sub_payment_status
    }
  };
}

/**
 * 4b. Approve Payment
 * - Approves eligible pending manual payments.
 * - Updates payment status to 'paid'.
 * - Activates the corresponding subscription.
 * - Prevents duplicate activation.
 * - Uses a database transaction.
 */
async function approvePayment(paymentId, input = {}, actorId = null) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Lock payment record
    const [payments] = await connection.execute(
      'SELECT id, gold_shop_id, subscription_id, amount, payment_status, transaction_id, payment_method FROM payments WHERE id = ? FOR UPDATE',
      [paymentId]
    );
    const payment = payments[0];
    if (!payment) {
      throw new PaymentManagementError(404, 'Payment transaction not found');
    }

    if (payment.payment_status === 'paid') {
      throw new PaymentManagementError(409, 'This payment is already approved and confirmed as Paid');
    }
    if (payment.payment_status === 'refunded' || payment.payment_status === 'cancelled') {
      throw new PaymentManagementError(409, `Cannot approve a payment that is currently ${payment.payment_status}`);
    }

    // Lock subscription record
    const [subscriptions] = await connection.execute(
      'SELECT id, gold_shop_id, subscription_status, payment_status, end_date FROM subscriptions WHERE id = ? FOR UPDATE',
      [payment.subscription_id]
    );
    const subscription = subscriptions[0];
    if (!subscription) {
      throw new PaymentManagementError(404, 'Linked subscription not found');
    }

    const finalTransactionId = (input.transactionId && input.transactionId.trim())
      ? input.transactionId.trim()
      : (payment.transaction_id && payment.transaction_id !== 'PENDING' ? payment.transaction_id : `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`);

    const finalMethod = input.paymentMethod || payment.payment_method || 'Bank Transfer';
    const reference = input.paymentReference || input.referenceNumber || null;
    const notes = input.notes || 'Payment approved and verified by Super Admin';

    // Update payment to 'paid'
    await connection.execute(`
      UPDATE payments
      SET transaction_id = ?, payment_method = ?, payment_reference = COALESCE(?, payment_reference),
          payment_status = 'paid', payment_date = CURRENT_TIMESTAMP, notes = ?, updated_by = ?
      WHERE id = ?
    `, [finalTransactionId, finalMethod, reference, notes, actorId, payment.id]);

    // Activate subscription & mark paid
    await connection.execute(`
      UPDATE subscriptions
      SET payment_status = 'paid', subscription_status = 'active', updated_by = ?
      WHERE id = ?
    `, [actorId, subscription.id]);

    // Activate gold shop if currently pending
    await connection.execute(`
      UPDATE gold_shops
      SET status = 'active', updated_by = ?
      WHERE id = ? AND status = 'pending'
    `, [actorId, payment.gold_shop_id]);

    // Log audit activity
    await logActivity(connection, payment.gold_shop_id, actorId, 'payment.approved', {
      payment_id: payment.id,
      subscription_id: subscription.id,
      amount: payment.amount,
      transaction_id: finalTransactionId,
      payment_method: finalMethod
    });

    await connection.commit();
    return { success: true, message: 'Payment approved and subscription activated successfully' };
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw new PaymentManagementError(409, 'This Transaction ID / Reference has already been recorded');
    }
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 4c. Reject Payment
 * - Rejects pending payments.
 * - Requires a rejection reason.
 * - Updates payment status to 'cancelled'.
 */
async function rejectPayment(paymentId, input = {}, actorId = null) {
  const reason = input.rejectionReason || input.reason;
  if (!reason || !reason.trim()) {
    throw new PaymentManagementError(400, 'A valid rejection reason is required');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [payments] = await connection.execute(
      'SELECT id, gold_shop_id, subscription_id, payment_status, amount FROM payments WHERE id = ? FOR UPDATE',
      [paymentId]
    );
    const payment = payments[0];
    if (!payment) {
      throw new PaymentManagementError(404, 'Payment transaction not found');
    }

    if (payment.payment_status === 'paid') {
      throw new PaymentManagementError(409, 'Cannot reject a paid payment. Use the refund action instead.');
    }
    if (payment.payment_status === 'cancelled') {
      throw new PaymentManagementError(409, 'This payment is already cancelled/rejected');
    }

    await connection.execute(`
      UPDATE payments
      SET payment_status = 'cancelled', rejection_reason = ?, notes = ?, updated_by = ?
      WHERE id = ?
    `, [reason.trim(), input.notes || 'Payment rejected by Super Admin', actorId, payment.id]);

    // Subscription remains pending/unpaid
    await connection.execute(`
      UPDATE subscriptions
      SET payment_status = 'unpaid', updated_by = ?
      WHERE id = ? AND payment_status = 'pending'
    `, [actorId, payment.subscription_id]);

    await logActivity(connection, payment.gold_shop_id, actorId, 'payment.rejected', {
      payment_id: payment.id,
      rejection_reason: reason.trim()
    });

    await connection.commit();
    return { success: true, message: 'Payment has been rejected' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 4d. Refund Payment
 * - Process eligible refunds.
 * - Record refund amount and reason.
 * - Update payment status correctly.
 */
async function refundPayment(paymentId, input = {}, actorId = null) {
  const refundAmount = Number(input.refundAmount || input.amount);
  const reason = input.reason || input.refundReason;

  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    throw new PaymentManagementError(400, 'A valid refund amount is required');
  }
  if (!reason || !reason.trim()) {
    throw new PaymentManagementError(400, 'A refund reason is required');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [payments] = await connection.execute(
      'SELECT id, gold_shop_id, subscription_id, amount, refund_amount, payment_status FROM payments WHERE id = ? FOR UPDATE',
      [paymentId]
    );
    const payment = payments[0];
    if (!payment) {
      throw new PaymentManagementError(404, 'Payment transaction not found');
    }

    if (payment.payment_status !== 'paid' && payment.payment_status !== 'refunded') {
      throw new PaymentManagementError(409, 'Only paid transactions can be refunded');
    }

    const currentRefunded = Number(payment.refund_amount || 0);
    const maxRefundAllowed = Number(payment.amount) - currentRefunded;
    if (refundAmount > maxRefundAllowed) {
      throw new PaymentManagementError(
        400,
        `Refund cannot exceed remaining paid balance of ₹${maxRefundAllowed.toFixed(2)}`
      );
    }

    const newTotalRefund = currentRefunded + refundAmount;
    const isFullRefund = newTotalRefund >= Number(payment.amount);
    const newStatus = isFullRefund ? 'refunded' : 'paid';

    await connection.execute(`
      UPDATE payments
      SET refund_amount = ?, refund_date = CURRENT_TIMESTAMP, payment_status = ?, notes = ?, updated_by = ?
      WHERE id = ?
    `, [newTotalRefund, newStatus, `Refund of ₹${refundAmount.toFixed(2)}: ${reason.trim()}`, actorId, payment.id]);

    await logActivity(connection, payment.gold_shop_id, actorId, 'payment.refunded', {
      payment_id: payment.id,
      refund_amount: refundAmount,
      total_refunded: newTotalRefund,
      reason: reason.trim(),
      is_full_refund: isFullRefund
    });

    await connection.commit();
    return {
      success: true,
      message: `Refund of ₹${refundAmount.toFixed(2)} processed successfully`,
      newStatus,
      totalRefunded: newTotalRefund
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  PaymentManagementError,
  initializePaymentManagementModule,
  getPaymentOverview,
  listPayments,
  getPaymentById,
  approvePayment,
  rejectPayment,
  refundPayment
};

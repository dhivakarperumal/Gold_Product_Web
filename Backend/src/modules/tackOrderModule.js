const { randomUUID } = require('node:crypto');
const { pool } = require('../config/db');

const MANUAL_ORDER_STATUSES = Object.freeze([
  'Order Placed',
  'Confirmed',
  'Ready',
  'Billing Pending'
]);

async function initializeTackOrderModule() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tack_orders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      order_no VARCHAR(50) NOT NULL UNIQUE,
      user_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      customer JSON NOT NULL,
      items JSON NOT NULL,
      sub_total DECIMAL(12,2) NOT NULL,
      gst_included BOOLEAN NOT NULL DEFAULT FALSE,
      gst_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
      gst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      discount_type ENUM('Percent', 'Fixed') NOT NULL,
      discount_value DECIMAL(12,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(12,2) NOT NULL,
      order_status VARCHAR(30) NOT NULL DEFAULT 'Order Placed',
      payment_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      advance_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      balance_due DECIMAL(12,2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tack_orders_user_created (user_id, created_at)
    )
  `);
  const [orderStatusColumns] = await pool.query("SHOW COLUMNS FROM tack_orders LIKE 'order_status'");
  if (orderStatusColumns.length === 0) {
    await pool.query("ALTER TABLE tack_orders ADD COLUMN order_status VARCHAR(30) NOT NULL DEFAULT 'Order Placed' AFTER total_amount");
  }
  const [paymentStatusColumns] = await pool.query("SHOW COLUMNS FROM tack_orders LIKE 'payment_status'");
  if (paymentStatusColumns.length === 0) {
    await pool.query("ALTER TABLE tack_orders ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'Pending' AFTER order_status");
  }
  await pool.query(`
    UPDATE billings b
    JOIN billing_payments p ON p.billing_id = b.id AND p.payment_kind = 'PAYMENT'
    JOIN tack_orders t ON t.order_no = p.reference_number AND t.user_id = b.user_id
    SET b.source_tack_order_id = t.id
    WHERE b.source_tack_order_id IS NULL
      AND p.idempotency_key = CONCAT('tack-order-advance:', t.user_id, ':', t.id)
  `);
  await pool.query(`
    UPDATE tack_orders t
    JOIN billings b ON b.source_tack_order_id = t.id AND b.user_id = t.user_id
    SET t.payment_status = CASE WHEN GREATEST(b.total_amount - b.paid_amount, 0) <= 0 THEN 'Paid'
                                WHEN b.paid_amount > 0 THEN 'Partial' ELSE 'Pending' END,
        t.balance_due = GREATEST(b.total_amount - b.paid_amount, 0),
        t.order_status = CASE WHEN GREATEST(b.total_amount - b.paid_amount, 0) <= 0 THEN 'Completed' ELSE 'Billing Pending' END
  `);
  await pool.query(`
    UPDATE tack_orders
    SET order_status = 'Completed'
    WHERE order_status = 'Bill Completed'
  `);
}

async function getTackOrderProductsByIds(productIds, userId) {
  if (productIds.length === 0) return [];
  const placeholders = productIds.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT id, name, category, purity, net_gold_weight, gold_rate_per_gram,
       making_charge_type, making_charge, wastage_type, wastage, stone_charges,
       other_charges, gst_rate, price_includes_gst, offer_type, offer,
       fixed_discount_amount, final_selling_price, offer_price, mrp, status
     FROM products
     WHERE id IN (${placeholders}) AND created_by = ?`,
    [...productIds, userId]
  );
  return rows;
}

async function createTackOrder(tackOrder, userId) {
  const orderNo = `TACK-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const [result] = await pool.execute(
    `INSERT INTO tack_orders
      (order_no, user_id, customer, items, sub_total, gst_included, gst_rate, gst_amount,
       discount_type, discount_value, discount_amount, total_amount, order_status, payment_status,
       advance_amount, balance_due)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderNo,
      userId,
      JSON.stringify(tackOrder.customer),
      JSON.stringify(tackOrder.items),
      tackOrder.sub_total,
      tackOrder.gst_included,
      tackOrder.gst_rate,
      tackOrder.gst_amount,
      tackOrder.discount_type,
      tackOrder.discount_value,
      tackOrder.discount_amount,
      tackOrder.total_amount,
      'Order Placed',
      tackOrder.payment_status,
      tackOrder.advance_amount,
      tackOrder.balance_due
    ]
  );
  return {
    ...tackOrder,
    id: result.insertId,
    order_no: orderNo,
    order_status: 'Order Placed',
    payment_status: tackOrder.payment_status
  };
}

async function listTackOrders(userId) {
  const [rows] = await pool.execute(
    `SELECT t.id, t.order_no, t.customer, t.items, t.sub_total, t.gst_included, t.gst_rate, t.gst_amount,
       t.discount_type, t.discount_value, t.discount_amount, t.total_amount,
       CASE WHEN b.id IS NULL THEN t.order_status
         WHEN GREATEST(b.total_amount - b.paid_amount, 0) <= 0 THEN 'Completed' ELSE 'Billing Pending' END AS order_status,
       CASE WHEN b.id IS NULL THEN t.payment_status
         WHEN GREATEST(b.total_amount - b.paid_amount, 0) <= 0 THEN 'Paid'
         WHEN b.paid_amount > 0 THEN 'Partial' ELSE 'Pending' END AS payment_status,
       t.advance_amount,
       COALESCE(GREATEST(b.total_amount - b.paid_amount, 0), t.balance_due) AS balance_due,
       COALESCE(b.paid_amount, GREATEST(t.total_amount - t.balance_due, 0)) AS paid_amount,
       t.created_at
     FROM tack_orders t
     LEFT JOIN billings b ON b.id = (
       SELECT MAX(source_bill.id)
       FROM billings source_bill
       WHERE source_bill.source_tack_order_id = t.id AND source_bill.user_id = t.user_id
     )
     WHERE t.user_id = ?
     ORDER BY t.created_at DESC, t.id DESC`,
    [userId]
  );
  return rows;
}

async function getTackOrderById(id, userId) {
  const [rows] = await pool.execute(
    `SELECT id, order_no, customer, items, sub_total, gst_included, gst_rate, gst_amount,
       discount_amount, total_amount, order_status, payment_status, advance_amount
     FROM tack_orders
     WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return rows[0] || null;
}

async function updateTackOrderStatus(id, status, userId) {
  await pool.execute(
    `UPDATE tack_orders
     SET order_status = ?
     WHERE id = ? AND user_id = ? AND order_status NOT IN ('Completed', 'Bill Completed')`,
    [status, id, userId]
  );
  const order = await getTackOrderById(id, userId);
  if (!order) return null;
  if (order.order_status === 'Completed' || order.order_status === 'Bill Completed') {
    const error = new Error('Completed status is set automatically when the linked bill is fully paid');
    error.code = 'TACK_ORDER_ALREADY_COMPLETED';
    throw error;
  }
  return {
    id: order.id,
    order_status: order.order_status,
    payment_status: order.payment_status
  };
}

module.exports = {
  createTackOrder,
  getTackOrderById,
  getTackOrderProductsByIds,
  initializeTackOrderModule,
  listTackOrders,
  MANUAL_ORDER_STATUSES,
  updateTackOrderStatus
};

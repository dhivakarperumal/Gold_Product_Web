const { randomUUID } = require('node:crypto');
const { pool } = require('../config/db');

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
       discount_type, discount_value, discount_amount, total_amount, order_status, advance_amount, balance_due)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      tackOrder.advance_amount,
      tackOrder.balance_due
    ]
  );
  return { ...tackOrder, id: result.insertId, order_no: orderNo, order_status: 'Order Placed' };
}

async function listTackOrders(userId) {
  const [rows] = await pool.execute(
    `SELECT id, order_no, customer, items, sub_total, gst_included, gst_rate, gst_amount,
       discount_type, discount_value, discount_amount, total_amount, order_status, advance_amount,
       balance_due, created_at
     FROM tack_orders
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC`,
    [userId]
  );
  return rows;
}

async function getTackOrderById(id, userId) {
  const [rows] = await pool.execute(
    `SELECT id, order_no, customer, items, sub_total, gst_included, gst_rate, gst_amount,
       discount_amount, total_amount, order_status, advance_amount
     FROM tack_orders
     WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return rows[0] || null;
}

module.exports = {
  createTackOrder,
  getTackOrderById,
  getTackOrderProductsByIds,
  initializeTackOrderModule,
  listTackOrders
};

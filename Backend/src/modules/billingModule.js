const { pool } = require('../config/db');
const { getFundBalance, insertFundRecord } = require('./fundsModule');
const { addDateRangeCondition } = require('../utils/dateRange');

async function initializeBillingModule() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS billings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      invoice_no VARCHAR(50) NOT NULL UNIQUE,
      user_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
      customers JSON NOT NULL,
      products JSON NOT NULL,
      exchanges JSON NOT NULL,
      payment_type ENUM('FULL_PAYMENT', 'EXCHANGE_GOLD') NOT NULL,
      sub_total DECIMAL(12,2) NOT NULL,
      discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      gst_amount DECIMAL(12,2) NOT NULL,
      total_amount DECIMAL(12,2) NOT NULL,
      created_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
      updated_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  const [userIdColumns] = await pool.query("SHOW COLUMNS FROM billings LIKE 'user_id'");
  if (userIdColumns.length === 0) {
    await pool.query('ALTER TABLE billings ADD COLUMN user_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER invoice_no');
  }
  const [createdByColumns] = await pool.query("SHOW COLUMNS FROM billings LIKE 'created_by'");
  if (createdByColumns.length === 0) {
    await pool.query('ALTER TABLE billings ADD COLUMN created_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER total_amount');
  }
  const [updatedByColumns] = await pool.query("SHOW COLUMNS FROM billings LIKE 'updated_by'");
  if (updatedByColumns.length === 0) {
    await pool.query('ALTER TABLE billings ADD COLUMN updated_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER created_by');
  }
  const [updatedAtColumns] = await pool.query("SHOW COLUMNS FROM billings LIKE 'updated_at'");
  if (updatedAtColumns.length === 0) {
    await pool.query('ALTER TABLE billings ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
  }
  const [discountColumns] = await pool.query("SHOW COLUMNS FROM billings LIKE 'discount_amount'");
  if (discountColumns.length === 0) {
    await pool.query('ALTER TABLE billings ADD COLUMN discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER sub_total');
  }
  const [paidColumns] = await pool.query("SHOW COLUMNS FROM billings LIKE 'paid_amount'");
  if (paidColumns.length === 0) {
    await pool.query('ALTER TABLE billings ADD COLUMN paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER total_amount');
  }
  const [balanceColumns] = await pool.query("SHOW COLUMNS FROM billings LIKE 'balance_due'");
  if (balanceColumns.length === 0) {
    await pool.query('ALTER TABLE billings ADD COLUMN balance_due DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER paid_amount');
    await pool.query('UPDATE billings SET balance_due = total_amount');
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_payments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      billing_id BIGINT UNSIGNED NOT NULL,
      payment_kind ENUM('PAYMENT', 'REFUND') NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      payment_method VARCHAR(40) NOT NULL,
      reference_number VARCHAR(100) NULL,
      payment_date DATETIME NOT NULL,
      idempotency_key VARCHAR(150) NOT NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_billing_payments_bill FOREIGN KEY (billing_id)
        REFERENCES billings(id) ON DELETE RESTRICT,
      UNIQUE KEY uq_billing_payment_idempotency (idempotency_key),
      INDEX idx_billing_payments_bill (billing_id, payment_date, id)
    )
  `);
}

async function listBillings(userId, dateRange = {}) {
  const conditions = ['b.user_id = ?'];
  const values = [userId];
  addDateRangeCondition(conditions, values, 'b.created_at', dateRange);
  const where = `WHERE ${conditions.join(' AND ')}`;
  const [rows] = await pool.execute(`
    SELECT b.id, b.invoice_no, b.user_id, b.customers, b.products, b.exchanges, b.payment_type,
      b.sub_total, b.discount_amount, b.gst_amount, b.total_amount, b.paid_amount, b.balance_due,
      b.created_at, b.updated_at, b.created_by,
      COALESCE(NULLIF(creator.name, ''), creator.username, b.created_by) AS created_by_name,
      b.updated_by, COALESCE(NULLIF(updater.name, ''), updater.username, b.updated_by) AS updated_by_name
    FROM billings b
    LEFT JOIN users creator ON creator.user_id = b.created_by
    LEFT JOIN users updater ON updater.user_id = b.updated_by
    ${where}
    ORDER BY b.created_at DESC, b.id DESC
  `, values);
  return rows;
}

async function getBillingById(id, userId) {
  const [rows] = await pool.execute(
    `SELECT b.id, b.invoice_no, b.user_id, b.customers, b.products, b.exchanges, b.payment_type,
       b.sub_total, b.discount_amount, b.gst_amount, b.total_amount, b.paid_amount, b.balance_due,
       b.created_at, b.updated_at, b.created_by,
       COALESCE(NULLIF(creator.name, ''), creator.username, b.created_by) AS created_by_name,
       b.updated_by, COALESCE(NULLIF(updater.name, ''), updater.username, b.updated_by) AS updated_by_name
     FROM billings b
     LEFT JOIN users creator ON creator.user_id = b.created_by
     LEFT JOIN users updater ON updater.user_id = b.updated_by
     WHERE b.id = ? AND b.user_id = ?`,
    [id, userId]
  );
  return rows[0] || null;
}

async function getBillingProductsByIds(productIds, createdByUserId) {
  if (productIds.length === 0) return [];
  const placeholders = productIds.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT id, name, category, purity, gross_weight, net_gold_weight, making_charge_type, making_charge,
      gold_rate_per_gram, gold_value, mrp, offer_type, offer_price, applied_discount, tax_amount,
      final_selling_price, status
     FROM products
     WHERE id IN (${placeholders}) AND created_by = ?`,
    [...productIds, createdByUserId]
  );
  return rows;
}

async function createBilling(billing, userId, initialPayment = null) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const paidAmount = initialPayment ? Number(initialPayment.amount) : 0;
    const [result] = await connection.execute(
      `INSERT INTO billings
        (invoice_no, user_id, customers, products, exchanges, payment_type, sub_total, discount_amount,
         gst_amount, total_amount, paid_amount, balance_due, created_by, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        billing.invoice_no,
        userId,
        JSON.stringify(billing.customers),
        JSON.stringify(billing.products),
        JSON.stringify(billing.exchanges),
        billing.payment_type,
        billing.sub_total,
        billing.discount_amount,
        billing.gst_amount,
        billing.total_amount,
        paidAmount.toFixed(2),
        (billing.total_amount - paidAmount).toFixed(2),
        userId,
        userId
      ]
    );
    if (initialPayment) {
      await getFundBalance(connection, initialPayment.created_by_user_id, true);
      try {
        await connection.execute(
          `INSERT INTO billing_payments
            (billing_id, payment_kind, amount, payment_method, reference_number,
             payment_date, idempotency_key, created_by)
           VALUES (?, 'PAYMENT', ?, ?, ?, ?, ?, ?)`,
          [
            result.insertId,
            initialPayment.amount.toFixed(2),
            initialPayment.payment_method,
            initialPayment.reference_number,
            initialPayment.payment_date,
            initialPayment.idempotency_key,
            initialPayment.created_by
          ]
        );
        await insertFundRecord(connection, {
          transaction_type: 'CREDIT',
          transaction_date: initialPayment.payment_date,
          amount: initialPayment.amount.toFixed(2),
          related_reference: billing.invoice_no,
          payment_method: initialPayment.payment_method,
          description: `Tack order advance ${initialPayment.reference_number}`,
          idempotency_key: initialPayment.idempotency_key,
          created_by: initialPayment.created_by_user_id,
          updated_by: initialPayment.created_by_user_id,
          admin_name: initialPayment.admin_name
        });
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          const duplicateError = new Error('Tack order advance has already been transferred');
          duplicateError.code = 'TACK_ORDER_ADVANCE_ALREADY_TRANSFERRED';
          throw duplicateError;
        }
        throw error;
      }
    }
    await connection.commit();
    return getBillingById(result.insertId, userId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateBilling(id, billing, userId) {
  await pool.execute(
    `UPDATE billings
     SET customers = ?, products = ?, exchanges = ?, payment_type = ?,
       sub_total = ?, discount_amount = ?, gst_amount = ?, total_amount = ?,
       balance_due = GREATEST(? - paid_amount, 0), updated_by = ?
     WHERE id = ? AND user_id = ?`,
    [
      JSON.stringify(billing.customers),
      JSON.stringify(billing.products),
      JSON.stringify(billing.exchanges),
      billing.payment_type,
      billing.sub_total,
      billing.discount_amount,
      billing.gst_amount,
      billing.total_amount,
      billing.total_amount,
      userId,
      id,
      userId
    ]
  );
  return getBillingById(id, userId);
}

async function recordBillingPayment(id, payment, userId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [bills] = await connection.execute(
      'SELECT id, invoice_no, customers, total_amount, paid_amount FROM billings WHERE id = ? AND user_id = ? FOR UPDATE',
      [id, userId]
    );
    if (!bills.length) {
      const error = new Error('Bill not found');
      error.code = 'BILL_NOT_FOUND';
      throw error;
    }
    const bill = bills[0];
    const currentPaid = Number(bill.paid_amount);
    if (payment.payment_kind === 'REFUND' && Number(payment.amount) > currentPaid) {
      const error = new Error('Refund cannot exceed the amount collected for this bill');
      error.code = 'REFUND_EXCEEDS_PAID';
      throw error;
    }
    const balance = await getFundBalance(connection, payment.created_by_user_id, true);
    if (payment.payment_kind === 'REFUND') {
      if (balance < Number(payment.amount)) {
        const error = new Error('The admin fund balance does not have enough available funds for this refund');
        error.code = 'INSUFFICIENT_FUNDS';
        throw error;
      }
    }
    await connection.execute(
      `INSERT INTO billing_payments
        (billing_id, payment_kind, amount, payment_method, reference_number,
         payment_date, idempotency_key, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, payment.payment_kind, payment.amount, payment.payment_method,
        payment.reference_number || null, payment.payment_date, payment.idempotency_key,
        payment.created_by || null
      ]
    );
    const customerData = typeof bill.customers === 'string' ? JSON.parse(bill.customers) : bill.customers;
    const customerName = Array.isArray(customerData) ? customerData.map((customer) => customer.name).join(', ') : '';
    await insertFundRecord(connection, {
      transaction_type: payment.payment_kind === 'PAYMENT' ? 'CREDIT' : 'DEBIT',
      transaction_date: payment.payment_date,
      amount: payment.amount,
      related_reference: bill.invoice_no,
      payment_method: payment.payment_method,
      description: `${payment.payment_kind === 'PAYMENT' ? 'Billing collection' : 'Refund against bill'} ${bill.invoice_no}${customerName ? ` · ${customerName}` : ''}`,
      idempotency_key: payment.idempotency_key,
      created_by: payment.created_by_user_id,
      updated_by: payment.created_by_user_id,
      admin_name: payment.admin_name
    });
    const paidAmount = currentPaid + (payment.payment_kind === 'PAYMENT' ? Number(payment.amount) : -Number(payment.amount));
    await connection.execute(
      'UPDATE billings SET paid_amount = ?, balance_due = GREATEST(total_amount - ?, 0), updated_by = ? WHERE id = ? AND user_id = ?',
      [paidAmount.toFixed(2), paidAmount.toFixed(2), payment.updated_by || null, id, userId]
    );
    await connection.commit();
    return getBillingById(id, userId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteBilling(id, userId) {
  const [result] = await pool.execute('DELETE FROM billings WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}

module.exports = {
  createBilling,
  deleteBilling,
  getBillingById,
  getBillingProductsByIds,
  initializeBillingModule,
  listBillings,
  recordBillingPayment,
  updateBilling
};

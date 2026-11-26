const { pool } = require('../config/db');
const { getFundBalance, insertFundRecord } = require('./fundsModule');
const { addDateRangeCondition } = require('../utils/dateRange');

function getPaymentState(totalAmount, paidAmount) {
  const balanceDue = Math.max(0, Number(totalAmount) - Number(paidAmount));
  return {
    balanceDue,
    paymentStatus: balanceDue <= 0 ? 'Paid' : Number(paidAmount) > 0 ? 'Partial' : 'Pending',
    orderStatus: balanceDue <= 0 ? 'Completed' : 'Billing Pending'
  };
}

async function syncTackOrderPaymentState(connection, tackOrderId, userId, totalAmount, paidAmount) {
  const state = getPaymentState(totalAmount, paidAmount);
  await connection.execute(
    `UPDATE tack_orders
     SET payment_status = ?, balance_due = ?, order_status = ?
     WHERE id = ? AND user_id = ?`,
    [state.paymentStatus, state.balanceDue.toFixed(2), state.orderStatus, tackOrderId, userId]
  );
  return state;
}

async function insertFundRecordOnce(connection, entry) {
  try {
    await insertFundRecord(connection, entry);
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY' || !entry.idempotency_key) throw error;

    const [existingRecords] = await connection.execute(
      `SELECT created_by, transaction_type, amount, payment_method
       FROM funds WHERE idempotency_key = ? FOR UPDATE`,
      [entry.idempotency_key]
    );
    const existing = existingRecords[0];
    if (!existing) throw error;

    const existingAmountCents = Math.round(Number(existing.amount) * 100);
    const requestedAmountCents = Math.round(Number(entry.amount) * 100);
    if (
      String(existing.created_by) !== String(entry.created_by)
      || existing.transaction_type !== entry.transaction_type
      || existingAmountCents !== requestedAmountCents
      || existing.payment_method !== entry.payment_method
    ) {
      const conflictError = new Error('An existing fund record conflicts with this tack-order advance');
      conflictError.code = 'FUND_IDEMPOTENCY_CONFLICT';
      throw conflictError;
    }
  }
}

async function initializeBillingModule() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS billings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      invoice_no VARCHAR(50) NOT NULL UNIQUE,
      user_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
      source_tack_order_id BIGINT UNSIGNED NULL,
      customers JSON NOT NULL,
      products JSON NOT NULL,
      exchanges JSON NOT NULL,
      payment_type ENUM('FULL_PAYMENT', 'EXCHANGE_GOLD') NOT NULL,
      sub_total DECIMAL(12,2) NOT NULL,
      discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      gst_amount DECIMAL(12,2) NOT NULL,
      gst_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
      tax_mode VARCHAR(20) NOT NULL DEFAULT 'Tax Exclusive',
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
  const [sourceTackOrderColumns] = await pool.query("SHOW COLUMNS FROM billings LIKE 'source_tack_order_id'");
  if (sourceTackOrderColumns.length === 0) {
    await pool.query('ALTER TABLE billings ADD COLUMN source_tack_order_id BIGINT UNSIGNED NULL AFTER user_id');
  }
  const [gstRateColumns] = await pool.query("SHOW COLUMNS FROM billings LIKE 'gst_rate'");
  if (gstRateColumns.length === 0) {
    await pool.query('ALTER TABLE billings ADD COLUMN gst_rate DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER gst_amount');
  }
  const [taxModeColumns] = await pool.query("SHOW COLUMNS FROM billings LIKE 'tax_mode'");
  if (taxModeColumns.length === 0) {
    await pool.query("ALTER TABLE billings ADD COLUMN tax_mode VARCHAR(20) NOT NULL DEFAULT 'Tax Exclusive' AFTER gst_rate");
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
      b.sub_total, b.discount_amount, b.gst_amount, b.gst_rate, b.tax_mode, b.total_amount, b.paid_amount, b.balance_due,
      b.source_tack_order_id,
      CASE WHEN b.paid_amount >= b.total_amount THEN 'Paid'
        WHEN b.paid_amount > 0 THEN 'Partial' ELSE 'Pending' END AS payment_status,
      (SELECT COUNT(*) FROM billing_payments p WHERE p.billing_id = b.id) AS payment_count,
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
       b.sub_total, b.discount_amount, b.gst_amount, b.gst_rate, b.tax_mode, b.total_amount, b.paid_amount, b.balance_due,
       b.source_tack_order_id,
       CASE WHEN b.paid_amount >= b.total_amount THEN 'Paid'
         WHEN b.paid_amount > 0 THEN 'Partial' ELSE 'Pending' END AS payment_status,
       (SELECT COUNT(*) FROM billing_payments p WHERE p.billing_id = b.id) AS payment_count,
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

async function getBillingByTackOrderId(tackOrderId, userId) {
  const [rows] = await pool.execute(
    `SELECT b.id, b.invoice_no, b.user_id, b.customers, b.products, b.exchanges, b.payment_type,
       b.sub_total, b.discount_amount, b.gst_amount, b.gst_rate, b.tax_mode,
       b.total_amount, b.paid_amount,
       GREATEST(b.total_amount - b.paid_amount, 0) AS balance_due,
       b.source_tack_order_id,
       CASE WHEN b.paid_amount >= b.total_amount THEN 'Paid'
         WHEN b.paid_amount > 0 THEN 'Partial' ELSE 'Pending' END AS payment_status,
       b.created_at, b.updated_at
     FROM billings b
     WHERE b.source_tack_order_id = ? AND b.user_id = ?
     ORDER BY b.id DESC
     LIMIT 1`,
    [tackOrderId, userId]
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
  const paidAmount = initialPayment ? Number(initialPayment.amount) : 0;
  const { balanceDue } = getPaymentState(billing.total_amount, paidAmount);
  const values = [
    billing.invoice_no,
    userId,
    JSON.stringify(billing.customers),
    JSON.stringify(billing.products),
    JSON.stringify(billing.exchanges),
    billing.payment_type,
    billing.sub_total,
    billing.discount_amount,
    billing.gst_amount,
    billing.gst_rate,
    billing.tax_mode,
    billing.total_amount,
    paidAmount.toFixed(2),
    balanceDue.toFixed(2),
    userId,
    userId,
    billing.source_tack_order_id || null
  ];
  const insertQuery = `INSERT INTO billings
    (invoice_no, user_id, customers, products, exchanges, payment_type, sub_total, discount_amount,
     gst_amount, gst_rate, tax_mode, total_amount, paid_amount, balance_due, created_by, updated_by,
     source_tack_order_id, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

  if (!initialPayment && billing.source_tack_order_id == null) {
    const [result] = await pool.execute(insertQuery, values);
    return getBillingById(result.insertId, userId);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (initialPayment) {
      await getFundBalance(connection, initialPayment.created_by_user_id, true);
    }
    const [result] = await connection.execute(insertQuery, values);
    if (initialPayment) {
      try {
        await connection.execute(
          `INSERT INTO billing_payments
            (billing_id, payment_kind, amount, payment_method, reference_number,
             payment_date, idempotency_key, created_by)
           VALUES (?, 'PAYMENT', ?, ?, ?, ?, ?, ?)`,
          [
            result.insertId,
            paidAmount.toFixed(2),
            initialPayment.payment_method,
            initialPayment.reference_number || null,
            initialPayment.payment_date,
            initialPayment.idempotency_key,
            initialPayment.created_by || null
          ]
        );
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          const [existingBills] = await connection.execute(
            `SELECT b.id, b.invoice_no, b.total_amount, b.paid_amount, b.source_tack_order_id,
                p.reference_number
             FROM billing_payments p
             JOIN billings b ON b.id = p.billing_id
             WHERE p.idempotency_key = ? AND p.payment_kind = 'PAYMENT' AND b.user_id = ?
             FOR UPDATE`,
            [initialPayment.idempotency_key, userId]
          );
          const existingBill = existingBills[0];
          const belongsToOrder = existingBill
            && (Number(existingBill.source_tack_order_id) === Number(billing.source_tack_order_id)
              || (existingBill.source_tack_order_id == null
                && existingBill.reference_number === initialPayment.reference_number));
          if (belongsToOrder) {
            await connection.execute(
              'DELETE FROM billings WHERE id = ? AND user_id = ?',
              [result.insertId, userId]
            );
            const existingPaidAmount = Number(existingBill.paid_amount);
            const { balanceDue: existingBalanceDue } = getPaymentState(existingBill.total_amount, existingPaidAmount);
            await connection.execute(
              'UPDATE billings SET source_tack_order_id = ?, balance_due = ? WHERE id = ? AND user_id = ?',
              [
                billing.source_tack_order_id,
                existingBalanceDue.toFixed(2),
                existingBill.id,
                userId
              ]
            );
            await syncTackOrderPaymentState(
              connection,
              billing.source_tack_order_id,
              userId,
              existingBill.total_amount,
              existingPaidAmount
            );
            await connection.commit();
            const savedBill = await getBillingById(existingBill.id, userId);
            return { ...savedBill, already_exists: true };
          }

          const duplicateError = new Error('This tack order advance has already been transferred to a bill');
          duplicateError.code = 'TACK_ORDER_ADVANCE_ALREADY_TRANSFERRED';
          throw duplicateError;
        }
        throw error;
      }
      const customerName = billing.customers.map((customer) => customer.name).filter(Boolean).join(', ');
      await insertFundRecordOnce(connection, {
        transaction_type: 'CREDIT',
        transaction_date: initialPayment.payment_date,
        amount: paidAmount.toFixed(2),
        payment_method: initialPayment.payment_method,
        description: `Billing collection ${billing.invoice_no}${customerName ? ` · ${customerName}` : ''}`,
        admin_name: initialPayment.admin_name,
        related_reference: billing.invoice_no,
        idempotency_key: initialPayment.idempotency_key,
        created_by: initialPayment.created_by_user_id,
        updated_by: initialPayment.created_by_user_id
      });
    }
    if (billing.source_tack_order_id != null) {
      await syncTackOrderPaymentState(
        connection,
        billing.source_tack_order_id,
        userId,
        billing.total_amount,
        paidAmount
      );
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
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [bills] = await connection.execute(
      'SELECT paid_amount, source_tack_order_id FROM billings WHERE id = ? AND user_id = ? FOR UPDATE',
      [id, userId]
    );
    if (!bills.length) {
      await connection.rollback();
      return null;
    }

    const bill = bills[0];
    const { balanceDue } = getPaymentState(billing.total_amount, bill.paid_amount);
    await connection.execute(
      `UPDATE billings
       SET customers = ?, products = ?, exchanges = ?, payment_type = ?,
         sub_total = ?, discount_amount = ?, gst_amount = ?, gst_rate = ?, tax_mode = ?, total_amount = ?,
         balance_due = ?, updated_by = ?
       WHERE id = ? AND user_id = ?`,
      [
        JSON.stringify(billing.customers),
        JSON.stringify(billing.products),
        JSON.stringify(billing.exchanges),
        billing.payment_type,
        billing.sub_total,
        billing.discount_amount,
        billing.gst_amount,
        billing.gst_rate,
        billing.tax_mode,
        billing.total_amount,
        balanceDue.toFixed(2),
        userId,
        id,
        userId
      ]
    );
    if (bill.source_tack_order_id != null) {
      await syncTackOrderPaymentState(
        connection,
        bill.source_tack_order_id,
        userId,
        billing.total_amount,
        bill.paid_amount
      );
    }
    await connection.commit();
    return await getBillingById(id, userId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function recordBillingPayment(id, payment, userId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [bills] = await connection.execute(
      'SELECT id, invoice_no, customers, total_amount, paid_amount, source_tack_order_id FROM billings WHERE id = ? AND user_id = ? FOR UPDATE',
      [id, userId]
    );
    if (!bills.length) {
      const error = new Error('Bill not found');
      error.code = 'BILL_NOT_FOUND';
      throw error;
    }
    const bill = bills[0];
    const currentPaid = Number(bill.paid_amount);
      if (payment.payment_kind === 'PAYMENT') {
        const balanceDue = Math.max(0, Number(bill.total_amount) - currentPaid);
        if (Number(payment.amount) > balanceDue) {
          const error = new Error('Payment amount cannot exceed the remaining bill balance');
          error.code = 'PAYMENT_EXCEEDS_BALANCE';
          throw error;
        }
      }
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
    const { balanceDue, paymentStatus, orderStatus } = getPaymentState(bill.total_amount, paidAmount);
    await connection.execute(
      'UPDATE billings SET paid_amount = ?, balance_due = GREATEST(total_amount - ?, 0), updated_by = ? WHERE id = ? AND user_id = ?',
      [paidAmount.toFixed(2), paidAmount.toFixed(2), payment.updated_by || null, id, userId]
    );
    if (bill.source_tack_order_id != null) {
      await connection.execute(
        `UPDATE tack_orders
         SET payment_status = ?, balance_due = ?, order_status = ?
         WHERE id = ? AND user_id = ?`,
        [paymentStatus, balanceDue.toFixed(2), orderStatus, bill.source_tack_order_id, userId]
      );
    }
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
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [bills] = await connection.execute(
      'SELECT id FROM billings WHERE id = ? AND user_id = ? FOR UPDATE',
      [id, userId]
    );
    if (!bills.length) {
      await connection.rollback();
      return false;
    }

    const [payments] = await connection.execute(
      'SELECT id FROM billing_payments WHERE billing_id = ? LIMIT 1 FOR UPDATE',
      [id]
    );
    if (payments.length) {
      const error = new Error('This bill has payment history and cannot be deleted. Payment records are preserved.');
      error.code = 'BILL_HAS_PAYMENT_HISTORY';
      throw error;
    }

    const [result] = await connection.execute(
      'DELETE FROM billings WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createBilling,
  deleteBilling,
  getBillingById,
  getBillingByTackOrderId,
  getBillingProductsByIds,
  initializeBillingModule,
  listBillings,
  recordBillingPayment,
  updateBilling
};

const { pool } = require('../config/db');

async function initializeEnquiryModule() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      enquiry_code VARCHAR(30) NOT NULL,
      customer_name VARCHAR(150) NOT NULL,
      phone VARCHAR(32) NOT NULL,
      alternate_phone VARCHAR(32) NULL,
      email VARCHAR(254) NULL,
      address TEXT NULL,
      city VARCHAR(100) NULL,
      state VARCHAR(100) NULL,
      pincode VARCHAR(20) NULL,
      enquiry_type VARCHAR(50) NOT NULL,
      product_category VARCHAR(100) NULL,
      product_id INT UNSIGNED NULL,
      product_name VARCHAR(200) NULL,
      purity VARCHAR(20) NULL,
      quantity DECIMAL(12,3) NULL,
      weight DECIMAL(12,3) NULL,
      approx_budget DECIMAL(14,2) NULL,
      preferred_design VARCHAR(100) NULL,
      message TEXT NULL,
      status ENUM('New Enquiry', 'In Progress', 'Quotation Sent', 'Converted', 'Closed', 'Not Interested') NOT NULL DEFAULT 'New Enquiry',
      follow_up_date DATE NULL,
      follow_up_time TIME NULL,
      assigned_to VARCHAR(150) NULL,
      created_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
      updated_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
      source VARCHAR(80) NULL,
      priority ENUM('Low', 'Medium', 'High') NOT NULL DEFAULT 'Medium',
      whatsapp_confirmation TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_enquiries_creator_code (created_by, enquiry_code),
      INDEX idx_enquiries_status_created (status, created_at),
      INDEX idx_enquiries_phone (phone),
      INDEX idx_enquiries_product (product_id),
      INDEX idx_enquiries_created_by_created (created_by, created_at)
    )
  `);
  const [columns] = await pool.query('SHOW COLUMNS FROM enquiries');
  const existingColumns = new Set(columns.map((column) => column.Field));
  if (!existingColumns.has('enquiry_code')) {
    await pool.query('ALTER TABLE enquiries ADD COLUMN enquiry_code VARCHAR(30) NULL AFTER id');
  }
  if (!existingColumns.has('created_by')) {
    await pool.query('ALTER TABLE enquiries ADD COLUMN created_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER assigned_to');
  }
  if (!existingColumns.has('updated_by')) {
    await pool.query('ALTER TABLE enquiries ADD COLUMN updated_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER created_by');
  }
  await ensureEnquiryCodeUniquePerCreator();
  const [indexes] = await pool.query("SHOW INDEX FROM enquiries WHERE Key_name = 'idx_enquiries_created_by_created'");
  if (!indexes.length) {
    await pool.query('CREATE INDEX idx_enquiries_created_by_created ON enquiries (created_by, created_at)');
  }
}

async function ensureEnquiryCodeUniquePerCreator() {
  const [indexRows] = await pool.execute(
    `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enquiries'
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`
  );
  const indexes = new Map();
  for (const row of indexRows) {
    if (!indexes.has(row.INDEX_NAME)) {
      indexes.set(row.INDEX_NAME, { nonUnique: Number(row.NON_UNIQUE), columns: [] });
    }
    indexes.get(row.INDEX_NAME).columns.push(row.COLUMN_NAME);
  }

  for (const [name, index] of indexes) {
    if (index.nonUnique === 0 && index.columns.length === 1 && index.columns[0] === 'enquiry_code') {
      const escapedName = String(name).replace(/`/g, '``');
      await pool.query(`ALTER TABLE enquiries DROP INDEX \`${escapedName}\``);
    }
  }

  const hasCreatorCodeUniqueKey = Array.from(indexes.values()).some((index) =>
    index.nonUnique === 0
      && index.columns.length === 2
      && index.columns[0] === 'created_by'
      && index.columns[1] === 'enquiry_code'
  );
  if (!hasCreatorCodeUniqueKey) {
    const [enquiries] = await pool.execute(
      'SELECT id, created_by FROM enquiries ORDER BY created_by, created_at, id'
    );
    const nextCodeByCreator = new Map();
    for (const enquiry of enquiries) {
      const creator = enquiry.created_by === null ? null : String(enquiry.created_by);
      const nextCode = (nextCodeByCreator.get(creator) || 0) + 1;
      nextCodeByCreator.set(creator, nextCode);
      await pool.execute(
        'UPDATE enquiries SET enquiry_code = ? WHERE id = ?',
        [`ENQ-${String(nextCode).padStart(6, '0')}`, enquiry.id]
      );
    }
    await pool.query('ALTER TABLE enquiries MODIFY COLUMN enquiry_code VARCHAR(30) NOT NULL');
    await pool.query(
      'ALTER TABLE enquiries ADD UNIQUE KEY uq_enquiries_creator_code (created_by, enquiry_code)'
    );
  }
}

async function listEnquiries({ search, status, product, startDate, endDate, page, limit, ownerUserId }) {
  const conditions = [];
  const values = [];
  if (ownerUserId) {
    conditions.push('e.created_by = ?');
    values.push(ownerUserId);
  }
  if (search) {
    conditions.push('(e.enquiry_code LIKE ? OR e.customer_name LIKE ? OR e.phone LIKE ? OR e.email LIKE ? OR e.product_name LIKE ? OR e.message LIKE ?)');
    const term = `%${search}%`;
    values.push(term, term, term, term, term, term);
  }
  if (status) {
    conditions.push('e.status = ?');
    values.push(status);
  }
  if (product) {
    conditions.push('(e.product_category = ? OR e.enquiry_type = ?)');
    values.push(product, product);
  }
  if (startDate) {
    conditions.push('e.created_at >= ?');
    values.push(`${startDate} 00:00:00`);
  }
  if (endDate) {
    conditions.push('e.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
    values.push(endDate);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const [rows] = await pool.execute(
    `SELECT e.*, creator.name AS created_by_name, updater.name AS updated_by_name
     FROM enquiries e
     LEFT JOIN users creator ON creator.user_id = e.created_by
     LEFT JOIN users updater ON updater.user_id = e.updated_by
     ${where} ORDER BY e.created_at DESC, e.id DESC LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );
  const [[countRow]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM enquiries e ${where}`,
    values
  );
  const statsWhere = ownerUserId ? 'WHERE e.created_by = ?' : '';
  const [statsRows] = await pool.execute(
    `SELECT COUNT(*) AS total,
      COALESCE(SUM(e.status IN ('New Enquiry', 'In Progress', 'Quotation Sent')), 0) AS pending,
      COALESCE(SUM(e.status IN ('Converted', 'Quotation Sent')), 0) AS responded,
      COALESCE(SUM(e.status IN ('Closed', 'Not Interested')), 0) AS closed
     FROM enquiries e ${statsWhere}`,
    ownerUserId ? [ownerUserId] : []
  );
  const statsRow = statsRows[0];
  return {
    enquiries: rows.map((row) => ({ ...row, id: Number(row.id), product_id: row.product_id == null ? null : Number(row.product_id), whatsapp_confirmation: Boolean(row.whatsapp_confirmation) })),
    pagination: { page, limit, total: Number(countRow.total), totalPages: Math.max(1, Math.ceil(Number(countRow.total) / limit)) },
    stats: Object.fromEntries(Object.entries(statsRow).map(([key, value]) => [key, Number(value)]))
  };
}

async function createEnquiry(enquiry, createdByUserId) {
  const connection = await pool.getConnection();
  let publicCodeLockAcquired = false;
  let enquiryId;
  try {
    await connection.beginTransaction();
    if (createdByUserId) {
    await connection.execute(
      'SELECT user_id FROM users WHERE user_id = ? FOR UPDATE',
      [createdByUserId]
    );
    } else {
    const [[lock]] = await connection.query(
      "SELECT GET_LOCK('enquiries_public_code_sequence', 10) AS acquired"
    );
    if (Number(lock.acquired) !== 1) {
      const error = new Error('Could not acquire the enquiry code sequence lock');
      error.code = 'ENQUIRY_CODE_LOCK_TIMEOUT';
      throw error;
    }
    publicCodeLockAcquired = true;
    }
    const sequenceQuery = createdByUserId
    ? `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(enquiry_code, '-', -1) AS UNSIGNED)), 0) AS max_code
       FROM enquiries WHERE created_by = ? AND enquiry_code REGEXP '^ENQ-[0-9]+$'`
    : `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(enquiry_code, '-', -1) AS UNSIGNED)), 0) AS max_code
       FROM enquiries WHERE created_by IS NULL AND enquiry_code REGEXP '^ENQ-[0-9]+$'`;
    const [enquirySequences] = await connection.execute(
    sequenceQuery,
    createdByUserId ? [createdByUserId] : []
    );
    const enquiryCode = `ENQ-${String(Number(enquirySequences[0]?.max_code || 0) + 1).padStart(6, '0')}`;
    const fields = [
    'enquiry_code',
    'customer_name', 'phone', 'alternate_phone', 'email', 'address', 'city', 'state', 'pincode',
    'enquiry_type', 'product_category', 'product_id', 'product_name', 'purity', 'quantity', 'weight',
    'approx_budget', 'preferred_design', 'message', 'status', 'follow_up_date', 'follow_up_time',
    'assigned_to', 'source', 'priority', 'whatsapp_confirmation', 'created_by', 'updated_by'
    ];
    const [result] = await connection.execute(
    `INSERT INTO enquiries (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
    fields.map((field) => {
      if (field === 'enquiry_code') return enquiryCode;
      if (field === 'created_by' || field === 'updated_by') return createdByUserId ?? null;
      return enquiry[field] ?? null;
    })
    );
    enquiryId = result.insertId;
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    try {
    if (publicCodeLockAcquired) {
      await connection.query("SELECT RELEASE_LOCK('enquiries_public_code_sequence')");
    }
    } finally {
    connection.release();
    }
  }
  return getEnquiry(enquiryId, createdByUserId);
}

async function getEnquiry(id, ownerUserId) {
  const ownerCondition = ownerUserId ? ' AND e.created_by = ?' : '';
  const [rows] = await pool.execute(
    `SELECT e.*, creator.name AS created_by_name, updater.name AS updated_by_name
     FROM enquiries e
     LEFT JOIN users creator ON creator.user_id = e.created_by
     LEFT JOIN users updater ON updater.user_id = e.updated_by
     WHERE e.id = ?${ownerCondition}`,
    ownerUserId ? [id, ownerUserId] : [id]
  );
  if (!rows[0]) return null;
  return {
    ...rows[0],
    id: Number(rows[0].id),
    product_id: rows[0].product_id == null ? null : Number(rows[0].product_id),
    whatsapp_confirmation: Boolean(rows[0].whatsapp_confirmation)
  };
}

async function updateEnquiryStatus(id, status, updatedByUserId, ownerUserId) {
  const ownerCondition = ownerUserId ? ' AND created_by = ?' : '';
  const [result] = await pool.execute(
    `UPDATE enquiries SET status = ?, updated_by = ? WHERE id = ?${ownerCondition}`,
    [status, updatedByUserId ?? null, id, ...(ownerUserId ? [ownerUserId] : [])]
  );
  if (result.affectedRows) return true;
  return Boolean(await getEnquiry(id, ownerUserId));
}

async function updateEnquiry(id, enquiry, updatedByUserId, ownerUserId) {
  const fields = [
    'customer_name', 'phone', 'alternate_phone', 'email', 'address', 'city', 'state', 'pincode',
    'enquiry_type', 'product_category', 'product_id', 'product_name', 'purity', 'quantity', 'weight',
    'approx_budget', 'preferred_design', 'message', 'status', 'follow_up_date', 'follow_up_time',
    'assigned_to', 'source', 'priority', 'whatsapp_confirmation'
  ];
  const ownerCondition = ownerUserId ? ' AND created_by = ?' : '';
  const [result] = await pool.execute(
    `UPDATE enquiries SET ${fields.map((field) => `${field} = ?`).join(', ')}, updated_by = ? WHERE id = ?${ownerCondition}`,
    [...fields.map((field) => enquiry[field] ?? null), updatedByUserId ?? null, id, ...(ownerUserId ? [ownerUserId] : [])]
  );
  return result.affectedRows > 0 || Boolean(await getEnquiry(id, ownerUserId));
}

async function deleteEnquiry(id, ownerUserId) {
  const ownerCondition = ownerUserId ? ' AND created_by = ?' : '';
  const [result] = await pool.execute(
    `DELETE FROM enquiries WHERE id = ?${ownerCondition}`,
    ownerUserId ? [id, ownerUserId] : [id]
  );
  return result.affectedRows > 0;
}

module.exports = { createEnquiry, deleteEnquiry, getEnquiry, initializeEnquiryModule, listEnquiries, updateEnquiry, updateEnquiryStatus };

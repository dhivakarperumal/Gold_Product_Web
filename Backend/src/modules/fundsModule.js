const { pool } = require('../config/db');
const { addDateRangeCondition } = require('../utils/dateRange');

async function tableExists(tableName) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS table_count FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return Number(rows[0].table_count) > 0;
}

async function getColumns(tableName) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Map(rows.map((column) => [column.Field, column]));
}

async function removeFundAccountReference(tableName, columnName) {
  if (!await tableExists(tableName)) return;
  const columns = await getColumns(tableName);
  if (!columns.has(columnName)) return;
  const [constraints] = await pool.execute(
    `SELECT CONSTRAINT_NAME FROM information_schema.key_column_usage
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
       AND referenced_table_name = 'fund_accounts'`,
    [tableName, columnName]
  );
  for (const constraint of constraints) {
    await pool.query(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${constraint.CONSTRAINT_NAME}\``);
  }
  await pool.query(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\``);
}

function adminCreatorJoin(column, alias, tableAlias) {
  if (!column) return null;
  if (/bigint/i.test(column.Type)) {
    return `LEFT JOIN users ${alias} ON ${alias}.id = ${tableAlias}.created_by`;
  }
  return `LEFT JOIN users ${alias}
    ON ${alias}.user_id = ${tableAlias}.created_by
    OR (${tableAlias}.created_by REGEXP '^[0-9]+$'
      AND ${alias}.id = CAST(${tableAlias}.created_by AS UNSIGNED))`;
}

async function migrateLegacyFundTransactions() {
  if (!await tableExists('fund_transactions')) return;
  const transactionColumns = await getColumns('fund_transactions');
  const accountTableExists = await tableExists('fund_accounts');
  const accountColumns = accountTableExists ? await getColumns('fund_accounts') : new Map();
  const creatorJoins = [];
  const adminCandidates = [];

  const transactionCreatorJoin = adminCreatorJoin(transactionColumns.get('created_by'), 'transaction_admin', 't');
  if (transactionCreatorJoin) {
    creatorJoins.push(transactionCreatorJoin);
    adminCandidates.push("CASE WHEN transaction_admin.role = 'admin' THEN transaction_admin.user_id END");
  }
  const legacyCreator = transactionColumns.get('created_by_legacy_id');
  if (legacyCreator) {
    creatorJoins.push('LEFT JOIN users legacy_admin ON legacy_admin.id = t.created_by_legacy_id');
    adminCandidates.push("CASE WHEN legacy_admin.role = 'admin' THEN legacy_admin.user_id END");
  }
  const accountCreatorJoin = accountTableExists
    ? adminCreatorJoin(accountColumns.get('created_by'), 'account_admin', 'a')
    : null;
  if (accountCreatorJoin) {
    creatorJoins.push(accountCreatorJoin);
    adminCandidates.push("CASE WHEN account_admin.role = 'admin' THEN account_admin.user_id END");
  }
  if (!adminCandidates.length) return;

  const joins = accountTableExists
    ? `LEFT JOIN fund_accounts a ON a.id = t.account_id
       ${creatorJoins.join('\n       ')}`
    : creatorJoins.join('\n       ');
  const ownerUserId = `COALESCE(${adminCandidates.join(', ')})`;
  const statusFilter = transactionColumns.has('status') ? "AND t.status = 'POSTED'" : '';
  const categoryDescription = transactionColumns.has('category') ? "NULLIF(t.category, '')" : 'NULL';
  const description = transactionColumns.has('description') ? "NULLIF(t.description, '')" : 'NULL';
  const partyName = transactionColumns.has('party_name') ? "NULLIF(t.party_name, '')" : 'NULL';
  const relatedReference = transactionColumns.has('related_reference')
    ? "CASE WHEN t.related_reference IS NOT NULL THEN CONCAT('Reference ', t.related_reference) END"
    : 'NULL';
  const referenceNumber = transactionColumns.has('reference_number')
    ? "CASE WHEN t.reference_number IS NOT NULL THEN CONCAT('Ref ', t.reference_number) END"
    : 'NULL';
  const idempotencyKey = transactionColumns.has('idempotency_key')
    ? "COALESCE(t.idempotency_key, CONCAT('legacy-fund-transaction:', t.id))"
    : "CONCAT('legacy-fund-transaction:', t.id)";
  const transferId = transactionColumns.has('transfer_id') ? 't.transfer_id' : 'NULL';
  const createdAt = transactionColumns.has('created_at') ? 't.created_at' : 'CURRENT_TIMESTAMP';
  const updatedAt = transactionColumns.has('updated_at') ? 't.updated_at' : createdAt;

  await pool.query(`
    INSERT INTO funds (
      created_by, updated_by, transaction_type, transaction_date, amount, payment_method,
      description, admin_name, related_reference, idempotency_key, transfer_id, created_at, updated_at
    )
    SELECT admin_user.user_id, admin_user.user_id, t.transaction_type, t.transaction_date,
      t.amount, t.payment_method,
      CONCAT_WS(' | ', ${categoryDescription}, ${description}, ${partyName}, ${relatedReference}, ${referenceNumber}),
      COALESCE(NULLIF(admin_user.name, ''), admin_user.username),
      ${transactionColumns.has('related_reference') ? 't.related_reference' : 'NULL'},
      ${idempotencyKey}, ${transferId}, ${createdAt}, ${updatedAt}
    FROM fund_transactions t
    ${joins}
    JOIN users admin_user ON admin_user.user_id = ${ownerUserId} AND admin_user.role = 'admin'
    WHERE 1 = 1 ${statusFilter}
    ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(funds.id)
  `);
}

async function migrateLegacyOpeningBalances() {
  if (!await tableExists('fund_accounts')) return;
  const accountColumns = await getColumns('fund_accounts');
  if (!accountColumns.has('created_by') || !accountColumns.has('opening_balance')) return;
  const creatorJoin = adminCreatorJoin(accountColumns.get('created_by'), 'account_admin', 'a');
  if (!creatorJoin) return;
  const createdAt = accountColumns.has('created_at') ? 'a.created_at' : 'CURRENT_TIMESTAMP';
  const updatedAt = accountColumns.has('updated_at') ? 'a.updated_at' : createdAt;

  await pool.query(`
    INSERT INTO funds (
      created_by, updated_by, transaction_type, transaction_date, amount, payment_method,
      description, admin_name, idempotency_key, created_at, updated_at
    )
    SELECT account_admin.user_id, account_admin.user_id, 'FUND_ADDED', ${createdAt},
      a.opening_balance, 'Other',
      CONCAT('Opening balance migrated from account: ', a.name),
      COALESCE(NULLIF(account_admin.name, ''), account_admin.username),
      CONCAT('legacy-fund-account-opening:', a.id), ${createdAt}, ${updatedAt}
    FROM fund_accounts a
    ${creatorJoin}
    WHERE account_admin.role = 'admin' AND a.opening_balance > 0
    ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(funds.id)
  `);
}

async function initializeFundsModule() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS funds (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      created_by VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      updated_by VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      transaction_type ENUM('FUND_ADDED', 'DEBIT', 'CREDIT', 'TRANSFER_IN', 'TRANSFER_OUT') NOT NULL,
      transaction_date DATETIME NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      payment_method VARCHAR(40) NOT NULL,
      description TEXT NULL,
      admin_name VARCHAR(255) NOT NULL,
      related_reference VARCHAR(100) NULL,
      idempotency_key VARCHAR(150) NULL,
      transfer_id CHAR(36) NULL,
      UNIQUE KEY uq_funds_idempotency (idempotency_key),
      INDEX idx_funds_creator_date_id (created_by, transaction_date, id)
    )
  `);

  await migrateLegacyFundTransactions();
  await migrateLegacyOpeningBalances();
  await removeFundAccountReference('billing_payments', 'account_id');
  await removeFundAccountReference('loan_renewals', 'fund_account_id');
  await pool.query('DROP TABLE IF EXISTS fund_transactions');
  await pool.query('DROP TABLE IF EXISTS fund_accounts');
}

async function getFundBalance(connection, userId, lockOwner = false) {
  if (lockOwner) {
    const [owners] = await connection.execute(
      "SELECT user_id FROM users WHERE user_id = ? AND role = 'admin' FOR UPDATE",
      [userId]
    );
    if (!owners.length) {
      const error = new Error('The acting admin account could not be verified');
      error.code = 'FUND_ADMIN_NOT_FOUND';
      throw error;
    }
  }
  const [rows] = await connection.execute(
    `SELECT COALESCE(SUM(CASE
       WHEN transaction_type IN ('FUND_ADDED', 'CREDIT', 'TRANSFER_IN') THEN amount
       WHEN transaction_type IN ('DEBIT', 'TRANSFER_OUT') THEN -amount
       ELSE 0
     END), 0) AS balance
     FROM funds WHERE created_by = ?`,
    [userId]
  );
  return Number(rows[0].balance);
}

async function insertFundRecord(connection, entry) {
  if (!entry.created_by || !entry.admin_name) {
    const error = new Error('A valid admin identity is required to record funds');
    error.code = 'FUND_ADMIN_NOT_FOUND';
    throw error;
  }
  const [result] = await connection.execute(
    `INSERT INTO funds (
      created_by, updated_by, transaction_type, transaction_date, amount,
      payment_method, description, admin_name, related_reference, idempotency_key, transfer_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.created_by, entry.updated_by || entry.created_by, entry.transaction_type,
      entry.transaction_date, entry.amount, entry.payment_method, entry.description || null,
      entry.admin_name, entry.related_reference || null, entry.idempotency_key || null,
      entry.transfer_id || null
    ]
  );
  return result.insertId;
}

async function createFundTransaction(entry) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const balance = await getFundBalance(connection, entry.created_by, true);
    if (entry.transaction_type === 'DEBIT' && balance < Number(entry.amount)) {
      const error = new Error('The admin fund balance is not enough for this debit');
      error.code = 'INSUFFICIENT_FUNDS';
      error.available_balance = balance.toFixed(2);
      throw error;
    }
    const id = await insertFundRecord(connection, entry);
    await connection.commit();
    const [rows] = await pool.execute(
      'SELECT * FROM funds WHERE id = ? AND created_by = ?',
      [id, entry.created_by]
    );
    if (!rows.length) throw new Error('The recorded fund entry could not be loaded');
    return rows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listFundTransactions(filters) {
  const conditions = ['f.created_by = ?'];
  const values = [filters.owner_user_id];
  addDateRangeCondition(
    conditions, values, 'f.transaction_date',
    filters.dateRange || { startDate: filters.from, endDate: filters.to }
  );
  if (filters.transaction_type && filters.transaction_type !== 'ALL') {
    conditions.push('f.transaction_type = ?');
    values.push(filters.transaction_type);
  }
  if (filters.search) {
    conditions.push('(f.description LIKE ? OR f.payment_method LIKE ? OR f.admin_name LIKE ?)');
    values.push(...Array(3).fill(`%${filters.search}%`));
  }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const page = Number(filters.page || 1);
  const pageSize = Number(filters.page_size || 20);
  const offset = (page - 1) * pageSize;
  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM funds f ${where}`,
    values
  );
  const [rows] = await pool.execute(
    `SELECT f.*,
       COALESCE((
         SELECT SUM(CASE
           WHEN previous.transaction_type IN ('FUND_ADDED', 'CREDIT', 'TRANSFER_IN') THEN previous.amount
           WHEN previous.transaction_type IN ('DEBIT', 'TRANSFER_OUT') THEN -previous.amount
           ELSE 0
         END)
         FROM funds previous
         WHERE previous.created_by = f.created_by
           AND (previous.transaction_date < f.transaction_date
             OR (previous.transaction_date = f.transaction_date AND previous.id <= f.id))
       ), 0) AS running_balance
     FROM funds f ${where}
     ORDER BY f.transaction_date DESC, f.id DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );
  return { transactions: rows, total: Number(countRows[0].total), page, page_size: pageSize };
}

async function getFundSummary(dateRange = {}, ownerUserId) {
  const conditions = ['created_by = ?'];
  const values = [ownerUserId];
  addDateRangeCondition(conditions, values, 'transaction_date', dateRange);
  const [periodRows] = await pool.execute(
    `SELECT
      COALESCE(SUM(CASE WHEN transaction_type = 'FUND_ADDED' THEN amount ELSE 0 END), 0) AS fund_added,
      COALESCE(SUM(CASE WHEN transaction_type = 'DEBIT' THEN amount ELSE 0 END), 0) AS total_debit,
      COALESCE(SUM(CASE WHEN transaction_type = 'CREDIT' THEN amount ELSE 0 END), 0) AS total_credit,
      COALESCE(SUM(CASE
        WHEN transaction_type IN ('FUND_ADDED', 'CREDIT', 'TRANSFER_IN') THEN amount
        WHEN transaction_type IN ('DEBIT', 'TRANSFER_OUT') THEN -amount
        ELSE 0
      END), 0) AS net_change
     FROM funds WHERE ${conditions.join(' AND ')}`,
    values
  );
  const currentBalance = await getFundBalance(pool, ownerUserId);
  let openingBalance = 0;
  if (dateRange.startDate) {
    const [priorRows] = await pool.execute(
      `SELECT COALESCE(SUM(CASE
        WHEN transaction_type IN ('FUND_ADDED', 'CREDIT', 'TRANSFER_IN') THEN amount
        WHEN transaction_type IN ('DEBIT', 'TRANSFER_OUT') THEN -amount
        ELSE 0
      END), 0) AS opening_balance
       FROM funds WHERE created_by = ? AND transaction_date < ?`,
      [ownerUserId, `${dateRange.startDate} 00:00:00`]
    );
    openingBalance = Number(priorRows[0].opening_balance);
  }
  const period = periodRows[0];
  return {
    fund_added: period.fund_added,
    total_debit: period.total_debit,
    total_credit: period.total_credit,
    opening_balance: openingBalance,
    current_balance: currentBalance,
    closing_balance: openingBalance + Number(period.net_change)
  };
}

module.exports = {
  createFundTransaction,
  getFundBalance,
  getFundSummary,
  initializeFundsModule,
  insertFundRecord,
  listFundTransactions
};

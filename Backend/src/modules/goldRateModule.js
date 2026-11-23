const crypto = require('node:crypto');
const { pool } = require('../config/db');
const { rateForProduct, recalculateProductPrices } = require('../services/productPricing');

const RATE_SPECS = [
  { key: 'gold_999', metal_type: 'Gold', purity: '999', rate_unit: 'gram' },
  { key: 'gold_916', metal_type: 'Gold', purity: '916', rate_unit: 'gram' },
  { key: 'gold_833', metal_type: 'Gold', purity: '833', rate_unit: 'gram' },
  { key: 'gold_750', metal_type: 'Gold', purity: '750', rate_unit: 'gram' },
  { key: 'gold_585', metal_type: 'Gold', purity: '585', rate_unit: 'gram' },
  { key: 'silver_999', metal_type: 'Silver', purity: '999', rate_unit: 'gram' },
  { key: 'platinum_950', metal_type: 'Platinum', purity: '950', rate_unit: 'gram' },
  { key: 'platinum_900', metal_type: 'Platinum', purity: '900', rate_unit: 'gram' },
  { key: 'diamond_df_vvs', metal_type: 'Diamond', purity: 'D-F / VVS', rate_unit: 'carat' },
  { key: 'diamond_gh_vs', metal_type: 'Diamond', purity: 'G-H / VS', rate_unit: 'carat' },
  { key: 'diamond_ij_si', metal_type: 'Diamond', purity: 'I-J / SI', rate_unit: 'carat' }
];

async function migrateGoldRateAuditColumn(table, column, constraintName, { nullable = false } = {}) {
  const [columnRows] = await pool.execute(
    `SELECT DATA_TYPE, COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME, IS_NULLABLE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  const currentColumn = columnRows[0];
  if (!currentColumn) throw new Error(`The ${table}.${column} audit column was not created`);

  const needsUuidType = currentColumn.DATA_TYPE !== 'varchar'
    || currentColumn.COLUMN_TYPE.toLowerCase() !== 'varchar(255)'
    || currentColumn.CHARACTER_SET_NAME !== 'ascii'
    || currentColumn.COLLATION_NAME !== 'ascii_bin'
    || currentColumn.IS_NULLABLE !== (nullable ? 'YES' : 'NO');
  const [foreignKeys] = await pool.execute(
    `SELECT CONSTRAINT_NAME, REFERENCED_COLUMN_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME = 'users'`,
    [table, column]
  );
  for (const foreignKey of foreignKeys) {
    if (needsUuidType || foreignKey.REFERENCED_COLUMN_NAME !== 'user_id') {
      const escapedName = String(foreignKey.CONSTRAINT_NAME).replace(/`/g, '``');
      await pool.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${escapedName}\``);
    }
  }

  if (!nullable) {
    const [nullActors] = await pool.execute(
      `SELECT id FROM \`${table}\` WHERE \`${column}\` IS NULL LIMIT 1`
    );
    if (nullActors.length) {
      throw new Error(`Cannot migrate ${table}.${column}: row ${nullActors[0].id} has no audit user`);
    }
  }
  const [orphanedLegacyIds] = await pool.execute(
    `SELECT rate_row.id
     FROM \`${table}\` rate_row
     LEFT JOIN users legacy_user ON legacy_user.id = CAST(rate_row.\`${column}\` AS UNSIGNED)
     WHERE rate_row.\`${column}\` REGEXP '^[0-9]+$' AND legacy_user.id IS NULL
     LIMIT 1`
  );
  if (orphanedLegacyIds.length) {
    throw new Error(`Cannot migrate ${table}.${column} for row ${orphanedLegacyIds[0].id}: the user id does not exist`);
  }

  if (needsUuidType) {
    await pool.query(
      `ALTER TABLE \`${table}\`
       MODIFY COLUMN \`${column}\` VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin ${nullable ? 'NULL' : 'NOT NULL'}`
    );
  }
  await pool.query(
    `UPDATE \`${table}\` rate_row
     JOIN users legacy_user ON legacy_user.id = CAST(rate_row.\`${column}\` AS UNSIGNED)
     SET rate_row.\`${column}\` = legacy_user.user_id
     WHERE rate_row.\`${column}\` REGEXP '^[0-9]+$'`
  );

  const [orphanedUserIds] = await pool.execute(
    `SELECT rate_row.id
     FROM \`${table}\` rate_row
     LEFT JOIN users audit_user ON audit_user.user_id = rate_row.\`${column}\`
     WHERE rate_row.\`${column}\` IS NOT NULL AND audit_user.user_id IS NULL
     LIMIT 1`
  );
  if (orphanedUserIds.length) {
    throw new Error(`Cannot link ${table}.${column} for row ${orphanedUserIds[0].id}: the user_id does not exist`);
  }

  const [userIdForeignKeys] = await pool.execute(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME = 'users'
       AND REFERENCED_COLUMN_NAME = 'user_id'`,
    [table, column]
  );
  if (!userIdForeignKeys.length) {
    await pool.query(
      `ALTER TABLE \`${table}\`
       ADD CONSTRAINT \`${constraintName}\` FOREIGN KEY (\`${column}\`)
       REFERENCES users(user_id) ON DELETE ${nullable ? 'SET NULL' : 'RESTRICT'}`
    );
  }
}

async function initializeGoldRateModule() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gold_rates (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      batch_id CHAR(36) NOT NULL,
      rate_date DATE NOT NULL,
      metal_type ENUM('Gold', 'Silver', 'Platinum', 'Diamond') NOT NULL,
      purity VARCHAR(20) NOT NULL,
      rate_per_gram DECIMAL(14,2) NOT NULL,
      rate_unit ENUM('gram', 'carat') NOT NULL DEFAULT 'gram',
      making_charge_type ENUM('Percentage', 'Fixed Amount') NOT NULL DEFAULT 'Percentage',
      making_charge_value DECIMAL(12,4) NOT NULL DEFAULT 0,
      wastage_percentage DECIMAL(9,4) NOT NULL DEFAULT 0,
      status ENUM('Draft', 'Active', 'Archived') NOT NULL DEFAULT 'Draft',
      effective_from DATETIME NOT NULL,
      created_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
      updated_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      version INT UNSIGNED NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_gold_rates_batch_metal_purity (batch_id, metal_type, purity),
      UNIQUE KEY uq_gold_rates_user_date_metal_purity (user_id, rate_date, metal_type, purity),
      INDEX idx_gold_rates_user_current (user_id, status, effective_from),
      INDEX idx_gold_rates_current (status, effective_from),
      INDEX idx_gold_rates_rate_date (rate_date)
    )
  `);
  const [rateColumns] = await pool.query('SHOW COLUMNS FROM gold_rates');
  if (!rateColumns.some((column) => column.Field === 'user_id')) {
    await pool.query(
      'ALTER TABLE gold_rates ADD COLUMN user_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER id'
    );
  }
  if (!rateColumns.some((column) => column.Field === 'created_by')) {
    await pool.query(
      'ALTER TABLE gold_rates ADD COLUMN created_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER effective_from'
    );
  }
  if (!rateColumns.some((column) => column.Field === 'created_at')) {
    await pool.query('ALTER TABLE gold_rates ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
  }
  if (!rateColumns.some((column) => column.Field === 'updated_at')) {
    await pool.query('ALTER TABLE gold_rates ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  }
  const metalTypeColumn = rateColumns.find((column) => column.Field === 'metal_type');
  if (!String(metalTypeColumn?.Type || '').includes("'Platinum'")
    || !String(metalTypeColumn?.Type || '').includes("'Diamond'")) {
    await pool.query("ALTER TABLE gold_rates MODIFY metal_type ENUM('Gold', 'Silver', 'Platinum', 'Diamond') NOT NULL");
  }
  if (!rateColumns.some((column) => column.Field === 'version')) {
    await pool.query('ALTER TABLE gold_rates ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 AFTER updated_by');
  }
  if (!rateColumns.some((column) => column.Field === 'rate_unit')) {
    await pool.query("ALTER TABLE gold_rates ADD COLUMN rate_unit ENUM('gram', 'carat') NOT NULL DEFAULT 'gram' AFTER rate_per_gram");
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gold_rate_history (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      batch_id CHAR(36) NOT NULL,
      rate_id BIGINT UNSIGNED NULL,
      metal_type VARCHAR(20) NOT NULL,
      purity VARCHAR(20) NOT NULL,
      rate_unit ENUM('gram', 'carat') NOT NULL DEFAULT 'gram',
      previous_rate DECIMAL(14,2) NULL,
      new_rate DECIMAL(14,2) NULL,
      action VARCHAR(20) NOT NULL,
      reason VARCHAR(500) NOT NULL,
      changed_by VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_gold_rate_history_batch (batch_id, changed_at),
      INDEX idx_gold_rate_history_changed_at (changed_at)
    )
  `);
  const [historyColumns] = await pool.query('SHOW COLUMNS FROM gold_rate_history');
  if (!historyColumns.some((column) => column.Field === 'rate_unit')) {
    await pool.query("ALTER TABLE gold_rate_history ADD COLUMN rate_unit ENUM('gram', 'carat') NOT NULL DEFAULT 'gram' AFTER purity");
  }
  await migrateGoldRateAuditColumn('gold_rates', 'updated_by', 'fk_gold_rates_updated_by_user_id');
  await migrateGoldRateAuditColumn('gold_rate_history', 'changed_by', 'fk_gold_rate_history_changed_by_user_id');
  await pool.query(`
    UPDATE gold_rates rate_row
    JOIN gold_rate_history created_event
      ON created_event.rate_id = rate_row.id
      AND created_event.action = 'Created'
      AND created_event.id = (
        SELECT MIN(first_event.id)
        FROM gold_rate_history first_event
        WHERE first_event.rate_id = rate_row.id AND first_event.action = 'Created'
      )
    SET rate_row.created_by = created_event.changed_by
    WHERE rate_row.created_by IS NULL
  `);
  await migrateGoldRateAuditColumn(
    'gold_rates',
    'created_by',
    'fk_gold_rates_created_by_user_id',
    { nullable: true }
  );
  await pool.query('UPDATE gold_rates SET user_id = created_by WHERE user_id IS NULL AND created_by IS NOT NULL');
  await migrateGoldRateAuditColumn('gold_rates', 'user_id', 'fk_gold_rates_user_id');
  await ensureGoldRateIndexes();
}

async function ensureGoldRateIndexes() {
  const [rows] = await pool.execute(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gold_rates'`
  );
  const indexes = new Set(rows.map((row) => row.INDEX_NAME));
  if (!indexes.has('uq_gold_rates_user_date_metal_purity')) {
    await pool.query(
      'ALTER TABLE gold_rates ADD UNIQUE KEY uq_gold_rates_user_date_metal_purity (user_id, rate_date, metal_type, purity)'
    );
  }
  if (!indexes.has('idx_gold_rates_user_current')) {
    await pool.query(
      'ALTER TABLE gold_rates ADD INDEX idx_gold_rates_user_current (user_id, status, effective_from)'
    );
  }
}

function groupRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    let batch = groups.get(row.batch_id);
    if (!batch) {
      batch = {
        id: Number(row.batch_first_id || row.id),
        batch_id: row.batch_id,
        rate_date: row.rate_date_display,
        making_charge_type: row.making_charge_type,
        making_charge_value: Number(row.making_charge_value),
        wastage_percentage: Number(row.wastage_percentage),
        effective_from: row.effective_from_utc,
        user_id: row.user_id,
        status: row.status,
        updated_by: row.updated_by,
        created_by: row.created_by,
        created_by_name: row.created_by_name,
        updated_by_name: row.updated_by_name,
        updated_at: row.updated_at,
        version: Number(row.version),
        created_at: row.created_at,
        rates: []
      };
      groups.set(row.batch_id, batch);
    }
    batch.rates.push({
      id: Number(row.id),
      metal_type: row.metal_type,
      purity: row.purity,
      rate_per_gram: Number(row.rate_per_gram),
      rate_per_unit: Number(row.rate_per_gram),
      rate_unit: row.rate_unit || 'gram'
    });
  }
  return [...groups.values()];
}

const RATE_SELECT = `
  SELECT r.*, creator.username AS created_by_name, updater.username AS updated_by_name,
    DATE_FORMAT(r.rate_date, '%Y-%m-%d') AS rate_date_display,
    DATE_FORMAT(r.effective_from, '%Y-%m-%dT%H:%i:%s.000Z') AS effective_from_utc,
    (SELECT MIN(first_row.id) FROM gold_rates first_row WHERE first_row.batch_id = r.batch_id) AS batch_first_id
  FROM gold_rates r
  LEFT JOIN users creator ON creator.user_id = r.created_by
  LEFT JOIN users updater ON updater.user_id = r.updated_by
`;

async function listRateBatches({ status, limit = 100, userId } = {}) {
  if (!userId) throw new Error('A user_id is required to list daily gold rates');
  const conditions = [];
  const params = [];
  if (status) {
    conditions.push('r.status = ?');
    params.push(status);
  }
  conditions.push('r.user_id = ?');
  params.push(userId);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `${RATE_SELECT} ${where} ORDER BY rate_date DESC, created_at DESC, id`,
    params
  );
  return groupRows(rows).slice(0, limit);
}

async function getCurrentGoldRates(userId) {
  if (!userId) throw new Error('A user_id is required to load daily gold rates');
  const [rows] = await pool.execute(`
    ${RATE_SELECT}
    WHERE r.user_id = ? AND r.status = 'Active' AND r.effective_from <= UTC_TIMESTAMP()
    ORDER BY r.effective_from DESC, r.created_at DESC, r.id DESC
  `, [userId]);
  const batches = groupRows(rows);
  return batches[0] || null;
}

function findGoldRateForPurity(current, purity, metalType = 'Gold') {
  return current ? rateForProduct(current.rates, purity, metalType) : null;
}

async function recordHistory(connection, { batchId, rateId, metalType, purity, rateUnit = 'gram', previousRate, newRate, action, reason, actorUserId }) {
  await connection.execute(
    `INSERT INTO gold_rate_history
      (batch_id, rate_id, metal_type, purity, rate_unit, previous_rate, new_rate, action, reason, changed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [batchId, rateId, metalType, purity, rateUnit, previousRate, newRate, action, reason, actorUserId]
  );
}

async function createRateBatch(batch, actorUserId) {
  const connection = await pool.getConnection();
  const batchId = crypto.randomUUID();
  try {
    await connection.beginTransaction();
    for (const spec of RATE_SPECS) {
      const ratePerGram = batch.rates[spec.key];
      const [result] = await connection.execute(
        `INSERT INTO gold_rates
          (user_id, batch_id, rate_date, metal_type, purity, rate_per_gram, rate_unit, making_charge_type,
           making_charge_value, wastage_percentage, status, effective_from, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?)` ,
        [
          actorUserId, batchId, batch.rate_date, spec.metal_type, spec.purity, ratePerGram, spec.rate_unit,
          batch.making_charge_type, batch.making_charge_value, batch.wastage_percentage,
          batch.effective_from, actorUserId, actorUserId
        ]
      );
      await recordHistory(connection, {
        batchId, rateId: result.insertId, metalType: spec.metal_type, purity: spec.purity, rateUnit: spec.rate_unit,
        previousRate: null, newRate: ratePerGram, action: 'Created',
        reason: batch.reason, actorUserId
      });
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return getRateBatchById(batchId, pool, actorUserId);
}

async function getRateBatchById(id, connection = pool, userId) {
  if (!userId) throw new Error('A user_id is required to load a daily rate set');
  const params = [String(id), String(id), userId];
  const [rows] = await connection.execute(
    `${RATE_SELECT} WHERE (r.batch_id = ? OR r.id = ?) AND r.user_id = ? ORDER BY r.id`,
    params
  );
  return groupRows(rows)[0] || null;
}

async function getRateBatchRowsForUpdate(batchId, connection, userId) {
  if (!userId) throw new Error('A user_id is required to lock a daily rate set');
  const [rows] = await connection.execute(`
    SELECT r.*, creator.username AS created_by_name, updater.username AS updated_by_name,
      DATE_FORMAT(r.rate_date, '%Y-%m-%d') AS rate_date_display,
      DATE_FORMAT(r.effective_from, '%Y-%m-%dT%H:%i:%s.000Z') AS effective_from_utc,
      (SELECT MIN(first_row.id) FROM gold_rates first_row WHERE first_row.batch_id = r.batch_id) AS batch_first_id
    FROM gold_rates r
    LEFT JOIN users creator ON creator.user_id = r.created_by
    LEFT JOIN users updater ON updater.user_id = r.updated_by
    WHERE r.batch_id = ? AND r.user_id = ? ORDER BY r.id FOR UPDATE
  `, [batchId, userId]);
  return rows;
}

async function updateRateBatch(id, batch, actorUserId, expectedVersion) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const existing = await getRateBatchById(id, connection, actorUserId);
    if (!existing) {
      await connection.rollback();
      return { error: 'NOT_FOUND' };
    }
    const lockedRows = await getRateBatchRowsForUpdate(existing.batch_id, connection, actorUserId);
    const lockedBatch = groupRows(lockedRows)[0];
    if (!lockedBatch) {
      await connection.rollback();
      return { error: 'NOT_FOUND' };
    }
    if (lockedRows.some((row) => row.user_id !== actorUserId)) {
      await connection.rollback();
      return { error: 'NOT_FOUND' };
    }
    if (lockedBatch.status !== 'Draft' || lockedRows.some((row) => row.status !== 'Draft')) {
      await connection.rollback();
      return { error: 'NOT_DRAFT' };
    }
    if (expectedVersion != null && Number(expectedVersion) !== lockedBatch.version) {
      await connection.rollback();
      return { error: 'CONFLICT' };
    }
    const existingRateDate = String(existing.rate_date).slice(0, 10);
    const existingEffectiveFrom = String(existing.effective_from).replace(' ', 'T').slice(0, 19);
    const nextEffectiveFrom = batch.effective_from.replace(' ', 'T').slice(0, 19);
    const settingsChanged = existingRateDate !== batch.rate_date
      || existing.making_charge_type !== batch.making_charge_type
      || Number(existing.making_charge_value) !== batch.making_charge_value
      || Number(existing.wastage_percentage) !== batch.wastage_percentage
      || existingEffectiveFrom !== nextEffectiveFrom;
    await connection.execute(
      `UPDATE gold_rates SET rate_date = ?, making_charge_type = ?, making_charge_value = ?,
        wastage_percentage = ?, effective_from = ?, updated_by = ?, version = version + 1
       WHERE batch_id = ? AND user_id = ?`,
      [batch.rate_date, batch.making_charge_type, batch.making_charge_value, batch.wastage_percentage, batch.effective_from, actorUserId, existing.batch_id, actorUserId]
    );
    const existingRates = new Map(lockedRows.map((row) => [`${row.metal_type}:${row.purity}`, row]));
    for (const spec of RATE_SPECS) {
      const row = existingRates.get(`${spec.metal_type}:${spec.purity}`);
      const newRate = batch.rates[spec.key];
      if (!row) {
        const [result] = await connection.execute(
          `INSERT INTO gold_rates
            (user_id, batch_id, rate_date, metal_type, purity, rate_per_gram, rate_unit, making_charge_type,
             making_charge_value, wastage_percentage, status, effective_from, created_by, updated_by, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?, ?)`,
          [
            actorUserId, existing.batch_id, batch.rate_date, spec.metal_type, spec.purity, newRate, spec.rate_unit,
            batch.making_charge_type, batch.making_charge_value, batch.wastage_percentage,
            batch.effective_from, actorUserId, actorUserId, lockedBatch.version + 1
          ]
        );
        await recordHistory(connection, {
          batchId: existing.batch_id, rateId: result.insertId, metalType: spec.metal_type, purity: spec.purity,
          rateUnit: spec.rate_unit, previousRate: null, newRate, action: 'Created',
          reason: batch.reason, actorUserId
        });
        continue;
      }
      if (Number(row.rate_per_gram) !== newRate || settingsChanged) {
        await recordHistory(connection, {
          batchId: existing.batch_id, rateId: row.id, metalType: row.metal_type, purity: row.purity,
          rateUnit: row.rate_unit || spec.rate_unit,
          previousRate: row.rate_per_gram, newRate, action: 'Updated',
          reason: batch.reason, actorUserId
        });
      }
      await connection.execute(
        'UPDATE gold_rates SET rate_per_gram = ?, rate_unit = ?, updated_by = ? WHERE id = ? AND user_id = ?',
        [newRate, spec.rate_unit, actorUserId, row.id, actorUserId]
      );
    }
    await connection.execute(
      'UPDATE gold_rates SET version = ? WHERE batch_id = ? AND user_id = ?',
      [lockedBatch.version + 1, existing.batch_id, actorUserId]
    );
    await connection.commit();
    return { batch: await getRateBatchById(existing.batch_id, pool, actorUserId) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function activateRateBatch(id, reason, actorUserId, numericUserId) {
  const connection = await pool.getConnection();
  let lockAcquired = false;
  try {
    const [[lock]] = await connection.query("SELECT GET_LOCK('global_gold_rate_activation', 10) AS acquired");
    if (Number(lock.acquired) !== 1) {
      const error = new Error('Could not acquire the gold-rate activation lock');
      error.code = 'RATE_LOCK_TIMEOUT';
      throw error;
    }
    lockAcquired = true;
    await connection.beginTransaction();
    let batch = await getRateBatchById(id, connection, actorUserId);
    if (!batch) {
      await connection.rollback();
      return { error: 'NOT_FOUND' };
    }
    const draftRows = await getRateBatchRowsForUpdate(batch.batch_id, connection, actorUserId);
    batch = groupRows(draftRows)[0];
    if (!batch) {
      await connection.rollback();
      return { error: 'NOT_FOUND' };
    }
    if (draftRows.some((row) => row.user_id !== actorUserId)) {
      await connection.rollback();
      return { error: 'NOT_FOUND' };
    }
    if (batch.status !== 'Draft' || batch.rates.length !== RATE_SPECS.length
      || draftRows.length !== RATE_SPECS.length || draftRows.some((row) => row.status !== 'Draft')) {
      await connection.rollback();
      return { error: 'NOT_DRAFT' };
    }
    const [activeRows] = await connection.execute(
      `SELECT id, batch_id, metal_type, purity, rate_per_gram, rate_unit
       FROM gold_rates
       WHERE user_id = ? AND status = 'Active' AND effective_from <= UTC_TIMESTAMP()
       FOR UPDATE`,
      [actorUserId]
    );
    for (const row of activeRows) {
      await recordHistory(connection, {
        batchId: row.batch_id, rateId: row.id, metalType: row.metal_type, purity: row.purity,
        rateUnit: row.rate_unit || 'gram',
        previousRate: row.rate_per_gram, newRate: row.rate_per_gram, action: 'Archived',
        reason, actorUserId
      });
    }
    await connection.execute(
      `UPDATE gold_rates SET status = 'Archived', updated_by = ?
       WHERE user_id = ? AND status = 'Active' AND effective_from <= UTC_TIMESTAMP()`,
      [actorUserId, actorUserId]
    );
    await connection.execute(
      `UPDATE gold_rates SET status = 'Active', updated_by = ? WHERE batch_id = ? AND user_id = ?`,
      [actorUserId, batch.batch_id, actorUserId]
    );
    for (const row of batch.rates) {
      await recordHistory(connection, {
        batchId: batch.batch_id, rateId: row.id, metalType: row.metal_type, purity: row.purity,
        rateUnit: row.rate_unit || 'gram',
        previousRate: null, newRate: row.rate_per_gram, action: 'Activated',
        reason, actorUserId
      });
    }
    const [[effectiveRow]] = await connection.execute(
      'SELECT effective_from <= UTC_TIMESTAMP() AS effective_now FROM gold_rates WHERE batch_id = ? AND user_id = ? LIMIT 1',
      [batch.batch_id, actorUserId]
    );
    let priceRecalculation = null;
    if (Number(effectiveRow.effective_now) === 1) {
      priceRecalculation = await recalculateProductPrices(connection, batch.rates, {
        reason: `Daily rate activated: ${reason}`,
        rateDate: batch.rate_date,
        userId: numericUserId,
        createdByUserId: actorUserId
      });
    }
    await connection.commit();
    return { batch: await getRateBatchById(batch.batch_id, pool, actorUserId), priceRecalculation };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    try {
      if (lockAcquired) await connection.query("SELECT RELEASE_LOCK('global_gold_rate_activation')");
    } finally {
      connection.release();
    }
  }
}

async function deleteRateBatch(id, userId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const batch = await getRateBatchById(id, connection, userId);
    if (!batch) {
      await connection.rollback();
      return { error: 'NOT_FOUND' };
    }
    const rows = await getRateBatchRowsForUpdate(batch.batch_id, connection, userId);
    if (!rows.length || rows.some((row) => row.user_id !== userId)) {
      await connection.rollback();
      return { error: 'NOT_FOUND' };
    }
    if (rows.some((row) => row.status !== 'Draft')) {
      await connection.rollback();
      return { error: 'NOT_DRAFT' };
    }
    await connection.execute(
      `DELETE FROM gold_rate_history
       WHERE batch_id = ? AND EXISTS (
         SELECT 1 FROM gold_rates owner_rate
         WHERE owner_rate.batch_id = gold_rate_history.batch_id AND owner_rate.user_id = ?
       )`,
      [batch.batch_id, userId]
    );
    await connection.execute(
      'DELETE FROM gold_rates WHERE batch_id = ? AND user_id = ?',
      [batch.batch_id, userId]
    );
    await connection.commit();
    return { deleted: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listRateHistory({ limit = 250, userId } = {}) {
  if (!userId) throw new Error('A user_id is required to list daily rate history');
  const params = [userId, limit];
  const [rows] = await pool.execute(
    `SELECT h.id, h.batch_id, h.rate_id, h.metal_type, h.purity, h.rate_unit, h.previous_rate,
      h.new_rate, h.action, h.reason, h.changed_by, h.changed_at, u.username AS updated_by_name
     FROM gold_rate_history h LEFT JOIN users u ON u.user_id = h.changed_by
     WHERE EXISTS (
       SELECT 1 FROM gold_rates owner_rate
       WHERE owner_rate.batch_id = h.batch_id AND owner_rate.user_id = ?
     )
     ORDER BY h.changed_at DESC, h.id DESC LIMIT ?`,
    params
  );
  return rows.map((row) => ({
    ...row,
    previous_rate: row.previous_rate == null ? null : Number(row.previous_rate),
    new_rate: row.new_rate == null ? null : Number(row.new_rate)
  }));
}

module.exports = {
  RATE_SPECS,
  activateRateBatch,
  createRateBatch,
  deleteRateBatch,
  getCurrentGoldRates,
  getRateBatchById,
  findGoldRateForPurity,
  initializeGoldRateModule,
  listRateBatches,
  listRateHistory,
  updateRateBatch
};

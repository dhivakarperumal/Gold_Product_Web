const crypto = require('node:crypto');
const { pool } = require('../config/db');

class SubscriptionPlanError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const PLAN_COLUMNS = [
  'plan_uuid', 'plan_name', 'plan_code', 'description',
  'monthly_price', 'quarterly_price', 'half_yearly_price', 'yearly_price',
  'setup_fee', 'free_trial_days', 'max_branches', 'max_staff', 'max_users',
  'max_products', 'max_monthly_invoices', 'features', 'grace_period_days',
  'is_featured', 'display_order', 'status'
];

async function ensurePlanColumn(name, definition) {
  const [rows] = await pool.execute(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = ?`,
    [name]
  );
  if (!rows.length) await pool.query(`ALTER TABLE subscription_plans ADD COLUMN ${definition}`);
}

async function initializeSubscriptionPlanModule() {
  await ensurePlanColumn('plan_uuid', "plan_uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL");
  await ensurePlanColumn('plan_code', "plan_code VARCHAR(50) NULL");
  await ensurePlanColumn('description', "description TEXT NULL");
  await ensurePlanColumn('half_yearly_price', "half_yearly_price DECIMAL(10,2) NULL");
  await ensurePlanColumn('setup_fee', "setup_fee DECIMAL(10,2) NOT NULL DEFAULT 0");
  await ensurePlanColumn('free_trial_days', "free_trial_days INT UNSIGNED NOT NULL DEFAULT 0");
  await ensurePlanColumn('max_users', "max_users INT UNSIGNED NULL");
  await ensurePlanColumn('max_products', "max_products INT UNSIGNED NULL");
  await ensurePlanColumn('max_monthly_invoices', "max_monthly_invoices INT UNSIGNED NULL");
  await ensurePlanColumn('grace_period_days', "grace_period_days INT UNSIGNED NOT NULL DEFAULT 0");
  await ensurePlanColumn('is_featured', "is_featured TINYINT(1) NOT NULL DEFAULT 0");
  await ensurePlanColumn('display_order', "display_order INT UNSIGNED NOT NULL DEFAULT 0");

  const [halfYearlyColumns] = await pool.execute(
    "SHOW COLUMNS FROM subscriptions LIKE 'duration'"
  );
  if (halfYearlyColumns.length) {
    const durationType = String(halfYearlyColumns[0].Type || '');
    if (!durationType.includes('half_yearly')) {
      await pool.query(
        "ALTER TABLE subscriptions MODIFY COLUMN duration ENUM('monthly','quarterly','half_yearly','yearly') NOT NULL"
      );
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscription_plan_history (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      plan_id INT UNSIGNED NULL,
      old_values JSON NULL,
      new_values JSON NULL,
      changed_by INT UNSIGNED NULL,
      changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_subscription_plan_history_plan (plan_id),
      CONSTRAINT fk_subscription_plan_history_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL,
      CONSTRAINT fk_subscription_plan_history_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);

  const [plans] = await pool.execute('SELECT id, plan_name, plan_uuid, plan_code FROM subscription_plans');
  for (const plan of plans) {
    const updates = [];
    const values = [];
    if (!plan.plan_uuid) {
      updates.push('plan_uuid = ?');
      values.push(crypto.randomUUID());
    }
    if (!plan.plan_code) {
      updates.push('plan_code = ?');
      values.push(`PLAN-${String(plan.id).padStart(4, '0')}`);
    }
    if (updates.length) {
      values.push(plan.id);
      await pool.execute(`UPDATE subscription_plans SET ${updates.join(', ')} WHERE id = ?`, values);
    }
  }
  await pool.query(
    `UPDATE subscription_plans
     SET half_yearly_price = ROUND(monthly_price * 6, 2)
     WHERE half_yearly_price IS NULL`
  );

  await pool.query('CREATE UNIQUE INDEX uq_subscription_plans_uuid ON subscription_plans(plan_uuid)').catch((error) => {
    if (error.code !== 'ER_DUP_KEYNAME') throw error;
  });
  await pool.query('CREATE UNIQUE INDEX uq_subscription_plans_code ON subscription_plans(plan_code)').catch((error) => {
    if (error.code !== 'ER_DUP_KEYNAME') throw error;
  });
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function normalizePlan(input) {
  const planName = String(input.planName ?? input.plan_name ?? '').trim();
  const planCode = String(input.planCode ?? input.plan_code ?? '').trim().toUpperCase();
  if (!planName) throw new SubscriptionPlanError(400, 'Plan name is required');
  if (planName.length > 80) throw new SubscriptionPlanError(400, 'Plan name must be 80 characters or fewer');
  if (planCode && (!/^[A-Z0-9-]{2,50}$/.test(planCode))) {
    throw new SubscriptionPlanError(400, 'Plan code must contain 2-50 letters, numbers, or hyphen');
  }

  const description = String(input.description ?? '').trim();
  if (description.length > 5000) throw new SubscriptionPlanError(400, 'Description is too long');

  const fields = [
    ['monthlyPrice', 'monthly_price'], ['quarterlyPrice', 'quarterly_price'],
    ['halfYearlyPrice', 'half_yearly_price'], ['yearlyPrice', 'yearly_price'],
    ['setupFee', 'setup_fee']
  ];
  const prices = {};
  for (const [camel, snake] of fields) {
    const raw = input[camel] ?? input[snake] ?? 0;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 99999999.99) {
      throw new SubscriptionPlanError(400, 'Plan prices and setup fee must be valid non-negative amounts');
    }
    prices[snake] = value;
  }

  const integerFields = {
    freeTrialDays: 'free_trial_days', maxBranches: 'max_branches', maxStaff: 'max_staff',
    maxUsers: 'max_users', maxProducts: 'max_products', maxMonthlyInvoices: 'max_monthly_invoices',
    gracePeriodDays: 'grace_period_days', displayOrder: 'display_order'
  };
  const limits = {};
  for (const [camel, snake] of Object.entries(integerFields)) {
    const raw = input[camel] ?? input[snake];
    const value = raw == null || raw === '' ? (snake === 'display_order' ? 0 : null) : Number(raw);
    if (value !== null && (!Number.isSafeInteger(value) || value < 0 || value > 1000000)) {
      throw new SubscriptionPlanError(400, `${snake.replaceAll('_', ' ')} is invalid`);
    }
    limits[snake] = value;
  }

  const status = String(input.status ?? 'active').trim().toLowerCase();
  if (!['active', 'inactive'].includes(status)) throw new SubscriptionPlanError(400, 'Plan status is invalid');
  const isFeatured = input.isFeatured ?? input.is_featured ? 1 : 0;
  const features = input.features && typeof input.features === 'object'
    ? Object.fromEntries(Object.entries(input.features).map(([key, value]) => [key, Boolean(value)]))
    : {};

  return {
    plan_name: planName,
    plan_code: planCode || null,
    description,
    ...prices,
    ...limits,
    free_trial_days: limits.free_trial_days ?? 0,
    grace_period_days: limits.grace_period_days ?? 0,
    display_order: limits.display_order ?? 0,
    features,
    is_featured: isFeatured,
    status
  };
}

async function generatePlanCode(connection, name) {
  const prefix = String(name).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12) || 'PLAN';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    const [rows] = await connection.execute('SELECT id FROM subscription_plans WHERE plan_code = ? LIMIT 1', [code]);
    if (!rows.length) return code;
  }
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

async function logPlanHistory(connection, planId, actorId, oldValues, newValues) {
  await connection.execute(
    `INSERT INTO subscription_plan_history (plan_id, old_values, new_values, changed_by)
     VALUES (?, ?, ?, ?)`,
    [planId, JSON.stringify(oldValues || {}), JSON.stringify(newValues || {}), actorId]
  );
}

function formatPlan(row) {
  return {
    ...row,
    monthly_price: Number(row.monthly_price || 0),
    quarterly_price: Number(row.quarterly_price || 0),
    half_yearly_price: Number(row.half_yearly_price || 0),
    yearly_price: Number(row.yearly_price || 0),
    setup_fee: Number(row.setup_fee || 0),
    is_featured: Boolean(row.is_featured),
    features: parseJson(row.features)
  };
}

async function listSubscriptionPlans({ search = '', status = 'all', page = 1, pageSize = 10 }) {
  const conditions = [];
  const values = [];
  if (search) {
    conditions.push('(sp.plan_name LIKE ? OR sp.plan_code LIKE ?)');
    values.push(`%${search}%`, `%${search}%`);
  }
  if (status !== 'all') {
    conditions.push('sp.status = ?');
    values.push(status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [plans] = await pool.execute(
    `SELECT sp.*, COUNT(DISTINCT sub.id) AS active_subscriptions,
            COUNT(DISTINCT CASE WHEN sub.subscription_status = 'active' THEN gs.id END) AS shops_using
     FROM subscription_plans sp
     LEFT JOIN subscriptions sub ON sub.plan_id = sp.id
       AND sub.subscription_status IN ('active','pending')
     LEFT JOIN gold_shops gs ON gs.id = sub.gold_shop_id AND gs.deleted_at IS NULL
     ${where}
     GROUP BY sp.id
     ORDER BY sp.display_order ASC, sp.plan_name ASC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize]
  );
  const [counts] = await pool.execute(
    `SELECT COUNT(*) AS total,
      SUM(status='active') AS active,
      SUM(status='inactive') AS inactive
     FROM subscription_plans`
  );
  const [usage] = await pool.execute(
    `SELECT COUNT(DISTINCT plan_id) AS total_shop_usage
     FROM subscriptions sub
     JOIN gold_shops gs ON gs.id = sub.gold_shop_id
     WHERE gs.deleted_at IS NULL AND sub.subscription_status IN ('active','pending')`
  );
  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM subscription_plans sp ${where}`,
    values
  );
  return {
    plans: plans.map(formatPlan),
    summary: {
      total_plans: Number(counts[0].total || 0),
      active_plans: Number(counts[0].active || 0),
      inactive_plans: Number(counts[0].inactive || 0),
      total_shops_using: Number(usage[0].total_shop_usage || 0)
    },
    pagination: {
      page,
      pageSize,
      total: Number(countRows[0].total || 0),
      totalPages: Math.ceil(Number(countRows[0].total || 0) / pageSize)
    }
  };
}

async function getSubscriptionPlan(id) {
  const [rows] = await pool.execute(
    `SELECT sp.*, COUNT(DISTINCT sub.id) AS active_subscriptions
     FROM subscription_plans sp
     LEFT JOIN subscriptions sub ON sub.plan_id = sp.id
       AND sub.subscription_status IN ('active','pending')
     WHERE sp.id = ? GROUP BY sp.id`,
    [id]
  );
  if (!rows[0]) return null;
  const [history] = await pool.execute(
    `SELECT h.*, u.username AS changed_by_name
     FROM subscription_plan_history h LEFT JOIN users u ON u.id=h.changed_by
     WHERE h.plan_id=? ORDER BY h.changed_at DESC, h.id DESC LIMIT 20`,
    [id]
  );
  return { ...formatPlan(rows[0]), history };
}

async function createSubscriptionPlan(input, actorId) {
  const plan = normalizePlan(input);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (!plan.plan_code) plan.plan_code = await generatePlanCode(connection, plan.plan_name);
    const [existing] = await connection.execute(
      'SELECT id FROM subscription_plans WHERE plan_code=? OR plan_name=? LIMIT 1',
      [plan.plan_code, plan.plan_name]
    );
    if (existing.length) throw new SubscriptionPlanError(409, 'Plan name or plan code already exists');

    const [result] = await connection.execute(
      `INSERT INTO subscription_plans
       (plan_uuid, plan_name, plan_code, description, monthly_price, quarterly_price,
        half_yearly_price, yearly_price, setup_fee, free_trial_days, max_branches,
        max_staff, max_users, max_products, max_monthly_invoices, features,
        grace_period_days, is_featured, display_order, status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), plan.plan_name, plan.plan_code, plan.description,
        plan.monthly_price, plan.quarterly_price, plan.half_yearly_price, plan.yearly_price,
        plan.setup_fee, plan.free_trial_days, plan.max_branches, plan.max_staff, plan.max_users,
        plan.max_products, plan.max_monthly_invoices, JSON.stringify(plan.features),
        plan.grace_period_days, plan.is_featured, plan.display_order, plan.status, actorId, actorId]
    );
    await logPlanHistory(connection, result.insertId, actorId, {}, plan);
    await connection.commit();
    return getSubscriptionPlan(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateSubscriptionPlan(id, input, actorId) {
  const plan = normalizePlan(input);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [oldRows] = await connection.execute('SELECT * FROM subscription_plans WHERE id=? FOR UPDATE', [id]);
    if (!oldRows[0]) return null;
    if (!plan.plan_code) plan.plan_code = await generatePlanCode(connection, plan.plan_name);
    const [duplicate] = await connection.execute(
      'SELECT id FROM subscription_plans WHERE id<>? AND (plan_code=? OR plan_name=?) LIMIT 1',
      [id, plan.plan_code, plan.plan_name]
    );
    if (duplicate.length) throw new SubscriptionPlanError(409, 'Plan name or plan code already exists');
    await connection.execute(
      `UPDATE subscription_plans SET plan_name=?, plan_code=?, description=?,
       monthly_price=?, quarterly_price=?, half_yearly_price=?, yearly_price=?,
       setup_fee=?, free_trial_days=?, max_branches=?, max_staff=?, max_users=?,
       max_products=?, max_monthly_invoices=?, features=?, grace_period_days=?,
       is_featured=?, display_order=?, status=?, updated_by=? WHERE id=?`,
      [plan.plan_name, plan.plan_code, plan.description, plan.monthly_price,
        plan.quarterly_price, plan.half_yearly_price, plan.yearly_price, plan.setup_fee,
        plan.free_trial_days, plan.max_branches, plan.max_staff, plan.max_users,
        plan.max_products, plan.max_monthly_invoices, JSON.stringify(plan.features),
        plan.grace_period_days, plan.is_featured, plan.display_order, plan.status, actorId, id]
    );
    await logPlanHistory(connection, id, actorId, formatPlan(oldRows[0]), plan);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return getSubscriptionPlan(id);
}

async function setSubscriptionPlanStatus(id, status, actorId) {
  if (!['active', 'inactive'].includes(status)) throw new SubscriptionPlanError(400, 'Plan status is invalid');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT * FROM subscription_plans WHERE id=? FOR UPDATE', [id]);
    if (!rows[0]) return null;
    await connection.execute('UPDATE subscription_plans SET status=?, updated_by=? WHERE id=?', [status, actorId, id]);
    await logPlanHistory(connection, id, actorId, formatPlan(rows[0]), { ...formatPlan(rows[0]), status });
    await connection.commit();
  } finally {
    connection.release();
  }
  return getSubscriptionPlan(id);
}

async function duplicateSubscriptionPlan(id, actorId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT * FROM subscription_plans WHERE id=? FOR UPDATE', [id]);
    if (!rows[0]) return null;
    const source = formatPlan(rows[0]);
    const duplicateName = `${source.plan_name} Copy`.slice(0, 80);
    const duplicateCode = await generatePlanCode(connection, duplicateName);
    const [result] = await connection.execute(
      `INSERT INTO subscription_plans
       (plan_uuid, plan_name, plan_code, description, monthly_price, quarterly_price,
        half_yearly_price, yearly_price, setup_fee, free_trial_days, max_branches,
        max_staff, max_users, max_products, max_monthly_invoices, features,
        grace_period_days, is_featured, display_order, status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'inactive', ?, ?)`,
      [crypto.randomUUID(), duplicateName, duplicateCode, source.description,
        source.monthly_price, source.quarterly_price, source.half_yearly_price, source.yearly_price,
        source.setup_fee, source.free_trial_days, source.max_branches, source.max_staff,
        source.max_users, source.max_products, source.max_monthly_invoices,
        JSON.stringify(source.features), source.grace_period_days, source.is_featured,
        source.display_order + 1, actorId, actorId]
    );
    await logPlanHistory(connection, result.insertId, actorId, {}, { duplicated_from: id });
    await connection.commit();
    return getSubscriptionPlan(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteSubscriptionPlan(id, actorId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [usage] = await connection.execute(
      `SELECT COUNT(*) AS used FROM subscriptions
       WHERE plan_id=? AND subscription_status IN ('active','pending')`,
      [id]
    );
    if (Number(usage[0].used) > 0) throw new SubscriptionPlanError(409, 'Cannot delete a plan that is used by active or pending subscriptions');
    const [rows] = await connection.execute('SELECT * FROM subscription_plans WHERE id=? FOR UPDATE', [id]);
    if (!rows[0]) return null;
    await logPlanHistory(connection, id, actorId, formatPlan(rows[0]), {});
    await connection.execute('DELETE FROM subscription_plans WHERE id=?', [id]);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  SubscriptionPlanError,
  initializeSubscriptionPlanModule,
  normalizePlan,
  listSubscriptionPlans,
  getSubscriptionPlan,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  setSubscriptionPlanStatus,
  duplicateSubscriptionPlan,
  deleteSubscriptionPlan
};

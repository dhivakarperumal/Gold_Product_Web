const crypto = require('node:crypto');
const { pool } = require('../config/db');

const DEFAULT_PLANS = [
  { name: 'Basic', monthly: 500, features: ['Shop profile', 'Core inventory'] },
  { name: 'Standard', monthly: 700, features: ['Shop profile', 'Inventory', 'Reports'] },
  { name: 'Premium', monthly: 999, features: ['Shop profile', 'Inventory', 'Reports', 'Priority support'] }
];

const DURATION_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 };
const PRICE_COLUMNS = {
  monthly: 'monthly_price',
  quarterly: 'quarterly_price',
  yearly: 'yearly_price'
};

function dateParts(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1000 || year > 9999) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === value ? [year, month, day] : null;
}

function isValidDate(value) {
  return dateParts(value) !== null;
}

class GoldShopError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function calculateEndDate(startDate, duration) {
  const months = DURATION_MONTHS[duration];
  if (!months) throw new GoldShopError(400, 'Subscription duration is invalid');

  const parts = dateParts(startDate);
  if (!parts) throw new GoldShopError(400, 'Subscription start date is invalid');
  const [year, month, day] = parts;
  const start = new Date(Date.UTC(year, month - 1, day));
  const targetMonth = start.getUTCMonth() + months;
  const target = new Date(Date.UTC(start.getUTCFullYear(), targetMonth, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

function getPlanPrice(plan, duration) {
  const column = PRICE_COLUMNS[duration];
  if (!column) throw new GoldShopError(400, 'Subscription duration is invalid');
  const amount = Number(plan[column]);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new GoldShopError(409, `The ${plan.plan_name} ${duration} price is not configured`);
  }
  return amount;
}

async function initializeSuperAdminGoldShopModule() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      plan_name VARCHAR(80) NOT NULL,
      monthly_price DECIMAL(10, 2) NOT NULL,
      quarterly_price DECIMAL(10, 2) NOT NULL,
      yearly_price DECIMAL(10, 2) NOT NULL,
      max_branches INT UNSIGNED NULL,
      max_staff INT UNSIGNED NULL,
      features JSON NULL,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by INT UNSIGNED NULL,
      updated_by INT UNSIGNED NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_subscription_plans_name (plan_name),
      CONSTRAINT fk_subscription_plans_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_subscription_plans_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gold_shops (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      shop_uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      shop_code VARCHAR(50) NOT NULL,
      shop_name VARCHAR(150) NOT NULL,
      owner_name VARCHAR(150) NOT NULL,
      mobile VARCHAR(20) NOT NULL,
      email VARCHAR(255) NULL,
      gst_number VARCHAR(20) NULL,
      address TEXT NULL,
      city VARCHAR(100) NULL,
      state VARCHAR(100) NULL,
      pincode VARCHAR(20) NULL,
      status ENUM('active', 'inactive', 'pending', 'suspended') NOT NULL DEFAULT 'pending',
      notes TEXT NULL,
      max_branches INT UNSIGNED NOT NULL,
      max_staff INT UNSIGNED NOT NULL,
      deleted_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by INT UNSIGNED NULL,
      updated_by INT UNSIGNED NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_gold_shops_uuid (shop_uuid),
      UNIQUE KEY uq_gold_shops_code (shop_code),
      UNIQUE KEY uq_gold_shops_email (email),
      UNIQUE KEY uq_gold_shops_gst_number (gst_number),
      UNIQUE KEY uq_gold_shops_name_mobile (shop_name, mobile),
      KEY idx_gold_shops_status (status),
      KEY idx_gold_shops_city (city),
      CONSTRAINT fk_gold_shops_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_gold_shops_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      gold_shop_id INT UNSIGNED NOT NULL,
      plan_id INT UNSIGNED NOT NULL,
      duration ENUM('monthly', 'quarterly', 'yearly') NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      payment_status ENUM('paid', 'pending', 'unpaid') NOT NULL DEFAULT 'pending',
      subscription_status ENUM('active', 'pending', 'expired', 'suspended') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by INT UNSIGNED NULL,
      updated_by INT UNSIGNED NULL,
      PRIMARY KEY (id),
      KEY idx_subscriptions_shop (gold_shop_id, id),
      KEY idx_subscriptions_plan (plan_id),
      KEY idx_subscriptions_expiry (subscription_status, end_date),
      CONSTRAINT fk_subscriptions_shop FOREIGN KEY (gold_shop_id) REFERENCES gold_shops(id) ON DELETE RESTRICT,
      CONSTRAINT fk_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT,
      CONSTRAINT fk_subscriptions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_subscriptions_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      gold_shop_id INT UNSIGNED NOT NULL,
      subscription_id INT UNSIGNED NOT NULL,
      transaction_id VARCHAR(120) NULL,
      amount DECIMAL(10, 2) NOT NULL,
      payment_method VARCHAR(50) NULL,
      payment_status ENUM('paid', 'pending', 'unpaid') NOT NULL DEFAULT 'pending',
      payment_date DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by INT UNSIGNED NULL,
      updated_by INT UNSIGNED NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_payments_transaction_id (transaction_id),
      KEY idx_payments_shop (gold_shop_id, created_at),
      KEY idx_payments_subscription (subscription_id),
      CONSTRAINT fk_payments_shop FOREIGN KEY (gold_shop_id) REFERENCES gold_shops(id) ON DELETE RESTRICT,
      CONSTRAINT fk_payments_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT,
      CONSTRAINT fk_payments_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_payments_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gold_shop_activity_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      gold_shop_id INT UNSIGNED NULL,
      actor_id INT UNSIGNED NULL,
      action VARCHAR(100) NOT NULL,
      details JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_gold_shop_activity (gold_shop_id, created_at),
      CONSTRAINT fk_gold_shop_activity_shop FOREIGN KEY (gold_shop_id) REFERENCES gold_shops(id) ON DELETE SET NULL,
      CONSTRAINT fk_gold_shop_activity_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);

  for (const plan of DEFAULT_PLANS) {
    const monthly = plan.monthly;
    await pool.execute(
      `INSERT INTO subscription_plans
         (plan_name, monthly_price, quarterly_price, yearly_price, max_branches, max_staff, features, status)
       VALUES (?, ?, ?, ?, NULL, NULL, ?, 'active')
       ON DUPLICATE KEY UPDATE plan_name = VALUES(plan_name)`,
      [plan.name, monthly, monthly * 3, monthly * 12, JSON.stringify(plan.features)]
    );
  }
}

async function logActivity(connection, shopId, actorId, action, details) {
  await connection.execute(
    `INSERT INTO gold_shop_activity_logs (gold_shop_id, actor_id, action, details)
     VALUES (?, ?, ?, ?)`,
    [shopId || null, actorId || null, action, JSON.stringify(details || {})]
  );
}

async function expireSubscriptions() {
  await pool.execute(
    `INSERT INTO gold_shop_activity_logs (gold_shop_id, actor_id, action, details)
     SELECT gold_shop_id, NULL, 'subscription.expired', JSON_OBJECT('subscription_id', id)
     FROM subscriptions
     WHERE subscription_status IN ('active', 'pending') AND end_date < CURRENT_DATE()`
  );
  await pool.execute(
    `UPDATE subscriptions
     SET subscription_status = 'expired'
     WHERE subscription_status IN ('active', 'pending') AND end_date < CURRENT_DATE()`
  );
  await pool.execute(
    `INSERT INTO gold_shop_activity_logs (gold_shop_id, actor_id, action, details)
     SELECT s.id, NULL, 'shop.deactivated_after_expiry', JSON_OBJECT()
     FROM gold_shops s
     WHERE s.deleted_at IS NULL AND s.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM subscriptions sub
         WHERE sub.gold_shop_id = s.id AND sub.subscription_status = 'active'
           AND sub.payment_status = 'paid' AND sub.end_date >= CURRENT_DATE()
       )`
  );
  await pool.execute(
    `UPDATE gold_shops s
     SET s.status = 'inactive'
     WHERE s.deleted_at IS NULL AND s.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM subscriptions sub
         WHERE sub.gold_shop_id = s.id AND sub.subscription_status = 'active'
           AND sub.payment_status = 'paid' AND sub.end_date >= CURRENT_DATE()
       )`
  );
}

function latestSubscriptionJoin() {
  return `LEFT JOIN subscriptions sub
            ON sub.id = (SELECT MAX(s2.id) FROM subscriptions s2 WHERE s2.gold_shop_id = gs.id)
          LEFT JOIN subscription_plans sp ON sp.id = sub.plan_id`;
}

function shopWhere(filters, values) {
  const conditions = ['gs.deleted_at IS NULL'];
  const query = String(filters.search || '').trim();
  if (query) {
    const term = `%${query}%`;
    conditions.push('(gs.shop_name LIKE ? OR gs.shop_code LIKE ? OR gs.owner_name LIKE ? OR gs.mobile LIKE ?)');
    values.push(term, term, term, term);
  }
  if (filters.status && filters.status !== 'all') {
    conditions.push('gs.status = ?');
    values.push(filters.status);
  }
  if (filters.planId) {
    conditions.push('sub.plan_id = ?');
    values.push(filters.planId);
  }
  return conditions.join(' AND ');
}

async function listGoldShops({ search, status, planId, page, pageSize }) {
  await expireSubscriptions();
  const values = [];
  const where = shopWhere({ search, status, planId }, values);
  const offset = (page - 1) * pageSize;
  const [shops] = await pool.execute(
    `SELECT gs.id, gs.shop_uuid, gs.shop_code, gs.shop_name, gs.owner_name, gs.mobile,
            gs.email, gs.city, gs.state, gs.status, gs.max_branches, gs.max_staff,
            gs.created_at, sub.id AS subscription_id, sub.duration, sub.amount,
            sub.start_date, sub.end_date AS subscription_expiry,
            sub.payment_status, sub.subscription_status, sub.plan_id, sp.plan_name
     FROM gold_shops gs
     ${latestSubscriptionJoin()}
     WHERE ${where}
     ORDER BY gs.created_at DESC, gs.id DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );
  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM gold_shops gs ${latestSubscriptionJoin()} WHERE ${where}`,
    values
  );
  const [summaryRows] = await pool.execute(
    `SELECT COUNT(*) AS total_shops,
            SUM(status = 'active') AS active_shops,
            SUM(status = 'inactive') AS inactive_shops,
            SUM(status = 'pending') AS pending_shops,
            SUM(status = 'suspended') AS suspended_shops
     FROM gold_shops WHERE deleted_at IS NULL`
  );
  const [expiredRows] = await pool.execute(
    `SELECT COUNT(*) AS expired_subscriptions
     FROM subscriptions sub
     JOIN gold_shops gs ON gs.id = sub.gold_shop_id
     WHERE gs.deleted_at IS NULL AND sub.subscription_status = 'expired'`
  );
  const total = Number(countRows[0]?.total || 0);
  const summary = summaryRows[0] || {};
  return {
    shops,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    summary: {
      total_shops: Number(summary.total_shops || 0),
      active_shops: Number(summary.active_shops || 0),
      inactive_shops: Number(summary.inactive_shops || 0),
      pending_shops: Number(summary.pending_shops || 0),
      suspended_shops: Number(summary.suspended_shops || 0),
      expired_subscriptions: Number(expiredRows[0]?.expired_subscriptions || 0)
    }
  };
}

async function getSubscriptionPlans() {
  const [plans] = await pool.execute(
    `SELECT id, plan_name, monthly_price, quarterly_price, yearly_price,
            max_branches, max_staff, features, status
     FROM subscription_plans WHERE status = 'active' ORDER BY id`
  );
  return plans.map((plan) => ({
    ...plan,
    monthly_price: Number(plan.monthly_price),
    quarterly_price: Number(plan.quarterly_price),
    yearly_price: Number(plan.yearly_price),
    features: typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || [])
  }));
}

async function getGoldShopDetails(id) {
  await expireSubscriptions();
  const [shops] = await pool.execute(
    `SELECT gs.*, creator.username AS created_by_name, updater.username AS updated_by_name,
            sub.id AS current_subscription_id, sub.plan_id, sp.plan_name, sub.duration,
            sub.amount AS subscription_amount, sub.start_date, sub.end_date,
            sub.payment_status, sub.subscription_status
     FROM gold_shops gs
     ${latestSubscriptionJoin()}
     LEFT JOIN users creator ON creator.id = gs.created_by
     LEFT JOIN users updater ON updater.id = gs.updated_by
     WHERE gs.id = ? AND gs.deleted_at IS NULL`,
    [id]
  );
  if (!shops[0]) return null;
  const [subscriptions] = await pool.execute(
    `SELECT sub.id, sub.plan_id, sp.plan_name, sub.duration, sub.amount,
            sub.start_date, sub.end_date, sub.payment_status, sub.subscription_status,
            sub.created_at, creator.username AS created_by_name
     FROM subscriptions sub
     JOIN subscription_plans sp ON sp.id = sub.plan_id
     LEFT JOIN users creator ON creator.id = sub.created_by
     WHERE sub.gold_shop_id = ? ORDER BY sub.id DESC`,
    [id]
  );
  const [payments] = await pool.execute(
    `SELECT p.id, p.subscription_id, p.transaction_id, p.amount, p.payment_method,
            p.payment_status, p.payment_date, p.created_at, creator.username AS created_by_name
     FROM payments p
     LEFT JOIN users creator ON creator.id = p.created_by
     WHERE p.gold_shop_id = ? ORDER BY p.id DESC`,
    [id]
  );
  const [activity] = await pool.execute(
    `SELECT l.id, l.action, l.details, l.created_at, actor.username AS actor_name
     FROM gold_shop_activity_logs l
     LEFT JOIN users actor ON actor.id = l.actor_id
     WHERE l.gold_shop_id = ? ORDER BY l.id DESC LIMIT 50`,
    [id]
  );
  return { ...shops[0], subscriptions, payments, activity };
}

async function createGoldShop(input, actorId) {
  const connection = await pool.getConnection();
  let shopId;
  try {
    await connection.beginTransaction();
    const shopUuid = crypto.randomUUID();
    const temporaryCode = `TMP-${crypto.randomUUID()}`;
    const [shopResult] = await connection.execute(
      `INSERT INTO gold_shops
         (shop_uuid, shop_code, shop_name, owner_name, mobile, email, gst_number,
          address, city, state, pincode, status, notes, max_branches, max_staff, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [shopUuid, temporaryCode, input.shop_name, input.owner_name, input.mobile, input.email,
        input.gst_number, input.address, input.city, input.state, input.pincode, input.status,
        input.notes, input.max_branches, input.max_staff, actorId, actorId]
    );
    shopId = shopResult.insertId;
    const shopCode = `GOLD-${String(shopId).padStart(4, '0')}`;
    await connection.execute('UPDATE gold_shops SET shop_code = ? WHERE id = ?', [shopCode, shopId]);

    await insertSubscription(connection, shopId, input.subscription, actorId);
    await logActivity(connection, shopId, actorId, 'shop.created', { shop_code: shopCode });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return getGoldShopDetails(shopId);
}

async function insertSubscription(connection, shopId, input, actorId) {
  const [plans] = await connection.execute(
    `SELECT id, plan_name, monthly_price, quarterly_price, yearly_price
     FROM subscription_plans WHERE id = ? AND status = 'active' FOR UPDATE`,
    [input.plan_id]
  );
  const plan = plans[0];
  if (!plan) throw new GoldShopError(400, 'Select an active subscription plan');
  const amount = getPlanPrice(plan, input.duration);
  const endDate = calculateEndDate(input.start_date, input.duration);
  const [subscriptionResult] = await connection.execute(
    `INSERT INTO subscriptions
       (gold_shop_id, plan_id, duration, amount, start_date, end_date,
        payment_status, subscription_status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?)`,
    [shopId, plan.id, input.duration, amount, input.start_date, endDate, actorId, actorId]
  );
  await connection.execute(
    `INSERT INTO payments
       (gold_shop_id, subscription_id, amount, payment_status, created_by, updated_by)
     VALUES (?, ?, ?, 'pending', ?, ?)`,
    [shopId, subscriptionResult.insertId, amount, actorId, actorId]
  );
  await logActivity(connection, shopId, actorId, 'subscription.created', {
    plan_id: plan.id,
    duration: input.duration,
    amount,
    end_date: endDate
  });
}

async function updateGoldShop(id, input, actorId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `UPDATE gold_shops
       SET shop_name = ?, owner_name = ?, mobile = ?, email = ?, gst_number = ?,
           address = ?, city = ?, state = ?, pincode = ?, notes = ?,
           max_branches = ?, max_staff = ?, updated_by = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [input.shop_name, input.owner_name, input.mobile, input.email, input.gst_number,
        input.address, input.city, input.state, input.pincode, input.notes,
        input.max_branches, input.max_staff, actorId, id]
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return null;
    }
    await logActivity(connection, id, actorId, 'shop.updated', {});
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return getGoldShopDetails(id);
}

async function updateGoldShopStatus(id, status, actorId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [shops] = await connection.execute(
      'SELECT id FROM gold_shops WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
      [id]
    );
    if (!shops[0]) {
      await connection.rollback();
      return null;
    }
    const [subscriptions] = await connection.execute(
      `SELECT id, payment_status, subscription_status,
              end_date >= CURRENT_DATE() AS is_current
       FROM subscriptions WHERE gold_shop_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [id]
    );
    const subscription = subscriptions[0];
    if (status === 'active' && (!subscription
      || subscription.payment_status !== 'paid'
      || !subscription.is_current)) {
      throw new GoldShopError(409, 'A shop can be activated only after its subscription payment is confirmed');
    }
    await connection.execute('UPDATE gold_shops SET status = ?, updated_by = ? WHERE id = ?', [status, actorId, id]);
    if (subscription && status === 'suspended') {
      await connection.execute(
        "UPDATE subscriptions SET subscription_status = 'suspended', updated_by = ? WHERE id = ?",
        [actorId, subscription.id]
      );
    } else if (subscription && status === 'active') {
      await connection.execute(
        "UPDATE subscriptions SET subscription_status = 'active', updated_by = ? WHERE id = ?",
        [actorId, subscription.id]
      );
    }
    await logActivity(connection, id, actorId, 'shop.status_changed', { status });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return getGoldShopDetails(id);
}

async function softDeleteGoldShop(id, actorId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `UPDATE gold_shops
       SET deleted_at = CURRENT_TIMESTAMP, status = 'inactive', updated_by = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [actorId, id]
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return false;
    }
    await logActivity(connection, id, actorId, 'shop.deleted', {});
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function addSubscription(shopId, input, actorId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [shops] = await connection.execute(
      'SELECT id FROM gold_shops WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
      [shopId]
    );
    if (!shops[0]) {
      await connection.rollback();
      return null;
    }
    await insertSubscription(connection, shopId, input, actorId);
    await connection.execute(
      `UPDATE gold_shops SET status = 'pending', updated_by = ?
       WHERE id = ? AND status <> 'suspended'`,
      [actorId, shopId]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return getGoldShopDetails(shopId);
}

async function listShopPayments(shopId) {
  const [payments] = await pool.execute(
    `SELECT id, subscription_id, transaction_id, amount, payment_method,
            payment_status, payment_date, created_at
     FROM payments WHERE gold_shop_id = ? ORDER BY id DESC`,
    [shopId]
  );
  return payments;
}

module.exports = {
  DEFAULT_PLANS,
  GoldShopError,
  addSubscription,
  calculateEndDate,
  createGoldShop,
  getGoldShopDetails,
  getPlanPrice,
  getSubscriptionPlans,
  initializeSuperAdminGoldShopModule,
  isValidDate,
  listGoldShops,
  listShopPayments,
  softDeleteGoldShop,
  updateGoldShop,
  updateGoldShopStatus
};

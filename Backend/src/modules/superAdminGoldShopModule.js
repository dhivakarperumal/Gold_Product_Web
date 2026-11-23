const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const DEFAULT_PLANS = [
  { name: 'Basic', monthly: 500, features: ['Shop profile', 'Core inventory'] },
  { name: 'Standard', monthly: 700, features: ['Shop profile', 'Inventory', 'Reports'] },
  { name: 'Premium', monthly: 999, features: ['Shop profile', 'Inventory', 'Reports', 'Priority support'] },
  { name: 'Growth', monthly: 1299, features: ['Shop profile', 'Inventory', 'Reports', 'Priority support', 'Multi-branch support'] },
  { name: 'Gold', monthly: 1599, features: ['Shop profile', 'Inventory', 'Reports', 'Priority support', 'Multi-branch support', 'Staff management'] },
  { name: 'Platinum', monthly: 1999, features: ['Shop profile', 'Inventory', 'Reports', 'Priority support', 'Multi-branch support', 'Staff management', 'Advanced analytics'] },
  { name: 'Enterprise', monthly: 2999, features: ['Shop profile', 'Inventory', 'Reports', 'Priority support', 'Multi-branch support', 'Staff management', 'Advanced analytics', 'Dedicated support'] }
];

const DURATION_MONTHS = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12 };
const PRICE_COLUMNS = {
  monthly: 'monthly_price',
  quarterly: 'quarterly_price',
  half_yearly: 'half_yearly_price',
  yearly: 'yearly_price'
};
let expiryCheckPromise = null;
let subscriptionExpiryTimer = null;

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
  const [shopOwnerColumn] = await pool.execute(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gold_shops' AND COLUMN_NAME = 'owner_user_id'"
  );
  if (!shopOwnerColumn.length) {
    await pool.query('ALTER TABLE gold_shops ADD COLUMN owner_user_id INT UNSIGNED NULL AFTER shop_uuid');
  }
  const [shopApprovedColumn] = await pool.execute(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gold_shops' AND COLUMN_NAME = 'approved_at'"
  );
  if (!shopApprovedColumn.length) {
    await pool.query('ALTER TABLE gold_shops ADD COLUMN approved_at TIMESTAMP NULL DEFAULT NULL');
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      plan_name VARCHAR(80) NOT NULL,
      monthly_price DECIMAL(10, 2) NOT NULL,
      quarterly_price DECIMAL(10, 2) NOT NULL,
      half_yearly_price DECIMAL(10, 2) NULL,
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
    CREATE TABLE IF NOT EXISTS gold_shop_pending_credentials (
      gold_shop_id INT UNSIGNED NOT NULL,
      username VARCHAR(150) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (gold_shop_id),
      UNIQUE KEY uq_gold_shop_pending_credentials_username (username),
      CONSTRAINT fk_gold_shop_pending_credentials_shop
        FOREIGN KEY (gold_shop_id) REFERENCES gold_shops(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      gold_shop_id INT UNSIGNED NOT NULL,
      plan_id INT UNSIGNED NOT NULL,
      duration ENUM('monthly', 'quarterly', 'half_yearly', 'yearly') NOT NULL,
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gold_shop_documents (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      gold_shop_id INT UNSIGNED NOT NULL,
      document_type VARCHAR(40) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      storage_key VARCHAR(50) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      file_size INT UNSIGNED NOT NULL,
      uploaded_by INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_gold_shop_documents_shop (gold_shop_id, id),
      CONSTRAINT fk_gold_shop_documents_shop FOREIGN KEY (gold_shop_id) REFERENCES gold_shops(id) ON DELETE RESTRICT,
      CONSTRAINT fk_gold_shop_documents_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
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
  if (expiryCheckPromise) return expiryCheckPromise;
  expiryCheckPromise = (async () => {
    await pool.execute(
      `INSERT INTO gold_shop_activity_logs (gold_shop_id, actor_id, action, details)
       SELECT gold_shop_id, NULL, 'subscription.expired', JSON_OBJECT('subscription_id', id)
       FROM subscriptions
       WHERE subscription_status IN ('active', 'pending', 'suspended')
         AND end_date <= CURRENT_DATE()`
    );
    await pool.execute(
      `UPDATE subscriptions
       SET subscription_status = 'expired'
       WHERE subscription_status IN ('active', 'pending', 'suspended')
         AND end_date <= CURRENT_DATE()`
    );
    await pool.execute(
      `INSERT INTO gold_shop_activity_logs (gold_shop_id, actor_id, action, details)
       SELECT s.id, NULL, 'shop.deactivated_after_expiry', JSON_OBJECT()
       FROM gold_shops s
       WHERE s.deleted_at IS NULL AND s.status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM subscriptions sub
           WHERE sub.gold_shop_id = s.id AND sub.subscription_status = 'active'
             AND sub.payment_status = 'paid'
             AND sub.start_date <= CURRENT_DATE() AND sub.end_date > CURRENT_DATE()
         )`
    );
    await pool.execute(
      `UPDATE gold_shops s
       SET s.status = 'inactive'
       WHERE s.deleted_at IS NULL AND s.status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM subscriptions sub
           WHERE sub.gold_shop_id = s.id AND sub.subscription_status = 'active'
             AND sub.payment_status = 'paid'
             AND sub.start_date <= CURRENT_DATE() AND sub.end_date > CURRENT_DATE()
         )`
    );
    await pool.execute(
      `UPDATE users u
       SET u.status = 'inactive'
       WHERE u.status = 'active'
         AND EXISTS (
           SELECT 1
           FROM gold_shops gs
           WHERE gs.owner_user_id = u.id AND gs.deleted_at IS NULL
             AND gs.status = 'inactive' AND gs.approved_at IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM subscriptions sub
               WHERE sub.gold_shop_id = gs.id AND sub.subscription_status = 'active'
                 AND sub.payment_status = 'paid'
                 AND sub.start_date <= CURRENT_DATE() AND sub.end_date > CURRENT_DATE()
             )
         )
         AND NOT EXISTS (
           SELECT 1
           FROM gold_shops active_shop
           JOIN subscriptions active_sub ON active_sub.gold_shop_id = active_shop.id
           WHERE active_shop.owner_user_id = u.id AND active_shop.deleted_at IS NULL
             AND active_shop.status = 'active' AND active_sub.subscription_status = 'active'
             AND active_sub.payment_status = 'paid'
             AND active_sub.start_date <= CURRENT_DATE() AND active_sub.end_date > CURRENT_DATE()
         )`
    );
  })();
  try {
    await expiryCheckPromise;
  } finally {
    expiryCheckPromise = null;
  }
}

async function startSubscriptionExpiryJob() {
  await expireSubscriptions();
  if (subscriptionExpiryTimer) return;
  subscriptionExpiryTimer = setInterval(() => {
    expireSubscriptions().catch((error) => {
      console.error('Subscription expiry check failed:', error);
    });
  }, 60 * 60 * 1000);
  subscriptionExpiryTimer.unref();
}

async function startSubscriptionExpiryJob() {
  await expireSubscriptions();
  if (subscriptionExpiryTimer) return;
  subscriptionExpiryTimer = setInterval(() => {
    expireSubscriptions().catch((error) => {
      console.error('Subscription expiry check failed:', error);
    });
  }, 60 * 60 * 1000);
  subscriptionExpiryTimer.unref();
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
            gs.approved_at, gs.created_at, sub.id AS subscription_id, sub.duration, sub.amount,
            sub.start_date, sub.end_date AS subscription_expiry,
            sub.payment_status, sub.subscription_status, sub.plan_id, sp.plan_name,
            (sub.start_date <= CURRENT_DATE() AND sub.end_date > CURRENT_DATE()) AS subscription_is_current
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
    `SELECT id, plan_name, monthly_price, quarterly_price, half_yearly_price, yearly_price,
            max_branches, max_staff, features, status
     FROM subscription_plans WHERE status = 'active' ORDER BY id`
  );
  return plans.map((plan) => ({
    ...plan,
    monthly_price: Number(plan.monthly_price),
    quarterly_price: Number(plan.quarterly_price),
    half_yearly_price: Number(plan.half_yearly_price || plan.quarterly_price),
    yearly_price: Number(plan.yearly_price),
    features: typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || [])
  }));
}

async function getGoldShopDetails(id) {
  await expireSubscriptions();
  const [shops] = await pool.execute(
    `SELECT gs.*, owner.user_id AS owner_user_uuid,
            owner.username AS owner_username, owner.email AS owner_email,
            creator.username AS created_by_name, updater.username AS updated_by_name,
            sub.id AS current_subscription_id, sub.plan_id, sp.plan_name, sub.duration,
            sub.amount AS subscription_amount, sub.start_date, sub.end_date,
            sub.payment_status, sub.subscription_status,
            (sub.start_date <= CURRENT_DATE() AND sub.end_date > CURRENT_DATE()) AS subscription_is_current
     FROM gold_shops gs
     ${latestSubscriptionJoin()}
     LEFT JOIN users owner ON owner.id = gs.owner_user_id
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
  const [documents] = await pool.execute(
    `SELECT id, document_type, original_name, mime_type, file_size, created_at
     FROM gold_shop_documents WHERE gold_shop_id = ? ORDER BY id`,
    [id]
  );
  return { ...shops[0], subscriptions, payments, activity, documents };
}

async function insertGoldShopDocuments(connection, shopId, documents, actorId) {
  for (const document of documents) {
    await connection.execute(
      `INSERT INTO gold_shop_documents
         (gold_shop_id, document_type, original_name, storage_key, mime_type, file_size, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [shopId, document.document_type, document.original_name, document.storage_key,
        document.mime_type, document.file_size, actorId]
    );
  }
}

async function createGoldShop(input, actorId, documents = []) {
  const connection = await pool.getConnection();
  let shopId;
  let committed = false;
  try {
    await connection.beginTransaction();
    let pendingPasswordHash = null;
    if (input.credentials) {
      const [existingUsers] = await connection.execute(
        'SELECT id FROM users WHERE email = ? OR phone = ? OR username = ? LIMIT 1 FOR UPDATE',
        [input.email, input.mobile, input.credentials.username]
      );
      if (existingUsers.length) {
        throw new GoldShopError(409, 'The login email, mobile number, or username is already registered');
      }
      const [pendingCredentials] = await connection.execute(
        'SELECT gold_shop_id FROM gold_shop_pending_credentials WHERE username = ? LIMIT 1 FOR UPDATE',
        [input.credentials.username]
      );
      if (pendingCredentials.length) {
        throw new GoldShopError(409, 'This login username is already registered for another pending shop');
      }
      pendingPasswordHash = await bcrypt.hash(input.credentials.password, 12);
    }
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
    await connection.execute(
      'UPDATE gold_shops SET shop_code = ?, owner_user_id = ? WHERE id = ?',
      [shopCode, null, shopId]
    );
    if (pendingPasswordHash) {
      await connection.execute(
        `INSERT INTO gold_shop_pending_credentials (gold_shop_id, username, password_hash)
         VALUES (?, ?, ?)`,
        [shopId, input.credentials.username, pendingPasswordHash]
      );
    }

    await insertSubscription(connection, shopId, input.subscription, actorId);
    await insertGoldShopDocuments(connection, shopId, documents, actorId);
    await logActivity(connection, shopId, actorId, 'shop.created', {
      shop_code: shopCode,
      documents_uploaded: documents.length,
      document_consent: Boolean(input.document_consent)
    });
    await connection.commit();
    committed = true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  try {
    return await getGoldShopDetails(shopId);
  } catch (error) {
    if (committed) error.uploadCommitted = true;
    throw error;
  }
}

async function insertSubscription(connection, shopId, input, actorId) {
  const [plans] = await connection.execute(
    `SELECT id, plan_name, monthly_price, quarterly_price, half_yearly_price, yearly_price
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

async function updateGoldShop(id, input, actorId, documents = []) {
  const connection = await pool.getConnection();
  let committed = false;
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
    await insertGoldShopDocuments(connection, id, documents, actorId);
    await logActivity(connection, id, actorId, 'shop.updated', {
      documents_uploaded: documents.length,
      document_consent: Boolean(input.document_consent)
    });
    await connection.commit();
    committed = true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  try {
    return await getGoldShopDetails(id);
  } catch (error) {
    if (committed) error.uploadCommitted = true;
    throw error;
  }
}

async function getGoldShopDocument(shopId, documentId) {
  const [documents] = await pool.execute(
    `SELECT id, document_type, original_name, storage_key, mime_type, file_size
     FROM gold_shop_documents WHERE id = ? AND gold_shop_id = ?`,
    [documentId, shopId]
  );
  return documents[0] || null;
}

async function updateGoldShopStatus(id, status, actorId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [shops] = await connection.execute(
      'SELECT id, approved_at, owner_user_id FROM gold_shops WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
      [id]
    );
    const shop = shops[0];
    if (!shop) {
      await connection.rollback();
      return null;
    }
    const [subscriptions] = await connection.execute(
      `SELECT id, payment_status, subscription_status,
              start_date <= CURRENT_DATE() AND end_date > CURRENT_DATE() AS is_current
       FROM subscriptions WHERE gold_shop_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [id]
    );
    const subscription = subscriptions[0];
    if (status === 'active') {
      if (!shop.approved_at || !shop.owner_user_id) {
        throw new GoldShopError(409, 'Use Approve after payment confirmation to activate a new shop');
      }
      if (!subscription || subscription.payment_status !== 'paid' || !subscription.is_current) {
        throw new GoldShopError(409, 'A shop can be activated only with a paid subscription in its current term');
      }
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
      await connection.execute(
        "UPDATE users SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [shop.owner_user_id]
      );
    }
    if (shop.owner_user_id && ['inactive', 'suspended'].includes(status)) {
      await connection.execute(
        "UPDATE users SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [shop.owner_user_id]
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

async function approveGoldShop(id, actorId) {
  const connection = await pool.getConnection();
  let credentials = null;
  try {
    await connection.beginTransaction();
    const [shops] = await connection.execute(
      'SELECT * FROM gold_shops WHERE id=? AND deleted_at IS NULL FOR UPDATE',
      [id]
    );
    const shop = shops[0];
    if (!shop) return null;

    const [subscriptions] = await connection.execute(
      `SELECT id, payment_status, subscription_status,
              start_date <= CURRENT_DATE() AND end_date > CURRENT_DATE() AS is_current
       FROM subscriptions WHERE gold_shop_id=? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [id]
    );
    const subscription = subscriptions[0];
    if (!subscription || subscription.payment_status !== 'paid' || !subscription.is_current) {
      throw new GoldShopError(409, 'Approve this shop only after subscription payment is confirmed');
    }
    if (!shop.email) {
      throw new GoldShopError(400, 'A shop email address is required to create login access');
    }

    let ownerUserId = shop.owner_user_id;
    if (!ownerUserId) {
      const normalizedEmail = shop.email.trim().toLowerCase();
      const [pendingRows] = await connection.execute(
        'SELECT username, password_hash FROM gold_shop_pending_credentials WHERE gold_shop_id = ? FOR UPDATE',
        [id]
      );
      const pending = pendingRows[0];
      if (pending) {
        const [existingUsers] = await connection.execute(
          'SELECT id FROM users WHERE email = ? OR phone = ? OR username = ? LIMIT 1 FOR UPDATE',
          [normalizedEmail, shop.mobile, pending.username]
        );
        if (existingUsers.length) {
          throw new GoldShopError(409, 'The login email, mobile number, or username is already registered');
        }
        const [userResult] = await connection.execute(
          `INSERT INTO users
           (user_id, username, name, email, phone, password_hash, role, status)
           VALUES (?, ?, ?, ?, ?, ?, 'admin', 'active')`,
          [crypto.randomUUID(), pending.username, shop.owner_name, normalizedEmail, shop.mobile, pending.password_hash]
        );
        ownerUserId = userResult.insertId;
        credentials = { identifier: normalizedEmail };
      } else {
        const [existingUsers] = await connection.execute(
          'SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1 FOR UPDATE',
          [normalizedEmail, shop.mobile]
        );
        if (existingUsers.length) {
          throw new GoldShopError(409, 'The shop login conflicts with an existing user account');
        }
        const temporaryPassword = `${crypto.randomBytes(5).toString('hex').replace(/[^A-Za-z0-9]/g, 'A')}@123`;
        const passwordHash = await bcrypt.hash(temporaryPassword, 12);
        const [userResult] = await connection.execute(
          `INSERT INTO users
           (user_id, username, name, email, phone, password_hash, role, status)
           VALUES (?, ?, ?, ?, ?, ?, 'admin', 'active')`,
          [crypto.randomUUID(), shop.owner_name, shop.owner_name, normalizedEmail, shop.mobile, passwordHash]
        );
        ownerUserId = userResult.insertId;
        credentials = { identifier: normalizedEmail, temporaryPassword };
      }
    } else {
      const [existingOwner] = await connection.execute(
        'SELECT id FROM users WHERE id = ? FOR UPDATE',
        [ownerUserId]
      );
      if (!existingOwner.length) {
        throw new GoldShopError(409, 'The linked shop admin account no longer exists');
      }
      await connection.execute(
        "UPDATE users SET role='admin', status='active', updated_at=CURRENT_TIMESTAMP WHERE id=?",
        [ownerUserId]
      );
    }
    await connection.execute('DELETE FROM gold_shop_pending_credentials WHERE gold_shop_id = ?', [id]);

    await connection.execute(
      `UPDATE gold_shops
       SET status='active', owner_user_id=?, approved_at=CURRENT_TIMESTAMP, updated_by=?
       WHERE id=?`,
      [ownerUserId, actorId, id]
    );
    await connection.execute(
      "UPDATE subscriptions SET subscription_status='active', updated_by=? WHERE id=?",
      [actorId, subscription.id]
    );
    await logActivity(connection, id, actorId, 'shop.approved', {
      owner_user_id: ownerUserId,
      login_created: Boolean(credentials)
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return { shop: await getGoldShopDetails(id), credentials };
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
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return getGoldShopDetails(shopId);
}

async function confirmGoldShopPayment(shopId, paymentId, input, actorId) {
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

    const [subscriptions] = await connection.execute(
      `SELECT id, payment_status, end_date > CURRENT_DATE() AS is_unexpired
       FROM subscriptions WHERE gold_shop_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [shopId]
    );
    const subscription = subscriptions[0];
    if (!subscription) throw new GoldShopError(409, 'Record a subscription before confirming payment');
    if (!subscription.is_unexpired) {
      throw new GoldShopError(409, 'This subscription has expired; record a current subscription before confirming payment');
    }

    const [payments] = await connection.execute(
      `SELECT id, subscription_id, payment_status, amount FROM payments
       WHERE id = ? AND gold_shop_id = ? FOR UPDATE`,
      [paymentId, shopId]
    );
    const payment = payments[0];
    if (!payment || Number(payment.subscription_id) !== Number(subscription.id)) {
      throw new GoldShopError(409, 'Only the latest subscription payment can be confirmed');
    }
    if (payment.payment_status === 'paid' || subscription.payment_status === 'paid') {
      throw new GoldShopError(409, 'This subscription payment is already confirmed');
    }

    await connection.execute(
      `UPDATE payments
       SET transaction_id = ?, payment_method = ?, payment_status = 'paid',
           payment_date = CURRENT_TIMESTAMP, updated_by = ?
       WHERE id = ?`,
      [input.transactionId, input.paymentMethod, actorId, payment.id]
    );
    await connection.execute(
      "UPDATE subscriptions SET payment_status = 'paid', updated_by = ? WHERE id = ?",
      [actorId, subscription.id]
    );
    await logActivity(connection, shopId, actorId, 'subscription.payment_confirmed', {
      subscription_id: subscription.id,
      payment_id: payment.id,
      amount: payment.amount,
      transaction_id: input.transactionId,
      payment_method: input.paymentMethod
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw new GoldShopError(409, 'This transaction/reference ID has already been recorded');
    }
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
  approveGoldShop,
  addSubscription,
  confirmGoldShopPayment,
  calculateEndDate,
  createGoldShop,
  getGoldShopDocument,
  getGoldShopDetails,
  getPlanPrice,
  getSubscriptionPlans,
  initializeSuperAdminGoldShopModule,
  isValidDate,
  listGoldShops,
  listShopPayments,
  softDeleteGoldShop,
  startSubscriptionExpiryJob,
  updateGoldShop,
  updateGoldShopStatus
};

const crypto = require('node:crypto');
const { pool } = require('../config/db');
const { calculateEndDate, getPlanPrice, GoldShopError } = require('./superAdminGoldShopModule');
const { getSubscriptionAccountPlan } = require('../utils/subscriptionPlanType');
const {
  createRazorpayOrder,
  getRazorpayPayment,
  razorpayCredentials,
  verifyCheckoutSignature
} = require('../services/razorpayClient');

class ShopSubscriptionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function amountInPaise(amount) {
  const paise = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(paise) || paise <= 0) {
    throw new ShopSubscriptionError(409, 'The subscription price is invalid.');
  }
  return paise;
}

function addCalendarDay(dateValue) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new ShopSubscriptionError(409, 'The trial end date is invalid.');
  }
  date.setUTCDate(date.getUTCDate() + 1);
  if (date.getUTCFullYear() > 9999) {
    throw new ShopSubscriptionError(409, 'The trial period is too long.');
  }
  return date.toISOString().slice(0, 10);
}

function calculatePaidSubscriptionPeriod(today, activeTrialEndDate, duration) {
  const trialEndDate = activeTrialEndDate && activeTrialEndDate >= today
    ? activeTrialEndDate
    : null;
  const trialDays = trialEndDate
    ? Math.floor((Date.parse(`${trialEndDate}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / 86400000) + 1
    : 0;
  const startDate = trialEndDate ? addCalendarDay(trialEndDate) : today;
  return {
    startDate,
    endDate: calculateEndDate(startDate, duration),
    trialDays,
    trialStartDate: trialEndDate ? today : null,
    trialEndDate
  };
}

async function getAccountPlanForOwner(userId) {
  const [rows] = await pool.execute(
    `SELECT sub.id AS subscription_id, sp.plan_name, sub.duration, sub.amount,
            DATE_FORMAT(sub.start_date, '%Y-%m-%d') AS start_date,
            DATE_FORMAT(sub.end_date, '%Y-%m-%d') AS end_date,
            sub.trial_days,
            DATE_FORMAT(sub.trial_start_date, '%Y-%m-%d') AS trial_start_date,
            DATE_FORMAT(sub.trial_end_date, '%Y-%m-%d') AS trial_end_date,
            sub.payment_status, sub.subscription_status,
            DATE_FORMAT(CURRENT_DATE(), '%Y-%m-%d') AS database_date
     FROM gold_shops gs
     LEFT JOIN subscriptions sub
       ON sub.id = (SELECT MAX(s2.id) FROM subscriptions s2 WHERE s2.gold_shop_id = gs.id)
     LEFT JOIN subscription_plans sp ON sp.id = sub.plan_id
     WHERE gs.owner_user_id = ? AND gs.deleted_at IS NULL
     LIMIT 1`,
    [userId]
  );
  return getSubscriptionAccountPlan(rows[0]);
}

async function listAvailableSubscriptionPlans() {
  const [plans] = await pool.execute(
    `SELECT id, plan_name, monthly_price, quarterly_price, half_yearly_price,
            yearly_price, free_trial_days
     FROM subscription_plans WHERE status = 'active' ORDER BY display_order, plan_name`
  );
  return plans.map((plan) => ({
    ...plan,
    monthly_price: Number(plan.monthly_price),
    quarterly_price: Number(plan.quarterly_price),
    half_yearly_price: Number(plan.half_yearly_price || plan.quarterly_price),
    yearly_price: Number(plan.yearly_price),
    free_trial_days: Number(plan.free_trial_days || 0)
  }));
}

async function getShopForOwner(connection, user) {
  const [shops] = await connection.execute(
    `SELECT gs.id, gs.shop_name, gs.email, gs.mobile
     FROM gold_shops gs
     WHERE gs.owner_user_id = ? AND gs.deleted_at IS NULL
     FOR UPDATE`,
    [user.user_id]
  );
  if (!shops[0]) throw new ShopSubscriptionError(404, 'No active gold shop is linked to this account.');
  return shops[0];
}

async function createSubscriptionOrder(user, planId, duration) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const shop = await getShopForOwner(connection, user);
    const [plans] = await connection.execute(
      `SELECT id, plan_name, monthly_price, quarterly_price, half_yearly_price,
              yearly_price
       FROM subscription_plans WHERE id = ? AND status = 'active' FOR UPDATE`,
      [planId]
    );
    const plan = plans[0];
    if (!plan) throw new ShopSubscriptionError(400, 'Select an active subscription plan.');

    const amount = getPlanPrice(plan, duration);
    const paise = amountInPaise(amount);
    const { keyId } = razorpayCredentials();
    const order = await createRazorpayOrder({
      amount: paise,
      currency: 'INR',
      receipt: `sub_${shop.id}_${crypto.randomUUID().slice(0, 8)}`,
      notes: {
        gold_shop_id: String(shop.id),
        plan_id: String(plan.id),
        duration
      }
    });

    await connection.execute(
      `INSERT INTO gold_shop_subscription_orders
         (gold_shop_id, plan_id, duration, amount, razorpay_order_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [shop.id, plan.id, duration, amount, order.id, user.id]
    );
    await connection.execute(
      `INSERT INTO gold_shop_activity_logs (gold_shop_id, actor_id, action, details)
       VALUES (?, ?, 'subscription.checkout_created', ?)`,
      [shop.id, user.id, JSON.stringify({ plan_id: plan.id, duration, amount })]
    );
    await connection.commit();
    return {
      orderId: order.id,
      keyId,
      amount: paise,
      currency: 'INR',
      planName: plan.plan_name,
      shopName: shop.shop_name,
      prefill: { name: user.name, email: shop.email || user.email, contact: shop.mobile }
    };
  } catch (error) {
    if (connection) await connection.rollback();
    if (error instanceof ShopSubscriptionError || error instanceof GoldShopError) throw error;
    throw error;
  } finally {
    connection?.release();
  }
}

async function completeSubscriptionOrder(orderId, payment, ownerUserId = null) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.execute(
      `SELECT o.*, gs.owner_user_id
       FROM gold_shop_subscription_orders o
       JOIN gold_shops gs ON gs.id = o.gold_shop_id AND gs.deleted_at IS NULL
       WHERE o.razorpay_order_id = ? FOR UPDATE`,
      [orderId]
    );
    const order = orders[0];
    if (!order || (ownerUserId && String(order.owner_user_id) !== String(ownerUserId))) {
      throw new ShopSubscriptionError(404, 'Subscription payment order was not found.');
    }
    if (order.order_status === 'paid') {
      if (order.razorpay_payment_id !== payment.id) {
        throw new ShopSubscriptionError(409, 'This order has already been paid with a different payment.');
      }
      await connection.commit();
      return { alreadyPaid: true };
    }

    const expectedAmount = amountInPaise(order.amount);
    if (payment.order_id !== order.razorpay_order_id
      || Number(payment.amount) !== expectedAmount
      || payment.currency !== 'INR'
      || payment.status !== 'captured') {
      throw new ShopSubscriptionError(409, 'Razorpay has not confirmed the full subscription payment.');
    }

    const [dateRows] = await connection.execute(
      "SELECT DATE_FORMAT(CURRENT_DATE(), '%Y-%m-%d') AS today"
    );
    const [activeTrials] = await connection.execute(
      `SELECT DATE_FORMAT(trial_end_date, '%Y-%m-%d') AS trial_end_date
       FROM subscriptions
       WHERE gold_shop_id = ? AND subscription_status = 'active'
         AND trial_days > 0
         AND trial_start_date <= CURRENT_DATE() AND trial_end_date >= CURRENT_DATE()
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [order.gold_shop_id]
    );
    const period = calculatePaidSubscriptionPeriod(
      dateRows[0]?.today,
      activeTrials[0]?.trial_end_date,
      order.duration
    );
    const [subscriptionResult] = await connection.execute(
      `INSERT INTO subscriptions
         (gold_shop_id, plan_id, duration, amount, start_date, end_date,
          trial_days, trial_start_date, trial_end_date, payment_status,
          subscription_status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'active', ?, ?)`,
      [order.gold_shop_id, order.plan_id, order.duration, order.amount,
        period.startDate, period.endDate, period.trialDays,
        period.trialStartDate, period.trialEndDate, order.created_by, order.created_by]
    );
    await connection.execute(
      `INSERT INTO payments
         (gold_shop_id, subscription_id, razorpay_order_id, transaction_id,
          amount, payment_method, payment_status, payment_date, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, 'Razorpay', 'paid', CURRENT_TIMESTAMP, ?, ?)`,
      [order.gold_shop_id, subscriptionResult.insertId, order.razorpay_order_id,
        payment.id, order.amount, order.created_by, order.created_by]
    );
    await connection.execute(
      `UPDATE gold_shop_subscription_orders
       SET order_status = 'paid', razorpay_payment_id = ?, paid_at = CURRENT_TIMESTAMP
       WHERE id = ? AND order_status = 'created'`,
      [payment.id, order.id]
    );
    await connection.execute(
      `UPDATE gold_shops SET status = 'active', updated_by = ?
       WHERE id = ? AND status IN ('inactive', 'pending') AND approved_at IS NOT NULL`,
      [order.owner_user_id, order.gold_shop_id]
    );
    await connection.execute(
      `UPDATE users SET status = 'active', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND status = 'inactive'`,
      [order.owner_user_id]
    );
    await connection.execute(
      `INSERT INTO gold_shop_activity_logs (gold_shop_id, actor_id, action, details)
       VALUES (?, ?, 'subscription.payment_completed', ?)`,
      [order.gold_shop_id, order.created_by, JSON.stringify({
        plan_id: order.plan_id,
        duration: order.duration,
        amount: Number(order.amount),
        start_date: period.startDate,
        end_date: period.endDate,
        subscription_id: subscriptionResult.insertId
      })]
    );
    await connection.commit();
    return {
      alreadyPaid: false,
      subscriptionId: subscriptionResult.insertId,
      startDate: period.startDate,
      endDate: period.endDate
    };
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ShopSubscriptionError(409, 'This Razorpay payment has already been recorded.');
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function verifySubscriptionCheckout(user, input) {
  const orderId = String(input?.razorpay_order_id || '');
  const paymentId = String(input?.razorpay_payment_id || '');
  const signature = String(input?.razorpay_signature || '');
  if (!/^order_[A-Za-z0-9]+$/.test(orderId) || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
    throw new ShopSubscriptionError(400, 'Razorpay order or payment ID is invalid.');
  }
  if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
    throw new ShopSubscriptionError(400, 'Razorpay payment signature is invalid.');
  }
  const [orders] = await pool.execute(
    `SELECT o.razorpay_order_id, o.amount, o.order_status
     FROM gold_shop_subscription_orders o
     JOIN gold_shops gs ON gs.id = o.gold_shop_id
     WHERE o.razorpay_order_id = ? AND gs.owner_user_id = ?
       AND gs.deleted_at IS NULL`,
    [orderId, user.user_id]
  );
  if (!orders[0]) throw new ShopSubscriptionError(404, 'Subscription payment order was not found.');
  if (orders[0].order_status === 'paid') {
    const [paidOrders] = await pool.execute(
      'SELECT razorpay_payment_id FROM gold_shop_subscription_orders WHERE razorpay_order_id = ?',
      [orderId]
    );
    if (paidOrders[0]?.razorpay_payment_id === paymentId) return { alreadyPaid: true };
    throw new ShopSubscriptionError(409, 'This order has already been paid with a different payment.');
  }

  const payment = await getRazorpayPayment(paymentId);
  if (payment.order_id !== orderId || Number(payment.amount) !== amountInPaise(orders[0].amount)
    || payment.currency !== 'INR' || payment.status !== 'captured') {
    throw new ShopSubscriptionError(409, 'Razorpay has not confirmed the full subscription payment.');
  }
  return completeSubscriptionOrder(orderId, payment, user.user_id);
}

async function requestSubscriptionAssistance(user) {
  const [shops] = await pool.execute(
    `SELECT id FROM gold_shops
     WHERE owner_user_id = ? AND deleted_at IS NULL LIMIT 1`,
    [user.user_id]
  );
  if (!shops[0]) throw new ShopSubscriptionError(404, 'No active gold shop is linked to this account.');
  await pool.execute(
    `INSERT INTO gold_shop_activity_logs (gold_shop_id, actor_id, action, details)
     VALUES (?, ?, 'subscription.assistance_requested', ?)`,
    [shops[0].id, user.id, JSON.stringify({ request_type: 'subscription_assistance' })]
  );
  return { requested: true };
}

module.exports = {
  ShopSubscriptionError,
  calculatePaidSubscriptionPeriod,
  completeSubscriptionOrder,
  createSubscriptionOrder,
  getAccountPlanForOwner,
  listAvailableSubscriptionPlans,
  requestSubscriptionAssistance,
  verifySubscriptionCheckout
};

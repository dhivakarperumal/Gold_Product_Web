const {
  createFundTransaction,
  getFundSummary,
  listFundTransactions
} = require('../modules/fundsModule');
const { parseDateRange } = require('../utils/dateRange');

const TRANSACTION_TYPES = new Set(['FUND_ADDED', 'DEBIT', 'CREDIT']);
const PAYMENT_METHODS = new Set(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Other']);

function text(value, maxLength, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const result = String(value).trim();
  return result && result.length <= maxLength ? result : (required ? null : '');
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/.test(value)) return null;
  const normalized = value.length === 10 ? `${value}T12:00:00` : value;
  return Number.isNaN(Date.parse(normalized)) ? null : normalized.replace('T', ' ');
}

function validAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 999999999999.99
    ? Math.round((amount + Number.EPSILON) * 100) / 100
    : null;
}

async function getSummary(req, res, next) {
  const dateRange = parseDateRange(req.query);
  if (dateRange.error) return res.status(400).json({ message: dateRange.error });
  try {
    return res.json(await getFundSummary(dateRange, req.adminUser.user_id));
  } catch (error) {
    return next(error);
  }
}

async function getTransactions(req, res, next) {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.page_size || 20);
  const dateRange = parseDateRange(req.query);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1
    || pageSize > 5000 || dateRange.error) {
    return res.status(400).json({ message: 'Fund transaction filters are invalid' });
  }
  const transactionType = req.query.transaction_type || 'ALL';
  const search = text(req.query.search, 150);
  if (!['ALL', ...TRANSACTION_TYPES, 'TRANSFER_IN', 'TRANSFER_OUT'].includes(transactionType)
    || search === null) {
    return res.status(400).json({ message: 'Fund transaction filters are invalid' });
  }
  try {
    return res.json(await listFundTransactions({
      page,
      page_size: pageSize,
      transaction_type: transactionType,
      search,
      dateRange,
      owner_user_id: req.adminUser.user_id
    }));
  } catch (error) {
    return next(error);
  }
}

async function postTransaction(req, res, next) {
  const body = req.body || {};
  const transactionType = body.transaction_type;
  const transactionDate = validDate(body.transaction_date);
  const amount = validAmount(body.amount);
  const paymentMethod = body.payment_method;
  const description = text(body.description, 2000, true);
  const relatedReference = text(body.related_reference, 100);
  const idempotencyKey = text(body.idempotency_key, 150, true);
  if (!TRANSACTION_TYPES.has(transactionType) || !transactionDate || !amount
    || !PAYMENT_METHODS.has(paymentMethod) || !description || relatedReference === null
    || !idempotencyKey) {
    return res.status(400).json({ message: 'Enter a valid type, date, amount, payment method, and description' });
  }
  try {
    const adminName = text(req.adminUser.name || req.adminUser.username, 255, true);
    if (!adminName) return res.status(400).json({ message: 'The current admin profile has no valid name' });
    const record = await createFundTransaction({
      transaction_type: transactionType,
      transaction_date: transactionDate,
      amount: amount.toFixed(2),
      payment_method: paymentMethod,
      description,
      related_reference: relatedReference,
      idempotency_key: idempotencyKey,
      created_by: req.adminUser.user_id,
      updated_by: req.adminUser.user_id,
      admin_name: adminName
    });
    return res.status(201).json(record);
  } catch (error) {
    if (error.code === 'FUND_ADMIN_NOT_FOUND') {
      return res.status(403).json({ message: 'A valid admin account is required to manage fund records' });
    }
    if (error.code === 'INSUFFICIENT_FUNDS') {
      return res.status(409).json({
        message: error.message,
        available_balance: error.available_balance
      });
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'This fund entry has already been recorded' });
    }
    return next(error);
  }
}

module.exports = { getSummary, getTransactions, postTransaction };

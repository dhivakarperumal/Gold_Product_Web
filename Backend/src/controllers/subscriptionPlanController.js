const {
  SubscriptionPlanError,
  listSubscriptionPlans,
  getSubscriptionPlan,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  setSubscriptionPlanStatus,
  duplicateSubscriptionPlan,
  deleteSubscriptionPlan
} = require('../modules/subscriptionPlanModule');

function positiveId(value) {
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function handleError(error, res, next) {
  if (error instanceof SubscriptionPlanError) {
    return res.status(error.status).json({ message: error.message });
  }
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'Plan name or plan code already exists' });
  }
  return next(error);
}

async function getPlans(req, res, next) {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 10);
    const status = String(req.query.status || 'all').trim().toLowerCase();
    const search = String(req.query.search || '').trim();
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize)
      || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ message: 'Pagination values are invalid' });
    }
    if (!['all', 'active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Plan status filter is invalid' });
    }
    if (search.length > 100) return res.status(400).json({ message: 'Search is too long' });
    return res.json(await listSubscriptionPlans({ search, status, page, pageSize }));
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function getPlan(req, res, next) {
  if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Plan ID is invalid' });
  try {
    const plan = await getSubscriptionPlan(Number(req.params.id));
    if (!plan) return res.status(404).json({ message: 'Subscription plan not found' });
    return res.json({ plan });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function postPlan(req, res, next) {
  try {
    const plan = await createSubscriptionPlan(req.body || {}, req.adminUser.id);
    return res.status(201).json({ message: 'Subscription plan created', plan });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function putPlan(req, res, next) {
  if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Plan ID is invalid' });
  try {
    const plan = await updateSubscriptionPlan(Number(req.params.id), req.body || {}, req.adminUser.id);
    if (!plan) return res.status(404).json({ message: 'Subscription plan not found' });
    return res.json({ message: 'Subscription plan updated', plan });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function patchPlanStatus(req, res, next) {
  if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Plan ID is invalid' });
  try {
    const status = String(req.body?.status || '').trim().toLowerCase();
    const plan = await setSubscriptionPlanStatus(Number(req.params.id), status, req.adminUser.id);
    if (!plan) return res.status(404).json({ message: 'Subscription plan not found' });
    return res.json({ message: `Subscription plan ${status}`, plan });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function duplicatePlan(req, res, next) {
  if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Plan ID is invalid' });
  try {
    const plan = await duplicateSubscriptionPlan(Number(req.params.id), req.adminUser.id);
    if (!plan) return res.status(404).json({ message: 'Subscription plan not found' });
    return res.status(201).json({ message: 'Subscription plan duplicated', plan });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function deletePlan(req, res, next) {
  if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Plan ID is invalid' });
  try {
    const deleted = await deleteSubscriptionPlan(Number(req.params.id), req.adminUser.id);
    if (!deleted) return res.status(404).json({ message: 'Subscription plan not found' });
    return res.json({ message: 'Subscription plan deleted' });
  } catch (error) {
    return handleError(error, res, next);
  }
}

module.exports = {
  deletePlan,
  duplicatePlan,
  getPlan,
  getPlans,
  patchPlanStatus,
  postPlan,
  putPlan
};

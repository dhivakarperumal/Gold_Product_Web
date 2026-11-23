const {
  GoldShopError,
  addSubscription,
  createGoldShop,
  getGoldShopDetails,
  isValidDate,
  getSubscriptionPlans,
  listGoldShops,
  listShopPayments,
  softDeleteGoldShop,
  updateGoldShop,
  updateGoldShopStatus
} = require('../modules/superAdminGoldShopModule');

const SHOP_STATUSES = new Set(['active', 'inactive', 'pending', 'suspended']);
const DURATIONS = new Set(['monthly', 'quarterly', 'half_yearly', 'yearly']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[1-9]\d{9,14}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function positiveId(value) {
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function normalizeOptionalString(value) {
  return value == null || value === '' ? null : String(value).trim() || null;
}

function validateSubscription(body) {
  const planId = Number(body.planId);
  const duration = String(body.duration || '').trim().toLowerCase();
  const startDate = String(body.startDate || '').trim();
  if (!positiveId(planId)) return { error: 'Select a valid subscription plan' };
  if (!DURATIONS.has(duration)) return { error: 'Subscription duration must be monthly, quarterly, half-yearly, or yearly' };
  if (!DATE_PATTERN.test(startDate) || !isValidDate(startDate)) {
    return { error: 'Enter a valid subscription start date' };
  }
  return { subscription: { plan_id: planId, duration, start_date: startDate } };
}

function validateShop(body, { creating = false } = {}) {
  const shopName = String(body.shopName || '').trim();
  const ownerName = String(body.ownerName || '').trim();
  const mobile = String(body.mobile || '').replace(/[\s()-]/g, '').trim();
  const email = normalizeOptionalString(body.email)?.toLowerCase() || null;
  const gstNumber = normalizeOptionalString(body.gstNumber)?.toUpperCase() || null;
  const address = normalizeOptionalString(body.address);
  const city = normalizeOptionalString(body.city);
  const state = normalizeOptionalString(body.state);
  const pincode = normalizeOptionalString(body.pincode);
  const notes = normalizeOptionalString(body.notes);
  const maxBranches = Number(body.maxBranches);
  const maxStaff = Number(body.maxStaff);
  const status = String(body.status || 'pending').trim().toLowerCase();

  if (!shopName || !ownerName || !mobile) {
    return { error: 'Shop name, owner name, and mobile number are required' };
  }
  if (shopName.length > 150 || ownerName.length > 150 || mobile.length > 20) {
    return { error: 'Shop name, owner name, or mobile number exceeds the allowed length' };
  }
  if ((address && address.length > 5000) || (city && city.length > 100)
    || (state && state.length > 100) || (pincode && pincode.length > 20)
    || (notes && notes.length > 10000)) {
    return { error: 'Shop address, location, pincode, or notes exceeds the allowed length' };
  }
  if (!PHONE_PATTERN.test(mobile)) return { error: 'Enter a valid mobile number' };
  if (email && (email.length > 255 || !EMAIL_PATTERN.test(email))) return { error: 'Enter a valid email address' };
  if (gstNumber && (gstNumber.length !== 15 || !/^[A-Z0-9]{15}$/.test(gstNumber))) {
    return { error: 'GST number must contain 15 letters or numbers' };
  }
  if (pincode && (pincode.length > 20 || !/^[A-Za-z0-9 -]+$/.test(pincode))) {
    return { error: 'Enter a valid pincode' };
  }
  if (!Number.isSafeInteger(maxBranches) || maxBranches < 1 || maxBranches > 100000) {
    return { error: 'Maximum branches must be between 1 and 100000' };
  }
  if (!Number.isSafeInteger(maxStaff) || maxStaff < 1 || maxStaff > 100000) {
    return { error: 'Maximum staff accounts must be between 1 and 100000' };
  }
  if (!SHOP_STATUSES.has(status)) return { error: 'Shop status is invalid' };
  if (creating && status === 'active') {
    return { error: 'A new shop cannot be active until its subscription payment is confirmed' };
  }

  return {
    shop: {
      shop_name: shopName,
      owner_name: ownerName,
      mobile,
      email,
      gst_number: gstNumber,
      address,
      city,
      state,
      pincode,
      notes,
      max_branches: maxBranches,
      max_staff: maxStaff,
      status: creating ? status : undefined
    }
  };
}

function handleError(error, res, next) {
  if (error instanceof GoldShopError) {
    return res.status(error.status).json({ message: error.message });
  }
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'A shop with this name, mobile, email, or GST number already exists' });
  }
  return next(error);
}

async function getGoldShops(req, res, next) {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);
  const status = String(req.query.status || 'all').trim().toLowerCase();
  const planId = req.query.planId ? Number(req.query.planId) : null;
  const search = String(req.query.search || '').trim();

  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize)
    || pageSize < 1 || pageSize > 100 || !Number.isSafeInteger((page - 1) * pageSize)) {
    return res.status(400).json({ message: 'Pagination values are invalid' });
  }
  if (search.length > 100) return res.status(400).json({ message: 'Search must be 100 characters or fewer' });
  if (status !== 'all' && !SHOP_STATUSES.has(status)) return res.status(400).json({ message: 'Shop status filter is invalid' });
  if (planId != null && !positiveId(planId)) return res.status(400).json({ message: 'Subscription plan filter is invalid' });

  try {
    return res.json(await listGoldShops({ search, status, planId, page, pageSize }));
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function getPlans(req, res, next) {
  try {
    return res.json({ plans: await getSubscriptionPlans() });
  } catch (error) {
    return next(error);
  }
}

async function getGoldShop(req, res, next) {
  if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Gold shop ID is invalid' });
  try {
    const shop = await getGoldShopDetails(Number(req.params.id));
    if (!shop) return res.status(404).json({ message: 'Gold shop not found' });
    return res.json({ shop });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function postGoldShop(req, res, next) {
  const { shop, error } = validateShop(req.body || {}, { creating: true });
  if (error) return res.status(400).json({ message: error });
  const { subscription, error: subscriptionError } = validateSubscription(req.body?.subscription || {});
  if (subscriptionError) return res.status(400).json({ message: subscriptionError });

  try {
    const created = await createGoldShop({ ...shop, subscription }, req.adminUser.id);
    return res.status(201).json({ message: 'Gold shop created; payment is pending gateway confirmation', shop: created });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function putGoldShop(req, res, next) {
  if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Gold shop ID is invalid' });
  const { shop, error } = validateShop(req.body || {});
  if (error) return res.status(400).json({ message: error });
  try {
    const updated = await updateGoldShop(Number(req.params.id), shop, req.adminUser.id);
    if (!updated) return res.status(404).json({ message: 'Gold shop not found' });
    return res.json({ message: 'Gold shop updated', shop: updated });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function patchGoldShopStatus(req, res, next) {
  if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Gold shop ID is invalid' });
  const status = String(req.body?.status || '').trim().toLowerCase();
  if (!SHOP_STATUSES.has(status)) return res.status(400).json({ message: 'Shop status is invalid' });
  try {
    const shop = await updateGoldShopStatus(Number(req.params.id), status, req.adminUser.id);
    if (!shop) return res.status(404).json({ message: 'Gold shop not found' });
    return res.json({ message: 'Gold shop status updated', shop });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function deleteGoldShop(req, res, next) {
  if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Gold shop ID is invalid' });
  try {
    const deleted = await softDeleteGoldShop(Number(req.params.id), req.adminUser.id);
    if (!deleted) return res.status(404).json({ message: 'Gold shop not found' });
    return res.json({ message: 'Gold shop archived' });
  } catch (error) {
    return next(error);
  }
}

async function postSubscription(req, res, next) {
  if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Gold shop ID is invalid' });
  const { subscription, error } = validateSubscription(req.body || {});
  if (error) return res.status(400).json({ message: error });
  try {
    const shop = await addSubscription(Number(req.params.id), subscription, req.adminUser.id);
    if (!shop) return res.status(404).json({ message: 'Gold shop not found' });
    return res.status(201).json({ message: 'Subscription recorded; payment is pending gateway confirmation', shop });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function getGoldShopPayments(req, res, next) {
  if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Gold shop ID is invalid' });
  try {
    const shop = await getGoldShopDetails(Number(req.params.id));
    if (!shop) return res.status(404).json({ message: 'Gold shop not found' });
    return res.json({ payments: await listShopPayments(Number(req.params.id)) });
  } catch (error) {
    return handleError(error, res, next);
  }
}

module.exports = {
  deleteGoldShop,
  getGoldShop,
  getGoldShopPayments,
  getGoldShops,
  getPlans,
  patchGoldShopStatus,
  postGoldShop,
  postSubscription,
  putGoldShop,
  validateShop,
  validateSubscription
};

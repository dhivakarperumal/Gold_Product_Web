const path = require('node:path');
const {
  GoldShopError,
  approveGoldShop,
  rejectGoldShop,
  addSubscription,
  confirmGoldShopPayment,
  createGoldShop,
  getGoldShopDocument,
  getGoldShopDetails,
  isValidDate,
  getSubscriptionPlans,
  listGoldShops,
  listShopPayments,
  softDeleteGoldShop,
  updateGoldShop,
  updateGoldShopStatus
} = require('../modules/superAdminGoldShopModule');
const {
  removeGoldShopDocumentFiles,
  resolveGoldShopDocumentPath,
  uploadedGoldShopDocumentNames,
  validateGoldShopDocumentSignature
} = require('../middleware/goldShopDocumentUpload');

const SHOP_STATUSES = new Set(['active', 'inactive', 'pending', 'suspended']);
const DURATIONS = new Set(['monthly', 'quarterly', 'half_yearly', 'yearly']);
const PAYMENT_METHODS = new Map([
  ['upi', 'UPI'],
  ['bank_transfer', 'Bank transfer'],
  ['cash', 'Cash'],
  ['card', 'Card'],
  ['other', 'Other']
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[1-9]\d{9,14}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SHOP_DOCUMENT_TYPES = {
  profilePhoto: 'profile_photo',
  aadhaarCard: 'aadhaar_card',
  gstCertificate: 'gst_certificate',
  otherDocuments: 'supporting_document'
};

function positiveId(value) {
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function normalizeOptionalString(value) {
  return value == null || value === '' ? null : String(value).trim() || null;
}

function getRequestPayload(req) {
  if (typeof req.body?.payload !== 'string') return req.body || {};
  try {
    const payload = JSON.parse(req.body.payload);
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
}

function validateLoginCredentials(credentials, email) {
  if (credentials == null) return { credentials: null };
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
    return { error: 'Login credentials are invalid' };
  }
  const username = String(credentials.username || '').trim();
  const password = credentials.password;
  if (!username || username.length > 150 || !/^[A-Za-z0-9._@+-]{3,150}$/.test(username)) {
    return { error: 'Username must be 3 to 150 letters, numbers, or . _ @ + - characters' };
  }
  if (!email) return { error: 'An email address is required for the Shop Admin login' };
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return { error: 'Password must be at least 8 characters and no more than 72 bytes' };
  }
  return { credentials: { username, password } };
}

function prepareUploadedDocuments(files) {
  const documents = [];
  for (const [fieldName, documentFiles] of Object.entries(files || {})) {
    const documentType = SHOP_DOCUMENT_TYPES[fieldName];
    if (!documentType) throw new GoldShopError(400, 'Uploaded document type is invalid');
    for (const file of documentFiles) {
      if (!validateGoldShopDocumentSignature(file.path, file.mimetype)) {
        throw new GoldShopError(400, `The ${path.extname(file.originalname).toUpperCase()} file content does not match its declared type`);
      }
      documents.push({
        document_type: documentType,
        original_name: path.basename(file.originalname).replace(/[\u0000-\u001f]/g, '_').slice(0, 255) || 'document',
        storage_key: path.basename(file.filename),
        mime_type: file.mimetype,
        file_size: file.size
      });
    }
  }
  return documents;
}

function validateDocumentConsent(body, documents) {
  const needsConsent = documents.some((document) => document.document_type !== 'profile_photo');
  if (needsConsent && body.documentConsent !== true) {
    return { error: 'Confirm authorization to upload the shop owner documents' };
  }
  return {};
}

async function cleanupUploadedDocuments(req, error) {
  if (error?.uploadCommitted) return;
  await removeGoldShopDocumentFiles(uploadedGoldShopDocumentNames(req.files)).catch((cleanupError) => {
    console.error('Failed to clean rejected gold shop documents:', cleanupError);
  });
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

function validatePaymentConfirmation(body) {
  const transactionId = String(body?.transactionId || '').trim();
  const paymentMethod = PAYMENT_METHODS.get(String(body?.paymentMethod || '').trim().toLowerCase());
  if (!transactionId || transactionId.length > 120 || /[\u0000-\u001f\u007f]/.test(transactionId)) {
    return { error: 'Enter a valid transaction/reference ID (up to 120 characters)' };
  }
  if (!paymentMethod) return { error: 'Select a valid payment method' };
  return { confirmation: { transactionId, paymentMethod } };
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
      status: creating ? 'pending' : undefined
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
  const body = getRequestPayload(req);
  if (!body) {
    await cleanupUploadedDocuments(req);
    return res.status(400).json({ message: 'Shop form data is invalid' });
  }
  const { shop, error } = validateShop(body, { creating: true });
  if (error) {
    await cleanupUploadedDocuments(req);
    return res.status(400).json({ message: error });
  }
  const { credentials, error: credentialsError } = validateLoginCredentials(body.credentials, shop.email);
  if (!credentials || credentialsError) {
    await cleanupUploadedDocuments(req);
    return res.status(400).json({ message: credentialsError || 'Shop login credentials are required' });
  }
  const { subscription, error: subscriptionError } = validateSubscription(body.subscription || {});
  if (subscriptionError) {
    await cleanupUploadedDocuments(req);
    return res.status(400).json({ message: subscriptionError });
  }

  try {
    const documents = prepareUploadedDocuments(req.files);
    const { error: consentError } = validateDocumentConsent(body, documents);
    if (consentError) {
      await cleanupUploadedDocuments(req);
      return res.status(400).json({ message: consentError });
    }
    const created = await createGoldShop({
      ...shop,
      credentials,
      subscription,
      document_consent: body.documentConsent === true
    }, req.adminUser.id, documents, req.adminUser.user_id);
    return res.status(201).json({ message: 'Gold shop created; payment is pending Super Admin confirmation', shop: created });
  } catch (error) {
    await cleanupUploadedDocuments(req, error);
    return handleError(error, res, next);
  }
}

async function putGoldShop(req, res, next) {
  if (!positiveId(req.params.id)) {
    await cleanupUploadedDocuments(req);
    return res.status(400).json({ message: 'Gold shop ID is invalid' });
  }
  const body = getRequestPayload(req);
  if (!body) {
    await cleanupUploadedDocuments(req);
    return res.status(400).json({ message: 'Shop form data is invalid' });
  }
  const { shop, error } = validateShop(body);
  if (error) {
    await cleanupUploadedDocuments(req);
    return res.status(400).json({ message: error });
  }
  try {
    const documents = prepareUploadedDocuments(req.files);
    const { error: consentError } = validateDocumentConsent(body, documents);
    if (consentError) {
      await cleanupUploadedDocuments(req);
      return res.status(400).json({ message: consentError });
    }
    const updated = await updateGoldShop(Number(req.params.id), {
      ...shop,
      document_consent: body.documentConsent === true
    }, req.adminUser.id, documents, req.adminUser.user_id);
    if (!updated) {
      await cleanupUploadedDocuments(req);
      return res.status(404).json({ message: 'Gold shop not found' });
    }
    return res.json({ message: 'Gold shop updated', shop: updated });
  } catch (error) {
    await cleanupUploadedDocuments(req, error);
    return handleError(error, res, next);
  }
}

async function downloadGoldShopDocument(req, res, next) {
  if (!positiveId(req.params.id) || !positiveId(req.params.documentId)) {
    return res.status(400).json({ message: 'Gold shop or document ID is invalid' });
  }
  try {
    const document = await getGoldShopDocument(Number(req.params.id), Number(req.params.documentId));
    if (!document) return res.status(404).json({ message: 'Gold shop document not found' });
    const filePath = resolveGoldShopDocumentPath(document.storage_key);
    if (!filePath) return res.status(404).json({ message: 'Gold shop document is unavailable' });
    res.set('Cache-Control', 'private, no-store');
    res.type(document.mime_type);
    return res.download(filePath, document.original_name, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    return next(error);
  }
}

async function patchGoldShopStatus(req, res, next) {
  if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Gold shop ID is invalid' });
  const status = String(req.body?.status || '').trim().toLowerCase();
  if (!SHOP_STATUSES.has(status)) return res.status(400).json({ message: 'Shop status is invalid' });
  try {
    const shop = await updateGoldShopStatus(
      Number(req.params.id),
      status,
      req.adminUser.id,
      req.adminUser.user_id
    );
    if (!shop) return res.status(404).json({ message: 'Gold shop not found' });
    return res.json({ message: 'Gold shop status updated', shop });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function approveShop(req, res, next) {
  if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Gold shop ID is invalid' });
  try {
    const result = await approveGoldShop(Number(req.params.id), req.adminUser.id, req.adminUser.user_id);
    if (!result) return res.status(404).json({ message: 'Gold shop not found' });
    return res.json({
      message: 'Gold shop approved and login access created',
      shop: result.shop,
      credentials: result.credentials
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function rejectShop(req, res, next) {
  if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Gold shop ID is invalid' });
  try {
    const shop = await rejectGoldShop(Number(req.params.id), req.adminUser.id, req.adminUser.user_id);
    if (!shop) return res.status(404).json({ message: 'Gold shop not found' });
    return res.json({ message: 'Gold shop rejected', shop });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function deleteGoldShop(req, res, next) {
  if (!positiveId(req.params.id)) return res.status(400).json({ message: 'Gold shop ID is invalid' });
  try {
    const deleted = await softDeleteGoldShop(Number(req.params.id), req.adminUser.id, req.adminUser.user_id);
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
    return res.status(201).json({ message: 'Subscription recorded; payment is pending Super Admin confirmation', shop });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function postConfirmShopPayment(req, res, next) {
  if (!positiveId(req.params.id) || !positiveId(req.params.paymentId)) {
    return res.status(400).json({ message: 'Gold shop or payment ID is invalid' });
  }
  const { confirmation, error } = validatePaymentConfirmation(req.body || {});
  if (error) return res.status(400).json({ message: error });
  try {
    const shop = await confirmGoldShopPayment(
      Number(req.params.id),
      Number(req.params.paymentId),
      confirmation,
      req.adminUser.id
    );
    if (!shop) return res.status(404).json({ message: 'Gold shop not found' });
    return res.json({ message: 'Subscription payment confirmed', shop });
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
  approveShop,
  deleteGoldShop,
  downloadGoldShopDocument,
  getGoldShop,
  getGoldShopPayments,
  getGoldShops,
  getPlans,
  patchGoldShopStatus,
  postGoldShop,
  rejectShop,
  postSubscription,
  postConfirmShopPayment,
  validatePaymentConfirmation,
  putGoldShop,
  validateShop,
  validateLoginCredentials,
  validateDocumentConsent,
  validateSubscription
};

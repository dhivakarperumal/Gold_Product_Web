const {
  getTaxSettings: readTaxSettings,
  saveTaxSettings: writeTaxSettings
} = require('../modules/taxSettingsModule');

function normalizeSettings(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Tax settings are invalid' };
  }
  if (typeof body.gst_enabled !== 'boolean') {
    return { error: 'gst_enabled must be true or false.' };
  }
  const rawRate = body.gst_rate;
  if ((typeof rawRate !== 'number' && typeof rawRate !== 'string')
    || (typeof rawRate === 'string' && rawRate.trim() === '')) {
    return { error: 'gst_rate must be between 0 and 100.' };
  }
  const parsedRate = Number(rawRate);
  if (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 100) {
    return { error: 'gst_rate must be between 0 and 100.' };
  }
  if (!['Tax Exclusive', 'Tax Inclusive'].includes(body.tax_mode)) {
    return { error: 'tax_mode must be Tax Exclusive or Tax Inclusive.' };
  }
  return {
    settings: {
      gst_enabled: body.gst_enabled,
      gst_rate: Math.round((parsedRate + Number.EPSILON) * 100) / 100,
      tax_mode: body.tax_mode
    }
  };
}

async function getTaxSettings(req, res, next) {
  try {
    return res.json(await readTaxSettings(req.adminUser?.user_id));
  } catch (error) {
    return next(error);
  }
}

async function putTaxSettings(req, res, next) {
  const { settings, error } = normalizeSettings(req.body);
  if (error) return res.status(400).json({ message: error });
  try {
    return res.json(await writeTaxSettings(settings, req.adminUser?.user_id));
  } catch (saveError) {
    return next(saveError);
  }
}

module.exports = { getTaxSettings, normalizeSettings, putTaxSettings };

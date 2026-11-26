const {
  createTackOrder,
  getTackOrderProductsByIds,
  listTackOrders
} = require('../modules/tackOrderModule');
const { calculateProductPricing } = require('../services/productPricing');

const MAX_ITEMS = 100;
const MAX_AMOUNT = 9999999999.99;
const MAX_WEIGHT = 999999999.999;

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeText(value, field, maxLength, required = false) {
  if (typeof value !== 'string') return required ? { error: `${field} is required` } : { value: '' };
  const normalized = value.trim();
  if (required && !normalized) return { error: `${field} is required` };
  if (normalized.length > maxLength) return { error: `${field} must be ${maxLength} characters or fewer` };
  return { value: normalized };
}

function normalizeTackOrder(body, catalogProducts) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Tack order details are required' };
  }
  const rawCustomer = body.customer;
  if (!rawCustomer || typeof rawCustomer !== 'object' || Array.isArray(rawCustomer)) {
    return { error: 'Customer details are required' };
  }
  const customer = {
    name: normalizeText(rawCustomer.name, 'Customer name', 150, true),
    phone: normalizeText(rawCustomer.phone, 'Customer phone', 32, true),
    email: normalizeText(rawCustomer.email, 'Customer email', 254),
    city: normalizeText(rawCustomer.city, 'Customer city', 100),
    district: normalizeText(rawCustomer.district, 'Customer district', 100),
    state: normalizeText(rawCustomer.state, 'Customer state', 100),
    pincode: normalizeText(rawCustomer.pincode, 'Customer PIN code', 6),
    address: normalizeText(rawCustomer.address, 'Customer address', 500)
  };
  const customerError = Object.values(customer).find((field) => field.error)?.error;
  if (customerError) return { error: customerError };
  if (customer.email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.value)) {
    return { error: 'Customer email is invalid' };
  }
  if (customer.pincode.value && !/^\d{6}$/.test(customer.pincode.value)) {
    return { error: 'Customer PIN code must contain 6 digits' };
  }
  const normalizedCustomer = Object.fromEntries(
    Object.entries(customer).map(([field, result]) => [field, result.value])
  );

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_ITEMS) {
    return { error: `Add between 1 and ${MAX_ITEMS} products` };
  }
  if (!Array.isArray(catalogProducts)) return { error: 'Products could not be verified' };
  const productsById = new Map(catalogProducts.map((product) => [Number(product.id), product]));
  const items = [];
  for (const [index, rawItem] of body.items.entries()) {
    const productId = Number(rawItem?.product_id);
    if (!Number.isSafeInteger(productId) || productId < 1) {
      return { error: `Product ${index + 1} must be selected from the catalog` };
    }
    const product = productsById.get(productId);
    if (!product || product.status !== 'Active') {
      return { error: `Product ${index + 1} is no longer active in the catalog` };
    }
    const quantity = Number(rawItem.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) {
      return { error: `Product ${index + 1} quantity must be between 1 and 10000` };
    }
    const variantColor = normalizeText(rawItem.variant_color, `Product ${index + 1} color`, 100);
    const variantSize = normalizeText(rawItem.variant_size, `Product ${index + 1} size`, 100);
    if (variantColor.error || variantSize.error) return { error: variantColor.error || variantSize.error };
    let rawPrice = Number(product.final_selling_price) > 0
      ? Number(product.final_selling_price)
      : Number(product.offer_price) > 0
        ? Number(product.offer_price)
        : Number(product.mrp || 0);
    let netGoldWeight;
    const hasNetGoldWeight = rawItem && Object.prototype.hasOwnProperty.call(rawItem, 'net_gold_weight');
    if (hasNetGoldWeight) {
      const requestedWeight = Number(rawItem.net_gold_weight);
      const roundedWeight = Math.round((requestedWeight + Number.EPSILON) * 1000) / 1000;
      if (!Number.isFinite(requestedWeight) || requestedWeight <= 0 || requestedWeight > MAX_WEIGHT
        || Math.abs(requestedWeight - roundedWeight) > 0.0000001) {
        return { error: `Product ${index + 1} net weight must be positive and have at most 3 decimal places` };
      }
      netGoldWeight = roundedWeight;

      if (netGoldWeight !== Number(product.net_gold_weight)) {
        const goldRate = Number(product.gold_rate_per_gram);
        if (Number.isFinite(goldRate) && goldRate > 0) {
          try {
            rawPrice = calculateProductPricing(
              { ...product, net_gold_weight: netGoldWeight },
              goldRate
            ).final_selling_price;
          } catch {
            return { error: `Product ${index + 1} has invalid pricing settings for its custom weight` };
          }
        } else {
          const originalWeight = Number(product.net_gold_weight);
          if (!Number.isFinite(originalWeight) || originalWeight <= 0) {
            return { error: `Product ${index + 1} needs an original weight to calculate its custom price` };
          }
          rawPrice = roundMoney(rawPrice * netGoldWeight / originalWeight);
        }
      }
    }
    if (!Number.isFinite(rawPrice) || rawPrice < 0 || rawPrice > MAX_AMOUNT) {
      return { error: `Product ${index + 1} has an invalid catalog price` };
    }
    const price = roundMoney(rawPrice);
    const item = {
      product_id: productId,
      product_name: product.name,
      category: product.category || '',
      purity: product.purity || '',
      variant_color: variantColor.value,
      variant_size: variantSize.value,
      quantity,
      price,
      total_price: roundMoney(price * quantity)
    };
    if (hasNetGoldWeight) item.net_gold_weight = netGoldWeight;
    items.push(item);
  }

  const gstIncluded = body.gst_included;
  const gstRate = Number(body.gst_rate);
  if (typeof gstIncluded !== 'boolean'
    || !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
    return { error: 'Enter a valid GST selection and rate between 0 and 100' };
  }
  if (!['Percent', 'Fixed'].includes(body.discount_type)) {
    return { error: 'Select a valid discount type' };
  }
  const discountValue = Number(body.discount_value);
  if (!Number.isFinite(discountValue) || discountValue < 0
    || (body.discount_type === 'Percent' && discountValue > 100)
    || discountValue > MAX_AMOUNT) {
    return { error: 'Discount must be a valid non-negative amount' };
  }
  const advanceAmount = Number(body.advance_amount);
  if (!Number.isFinite(advanceAmount) || advanceAmount < 0 || advanceAmount > MAX_AMOUNT) {
    return { error: 'Advance amount must be a valid non-negative amount' };
  }

  const subTotal = roundMoney(items.reduce((sum, item) => sum + item.total_price, 0));
  const gstAmount = gstIncluded ? roundMoney(subTotal * gstRate / 100) : 0;
  const requestedDiscount = body.discount_type === 'Percent'
    ? roundMoney(subTotal * discountValue / 100)
    : discountValue;
  const discountAmount = roundMoney(Math.min(subTotal, requestedDiscount));
  const totalAmount = roundMoney(Math.max(0, subTotal + gstAmount - discountAmount));
  const normalizedAdvance = roundMoney(advanceAmount);
  if (subTotal > MAX_AMOUNT || totalAmount > MAX_AMOUNT) {
    return { error: 'Tack order total exceeds the supported limit' };
  }
  if (normalizedAdvance > totalAmount) {
    return { error: 'Advance amount cannot exceed the order total' };
  }

  return {
    tackOrder: {
      customer: normalizedCustomer,
      items,
      sub_total: subTotal,
      gst_included: gstIncluded,
      gst_rate: roundMoney(gstRate),
      gst_amount: gstAmount,
      discount_type: body.discount_type,
      discount_value: roundMoney(discountValue),
      discount_amount: discountAmount,
      total_amount: totalAmount,
      payment_status: normalizedAdvance >= totalAmount ? 'Paid' : 'Pending',
      advance_amount: normalizedAdvance,
      balance_due: roundMoney(totalAmount - normalizedAdvance)
    }
  };
}

async function postTackOrder(req, res, next) {
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS) {
    return res.status(400).json({ message: `Add between 1 and ${MAX_ITEMS} products` });
  }
  const productIds = items.map((item) => Number(item?.product_id));
  if (productIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    return res.status(400).json({ message: 'Select valid products from the catalog' });
  }

  try {
    const catalogProducts = await getTackOrderProductsByIds(
      [...new Set(productIds)],
      req.adminUser.user_id
    );
    const { tackOrder, error } = normalizeTackOrder(req.body, catalogProducts);
    if (error) return res.status(400).json({ message: error });
    return res.status(201).json(await createTackOrder(tackOrder, req.adminUser.user_id));
  } catch (error) {
    return next(error);
  }
}

async function getTackOrders(req, res, next) {
  try {
    return res.json(await listTackOrders(req.adminUser.user_id));
  } catch (error) {
    return next(error);
  }
}

module.exports = { getTackOrders, normalizeTackOrder, postTackOrder };

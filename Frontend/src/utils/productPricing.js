function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function numeric(value, field) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new TypeError(`${field} must be a finite non-negative number`);
  }
  return parsed;
}

function catalogPrice(product) {
  return Number(product.final_selling_price) > 0
    ? Number(product.final_selling_price)
    : Number(product.offer_price) > 0
      ? Number(product.offer_price)
      : Number(product.mrp ?? product.price ?? 0);
}

export function getDiscountPercentage(product) {
  const mrp = Number(product?.mrp);
  const price = Number(product?.offer_price ?? product?.final_selling_price ?? product?.mrp ?? 0);
  if (!Number.isFinite(mrp) || mrp <= 0 || !Number.isFinite(price) || price < 0 || price >= mrp) {
    return 0;
  }
  return Math.min(100, Math.round(((mrp - price) / mrp) * 100));
}

export function calculatePriceForNetWeight(product, netGoldWeight) {
  const weight = Number(netGoldWeight);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 999999999.999
    || Math.abs(weight - Math.round(weight * 1000) / 1000) > 0.0000001) {
    return { price: null, error: "Enter a positive weight with up to 3 decimal places." };
  }

  if (weight === Number(product.net_gold_weight)) {
    return { price: catalogPrice(product), error: "" };
  }

  const rate = Number(product.gold_rate_per_gram);
  if (!Number.isFinite(rate) || rate <= 0) {
    const originalWeight = Number(product.net_gold_weight);
    const originalPrice = catalogPrice(product);
    if (!Number.isFinite(originalWeight) || originalWeight <= 0
      || !Number.isFinite(originalPrice) || originalPrice < 0) {
      return { price: null, error: "The original weight and price are required to calculate this weight." };
    }
    return { price: money(originalPrice * weight / originalWeight), error: "" };
  }

  try {
    const goldValue = money(weight * rate);
    const makingCharge = numeric(product.making_charge, "Making charge");
    const wastage = numeric(product.wastage, "Wastage");
    const stoneCharges = numeric(product.stone_charges, "Stone charges");
    const otherCharges = numeric(product.other_charges, "Other charges");
    const gstRate = numeric(product.gst_rate, "GST rate");
    const makingValue = String(product.making_charge_type).toLowerCase() === "percentage"
      ? money(goldValue * makingCharge / 100)
      : money(makingCharge);
    const wastageWeight = String(product.wastage_type).toLowerCase() === "percentage"
      ? weight * wastage / 100
      : wastage;
    const wastageValue = money(wastageWeight * rate);
    const preTaxSubtotal = money(goldValue + makingValue + wastageValue + stoneCharges + otherCharges);
    const priceIncludesGst = Boolean(product.price_includes_gst);
    const initialTax = money(priceIncludesGst
      ? preTaxSubtotal * gstRate / (100 + gstRate)
      : preTaxSubtotal * gstRate / 100);
    const preDiscountPrice = priceIncludesGst ? preTaxSubtotal : money(preTaxSubtotal + initialTax);
    const offerType = product.offer_type || (numeric(product.offer, "Offer") > 0 ? "Percentage" : "None");
    let discount = 0;

    if (offerType === "Percentage") {
      discount = preDiscountPrice * numeric(product.offer, "Offer percentage") / 100;
    } else if (offerType === "Fixed Amount") {
      discount = numeric(product.fixed_discount_amount, "Fixed discount");
    } else if (offerType !== "None") {
      throw new TypeError("Offer type is invalid");
    }

    discount = money(Math.min(discount, preDiscountPrice));
    const price = money(preDiscountPrice - discount);
    if (!Number.isFinite(price) || price < 0) {
      throw new TypeError("Calculated price is invalid");
    }
    return { price, error: "" };
  } catch {
    return { price: null, error: "Product pricing settings are incomplete or invalid." };
  }
}

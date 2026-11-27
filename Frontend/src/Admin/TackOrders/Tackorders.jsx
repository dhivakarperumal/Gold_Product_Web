import CustomSelect from "../../Components/CustomSelect.jsx";
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../../api";
import { formatCurrency } from "../../utils/currency";
import { calculatePriceForNetWeight } from "../../utils/productPricing";
import { getProductImageUrl } from "../../Components/Home/productDisplay";
import { FiArrowLeft, FiBox, FiMinus, FiPlus, FiSearch, FiTrash2, FiUser } from "react-icons/fi";

function calculateOrderTotals(cart, gstIncluded, gstRate, discountType, discountValue) {
  const subtotal = cart.reduce(
    (total, item) => total + Number(item.total_price ?? Number(item.price || 0) * Number(item.quantity || 0)),
    0
  );
  const gstPercent = Math.min(100, Math.max(0, Number(gstRate) || 0));
  const gstAmount = gstIncluded ? subtotal * gstPercent / 100 : 0;
  const requestedDiscount = Math.max(0, Number(discountValue) || 0);
  const discount = Math.min(
    subtotal,
    discountType === "Percent" ? subtotal * Math.min(requestedDiscount, 100) / 100 : requestedDiscount
  );
  return {
    subtotal,
    gstAmount,
    discount,
    total: Math.max(0, subtotal + gstAmount - discount)
  };
}

function isValidGstRate(value) {
  const rawRate = String(value).trim();
  const rate = rawRate === "" ? NaN : Number(rawRate);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100;
}

const INDIAN_STATES_AND_UTS = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry"
];

function OrderSummary({
  cart,
  removeFromCart,
  updateCartQuantity,
  onNetWeightChange,
  gstIncluded,
  gstRate,
  setGstIncluded,
  setGstRate,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  advanceAmount,
  setAdvanceAmount,
  submitting = false,
  onNext,
  orderStep
}) {
  const itemCount = cart.reduce((total, item) => total + Number(item.quantity || 0), 0);
  const hasInvalidNetWeight = cart.some((item) => item.netWeightError);
  const validGstRate = isValidGstRate(gstRate);
  const { subtotal, gstAmount, discount, total } = calculateOrderTotals(
    cart,
    gstIncluded,
    gstRate,
    discountType,
    discountValue
  );
  const advance = Math.min(total, Math.max(0, Number(advanceAmount) || 0));
  const balanceDue = total - advance;

  return (
    <aside className="mb-4 flex min-h-0 flex-col rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-[#073f38] via-[#064a40] to-[#14534a] p-3 text-white shadow-[0_18px_50px_rgba(5,59,48,0.2)] sm:p-5 xl:mb-0 xl:min-h-0">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-amber-200">
            <FiBox aria-hidden="true" size={18} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Order Summary</h2>
            <p className="mt-0.5 text-xs text-white/60">{itemCount} items in this order</p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-bold">{cart.length} products</span>
      </div>

      <div className="space-y-3 pr-1 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain">
        {cart.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.04] px-5 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300/20 to-white/10 text-amber-200">
              <FiBox size={25} aria-hidden="true" />
            </span>
            <p className="mt-4 text-sm font-extrabold text-white">Your order starts here</p>
            <p className="mt-1 max-w-[220px] text-xs leading-5 text-white/55">
              Choose a product from the catalog and it will appear in this summary.
            </p>
          </div>
        ) : (
          cart.map((item) => (
            <article key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-3">
                {item.image ? (
                  <img src={item.image} alt="" className="h-11 w-11 rounded-lg object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/60">
                    <FiBox aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{item.name || "Product"}</p>
                  <p className="mt-0.5 truncate text-xs text-white/55">
                    {[item.colorName, item.size].filter(Boolean).join(" / ") || `ID: ${item.product_id}`}
                  </p>
                  {item.canEditNetWeight && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <label htmlFor={`net-weight-${item.id}`} className="text-[11px] text-white/65">
                        Net weight
                      </label>
                      <input
                        id={`net-weight-${item.id}`}
                        type="number"
                        min="0.001"
                        max="999999999.999"
                        step="0.001"
                        inputMode="decimal"
                        value={item.netWeightInput}
                        onChange={(event) => onNetWeightChange(item.id, event.target.value)}
                        aria-label={`Net weight in grams for ${item.name}`}
                        aria-invalid={Boolean(item.netWeightError)}
                        className="w-20 rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 text-xs font-semibold text-white outline-none focus:border-orange-400"
                      />
                      <span className="text-[11px] text-white/65">g</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${item.name} from pre-order`}
                  onClick={() => void removeFromCart(item.id)}
                  className="rounded p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white"
                >
                  <FiTrash2 size={15} aria-hidden="true" />
                </button>
              </div>
              {item.netWeightError && (
                <p role="alert" className="mt-1 text-[11px] text-orange-200">{item.netWeightError}</p>
              )}

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Decrease ${item.name} quantity`}
                    onClick={() => void updateCartQuantity(item.id, Math.max(1, Number(item.quantity) - 1))}
                    disabled={Number(item.quantity) <= 1}
                    className="flex h-7 w-7 items-center justify-center rounded border border-white/20 text-white/80 disabled:opacity-40"
                  >
                    <FiMinus size={13} aria-hidden="true" />
                  </button>
                  <span className="min-w-4 text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label={`Increase ${item.name} quantity`}
                    onClick={() => void updateCartQuantity(item.id, Number(item.quantity) + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded border border-white/20 text-white/80"
                  >
                    <FiPlus size={13} aria-hidden="true" />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-white/50">{formatCurrency(item.price)} each</p>
                  <p className="text-sm font-bold">
                    {formatCurrency(item.total_price ?? Number(item.price || 0) * Number(item.quantity || 0))}
                  </p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="mt-4 shrink-0 space-y-2 border-t border-white/15 pt-4">
        {orderStep === "details" && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-white/65">Subtotal</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white/65">GST rate</span>
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={gstRate}
                  onChange={(event) => setGstRate(event.target.value)}
                  className="w-20 rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-right font-bold text-white outline-none focus:border-orange-400"
                  aria-label="GST rate percentage"
                  aria-invalid={!validGstRate}
                />
                <span>%</span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={gstIncluded}
                onChange={(event) => setGstIncluded(event.target.checked)}
                className="accent-orange-500"
              />
              Apply GST to this order
            </label>
            {!validGstRate && (
              <p className="text-xs font-semibold text-rose-200">Enter a GST percentage between 0 and 100.</p>
            )}
            <div className="flex justify-between gap-2 text-xs text-white/55">
              <span>GST on subtotal (before discount)</span>
              <span>{formatCurrency(gstAmount)}</span>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="mb-2 text-sm font-bold">Discount</p>
              <div className="flex items-center gap-2">
                <CustomSelect
                  value={discountType}
                  onChange={(event) => setDiscountType(event.target.value)}
                  aria-label="Discount type"
                  variant="dark"
                  className="min-w-0 flex-1 rounded-lg px-2 py-2 text-sm"
                >
                  <option value="Percent">Percent</option>
                  <option value="Fixed">Fixed amount</option>
                </CustomSelect>
                <input
                  type="number"
                  min="0"
                  max={discountType === "Percent" ? "100" : undefined}
                  step="0.01"
                  value={discountValue}
                  onChange={(event) => setDiscountValue(event.target.value)}
                  aria-label={discountType === "Percent" ? "Discount percentage" : "Discount amount"}
                  className="w-24 rounded-lg border border-white/15 bg-white/10 px-2 py-2 text-right text-sm font-bold text-white outline-none focus:border-orange-400"
                />
                <span className="self-center text-sm">{discountType === "Percent" ? "%" : ""}</span>
              </div>
            </div>
            <div className="flex justify-between text-xs text-white/55">
              <span>Discount applied</span>
              <span>-{formatCurrency(discount)}</span>
            </div>

            <div className="flex items-center justify-between border-t border-white/15 pt-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-orange-200">Grand Total</span>
              <span className="text-2xl font-black">{formatCurrency(total)}</span>
            </div>

            <label className="flex items-center justify-between gap-3 text-sm font-semibold text-white/75">
              Advance amount
              <input
                type="number"
                min="0"
                max={total}
                step="0.01"
                value={advanceAmount === "" ? "" : advance}
                onChange={(event) => {
                  const value = event.target.value;
                  setAdvanceAmount(
                    value === "" ? "" : String(Math.min(total, Math.max(0, Number(value) || 0)))
                  );
                }}
                aria-label="Advance amount"
                className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-right font-bold text-white outline-none focus:border-orange-400"
              />
            </label>

            <div className="flex items-center justify-between border-t border-white/15 pt-3 text-sm">
              <span className="font-bold text-orange-200">Balance due</span>
              <span className="font-extrabold">{formatCurrency(balanceDue)}</span>
            </div>
          </>
        )}

        {orderStep === "products" ? (
          <button
            type="button"
            onClick={onNext}
            disabled={cart.length === 0 || hasInvalidNetWeight}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#14534a] px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-950/20 transition hover:bg-[#0f4039] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next Details
            <FiArrowLeft className="rotate-180" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            form="tack-order-form"
            disabled={submitting || cart.length === 0 || hasInvalidNetWeight || !validGstRate}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087768] to-[#064a40] px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-950/20 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Adding Tack Order..." : "Add Tack Order"}
            {!submitting && <FiPlus aria-hidden="true" />}
          </button>
        )}
      </div>
    </aside>
  );
}

const TackOrders = () => {
  const { tackOrdersSearch: search, setTackOrdersSearch } = useOutletContext();
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [metalFilter, setMetalFilter] = useState("ALL");
  const [retryCount, setRetryCount] = useState(0);
  const [orderStep, setOrderStep] = useState("products");
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    district: "",
    state: "",
    pincode: "",
    address: ""
  });
  const [gstIncluded, setGstIncluded] = useState(false);
  const [gstRate, setGstRate] = useState("0");
  const [discountType, setDiscountType] = useState("Percent");
  const [discountValue, setDiscountValue] = useState("0");
  const [netWeightEdits, setNetWeightEdits] = useState({});
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchProducts = async () => {
      setLoading(true);
      setError("");

      try {
        const firstResponse = await api.get("/products/mine", {
          params: { page: 1, limit: 100 }
        });
        const firstPage = firstResponse.data;

        if (!Array.isArray(firstPage?.products)) {
          throw new TypeError("The products response must contain a products array");
        }

        const allProducts = [...firstPage.products];
        const totalPages = Math.max(1, Number(firstPage.pagination?.totalPages) || 1);

        for (let requestedPage = 2; requestedPage <= totalPages; requestedPage += 1) {
          if (!active) return;
          const response = await api.get("/products/mine", {
            params: { page: requestedPage, limit: 100 }
          });
          if (!Array.isArray(response.data?.products)) {
            throw new TypeError("A products page did not contain a products array");
          }
          allProducts.push(...response.data.products);
        }

        if (active) {
          setProducts(allProducts);
        }
      } catch (fetchError) {
        if (active) {
          console.error("Failed to fetch products:", fetchError);
          setError(fetchError.response?.data?.message || "Could not load products. Please try again.");
          setProducts([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchProducts();
    return () => {
      active = false;
    };
  }, [retryCount]);

  const availableCategories = useMemo(
    () => [...new Set(products.map((product) => product.category).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right)),
    [products]
  );
  const availableMetals = useMemo(
    () => [...new Set(products.map((product) => product.metal_type).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right)),
    [products]
  );
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !query || [
        product.id,
        product.product_code,
        product.name,
        product.category,
        product.metal_type,
        product.purity
      ].some((value) => String(value || "").toLowerCase().includes(query));
      return matchesSearch
        && (categoryFilter === "ALL" || product.category === categoryFilter)
        && (metalFilter === "ALL" || product.metal_type === metalFilter);
    });
  }, [products, search, categoryFilter, metalFilter]);

  const addToCart = (product) => {
    const productId = Number(product.id);
    if (!Number.isSafeInteger(productId) || productId < 1 || product.status !== "Active") {
      toast.error("This product is not available for a pre-order.");
      return;
    }

    const selectedVariant = Array.isArray(product.variants) ? product.variants[0] : null;
    const colorName = selectedVariant?.colorName || selectedVariant?.color || "Default";
    const size = selectedVariant?.selectedSizes?.[0] || "Free Size";
    const id = `${productId}:${encodeURIComponent(colorName)}:${encodeURIComponent(size)}`;
    const price = Number(product.final_selling_price) > 0
      ? Number(product.final_selling_price)
      : Number(product.offer_price) > 0
        ? Number(product.offer_price)
        : Number(product.mrp || 0);
    const existingItem = cart.find((item) => item.id === id);
    if (existingItem?.quantity >= 10000) {
      toast.error("A pre-order item cannot exceed 10,000 units.");
      return;
    }

    setCart((currentCart) => {
      const currentItem = currentCart.find((item) => item.id === id);
      if (currentItem) {
        return currentCart.map((item) => item.id === id
          ? { ...item, quantity: item.quantity + 1, total_price: price * (item.quantity + 1) }
          : item);
      }
      return [...currentCart, {
        id,
        product_id: productId,
        name: product.name,
        image: getProductImageUrl(product),
        price,
        total_price: price,
        quantity: 1,
        colorName,
        size,
        net_gold_weight: product.net_gold_weight
      }];
    });
    toast.success(`${product.name || "Product"} added to pre-order.`);
  };
  const removeFromCart = (cartItemId) => {
    setCart((currentCart) => currentCart.filter((item) => item.id !== cartItemId));
  };
  const updateCartQuantity = (cartItemId, quantity) => {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) {
      toast.error("Quantity must be between 1 and 10,000.");
      return;
    }
    setCart((currentCart) => currentCart.map((item) => item.id === cartItemId
      ? { ...item, quantity, total_price: Number(item.price || 0) * quantity }
      : item));
  };

  const productsById = new Map(products.map((product) => [String(product.id), product]));
  const pricedCart = cart.map((item) => {
    const catalogProduct = productsById.get(String(item.product_id));
    const pricingItem = {
      ...(catalogProduct || {}),
      ...item,
      net_gold_weight: item.net_gold_weight ?? catalogProduct?.net_gold_weight
    };
    const originalWeight = Number(pricingItem.net_gold_weight);
    const canEditNetWeight = pricingItem.net_gold_weight != null
      && pricingItem.net_gold_weight !== ""
      && Number.isFinite(originalWeight)
      && originalWeight > 0;
    if (!canEditNetWeight) return { ...item, canEditNetWeight: false, netWeightError: "" };

    const hasOverride = Object.prototype.hasOwnProperty.call(netWeightEdits, item.id);
    const netWeightInput = hasOverride ? netWeightEdits[item.id] : String(pricingItem.net_gold_weight);
    const weight = Number(netWeightInput);
    const validWeight = netWeightInput !== ""
      && Number.isFinite(weight)
      && weight > 0
      && weight <= 999999999.999
      && Math.abs(weight - Math.round(weight * 1000) / 1000) <= 0.0000001;
    const priceResult = validWeight
      ? calculatePriceForNetWeight(pricingItem, weight)
      : { price: null, error: "Enter a positive weight with up to 3 decimal places." };
    const price = priceResult.price ?? Number(item.price || 0);

    return {
      ...item,
      canEditNetWeight: true,
      netWeightInput,
      netWeightError: priceResult.error,
      net_gold_weight: validWeight ? weight : item.net_gold_weight,
      price,
      total_price: price * Number(item.quantity || 0)
    };
  });
  const hasInvalidNetWeight = pricedCart.some((item) => item.netWeightError);
  const handleNetWeightChange = (cartItemId, value) => {
    setNetWeightEdits((current) => ({ ...current, [cartItemId]: value }));
  };
  const productCountLabel = loading
    ? "Loading your catalog..."
    : `${filteredProducts.length}${filteredProducts.length === products.length ? "" : ` of ${products.length}`} products · Pre-order without stock limits`;

  const handleCreateTackOrder = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (!isValidGstRate(gstRate)) {
      toast.error("GST rate must be between 0 and 100.");
      return;
    }
    if (hasInvalidNetWeight) {
      toast.error("Correct the net weight before creating this tack order.");
      return;
    }

    setSubmitting(true);
    try {
      const { total } = calculateOrderTotals(pricedCart, gstIncluded, gstRate, discountType, discountValue);
      const { data } = await api.post("/tack-orders", {
        customer,
        items: pricedCart.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
          variant_color: item.variant_color ?? item.colorName ?? "",
          variant_size: item.variant_size ?? item.size ?? "",
          ...(item.canEditNetWeight ? { net_gold_weight: Number(item.net_gold_weight) } : {})
        })),
        gst_included: gstIncluded,
        gst_rate: Number(gstRate),
        discount_type: discountType,
        discount_value: Number(discountValue) || 0,
        advance_amount: Math.min(total, Math.max(0, Number(advanceAmount) || 0))
      });

      toast.success(`Tack order ${data.order_no} added. Status: ${data.order_status || "Order Placed"}.`);
      setCart([]);
      setCustomer({
        name: "",
        phone: "",
        email: "",
        city: "",
        district: "",
        state: "",
        pincode: "",
        address: ""
      });
      setAdvanceAmount("");
      setDiscountValue("0");
      setGstIncluded(false);
      setGstRate("0");
      setNetWeightEdits({});
      setCategoryFilter("ALL");
      setMetalFilter("ALL");
      setTackOrdersSearch("");
      setOrderStep("products");
    } catch (submitError) {
      console.error("Failed to create tack order:", submitError);
      toast.error(submitError.response?.data?.message || "Could not add tack order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-0 flex h-[90vh] min-h-0 flex-col bg-gradient-to-br from-[#f1f7f3] via-[#f7f7f2] to-[#fbf2e5] px-2 pt-3 pb-2 sm:px-4 sm:pt-4">
      {orderStep === "products" ? (
      <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-stretch">
        <main className="flex min-w-0 flex-col xl:min-h-0">
          <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-[0_8px_24px_rgba(26,67,55,0.07)] backdrop-blur sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-900/15">
                <FiBox size={19} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#087768]">Step 1 · Build order</p>
                <h1 className="truncate text-lg font-black tracking-tight text-slate-900">Select products</h1>
                <p className="truncate text-xs text-slate-500">{productCountLabel}</p>
              </div>
            </div>
            <ol aria-label="Order progress" className="flex items-center gap-2">
              <li aria-current="step" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#087768] text-[10px] text-white">1</span>
                <span className="hidden sm:inline">Products</span>
              </li>
              <li aria-hidden="true" className="h-px w-5 bg-slate-200" />
              <li className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-600">2</span>
                <span className="hidden sm:inline">Customer</span>
              </li>
            </ol>
          </div>
          <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
            <section aria-label="Search and filter products" className="mb-3 grid gap-2 rounded-xl border border-slate-200/80 bg-white/90 p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(130px,160px)_minmax(130px,160px)_auto]">
              <label className="relative min-w-0">
                <FiSearch aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setTackOrdersSearch(event.target.value)}
                  placeholder="Search name, ID, metal, purity..."
                  aria-label="Search pre-order products"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700 outline-none transition focus:border-[#087768] focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <CustomSelect
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label="Filter products by category"
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 outline-none focus:border-[#087768] focus:ring-2 focus:ring-emerald-100"
              >
                <option value="ALL">All categories</option>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </CustomSelect>
              <CustomSelect
                value={metalFilter}
                onChange={(event) => setMetalFilter(event.target.value)}
                aria-label="Filter products by metal"
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 outline-none focus:border-[#087768] focus:ring-2 focus:ring-emerald-100"
              >
                <option value="ALL">All metals</option>
                {availableMetals.map((metal) => (
                  <option key={metal} value={metal}>{metal}</option>
                ))}
              </CustomSelect>
              {(search || categoryFilter !== "ALL" || metalFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setTackOrdersSearch("");
                    setCategoryFilter("ALL");
                    setMetalFilter("ALL");
                  }}
                  className="h-10 rounded-lg px-3 text-xs font-bold text-[#087768] transition hover:bg-emerald-50"
                >
                  Clear
                </button>
              )}
            </section>
            {error ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="ml-3 font-semibold underline"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-[4/3] animate-pulse bg-slate-100 xl:aspect-[8/5]" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                <div className="h-8 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredProducts.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {filteredProducts.map((product) => {
            const imageUrl = getProductImageUrl(product);
            const isActive = product.status === "Active";
            const price = Number(product.final_selling_price) > 0
              ? Number(product.final_selling_price)
              : Number(product.offer_price) > 0
                ? Number(product.offer_price)
                : Number(product.mrp || 0);

            return (
              <article
                key={product.id}
                className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-white bg-white shadow-[0_5px_16px_rgba(26,67,55,0.08)] ring-1 ring-slate-200/70 transition duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_12px_26px_rgba(26,67,55,0.13)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-amber-50 via-stone-100 to-teal-50 xl:aspect-[8/5]">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.name || "Product"}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="font-serif text-7xl text-[#b08d57]/50">
                        {(product.name || "P").charAt(0)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-2.5">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-slate-800" title={product.name || "Unnamed product"}>
                        {product.name || "Unnamed product"}
                      </h2>
                      <p className="mt-0.5 truncate text-[10px] text-slate-500">
                        Product ID: {product.product_code || product.id}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[9px] font-medium text-slate-500">Price</p>
                      <p className="text-xs font-extrabold text-[#14534a]">{formatCurrency(price)}</p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[9px] font-medium text-slate-500">Metal / Purity</p>
                      <p className="truncate text-[11px] font-semibold text-slate-700" title={[product.metal_type, product.purity].filter(Boolean).join(" / ")}>
                        {[product.metal_type, product.purity].filter(Boolean).join(" / ") || "Not specified"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void addToCart(product)}
                      disabled={!isActive}
                      aria-label={`Add ${product.name || "product"} to pre-order`}
                      title={isActive ? "Add to pre-order" : "Inactive products cannot be pre-ordered"}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#14534a] text-white shadow-sm transition hover:bg-[#0f4039] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14534a] disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <FiPlus size={17} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-2xl text-[#b08d57]">
            <FiBox aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-800">
            {products.length ? "No products match these filters" : "No products found"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {products.length ? "Try a different search or clear the selected filters." : "Products you can pre-order will appear here."}
          </p>
          {products.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setTackOrdersSearch("");
                setCategoryFilter("ALL");
                setMetalFilter("ALL");
              }}
              className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-[#087768] hover:bg-emerald-100"
            >
              Clear search and filters
            </button>
          )}
        </div>
            )}
          </div>

        </main>

        <OrderSummary
          cart={pricedCart}
          removeFromCart={removeFromCart}
          updateCartQuantity={updateCartQuantity}
          onNetWeightChange={handleNetWeightChange}
          gstIncluded={gstIncluded}
          gstRate={gstRate}
          setGstIncluded={setGstIncluded}
          setGstRate={setGstRate}
          discountType={discountType}
          setDiscountType={setDiscountType}
          discountValue={discountValue}
          setDiscountValue={setDiscountValue}
          advanceAmount={advanceAmount}
          setAdvanceAmount={setAdvanceAmount}
          orderStep={orderStep}
          onNext={() => setOrderStep("details")}
        />
      </div>
      ) : (
        <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
          <form
            id="tack-order-form"
            onSubmit={handleCreateTackOrder}
            className="mx-auto w-full max-w-4xl self-start rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-white via-white to-[#fffaf1] p-5 shadow-[0_20px_60px_rgba(18,54,45,0.08)] ring-1 ring-white/80 sm:p-8"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-amber-50 text-[#087768] shadow-inner">
                  <FiUser aria-hidden="true" size={20} />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#087768]">Step 2 · Customer</p>
                  <h2 className="mt-0.5 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Customer &amp; delivery details</h2>
                  <p className="mt-1 text-sm text-slate-500">Add the customer information to complete this shop order.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderStep("products")}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#087768]"
              >
                <FiArrowLeft aria-hidden="true" />
                Back to Items
              </button>
            </div>
            <ol aria-label="Order progress" className="mb-6 grid grid-cols-2 gap-2">
              <li className="flex items-center gap-2 rounded-xl bg-emerald-50/80 px-3 py-2.5 text-xs font-bold text-emerald-800">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-700 text-[10px] text-white">1</span>
                Items selected
              </li>
              <li aria-current="step" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs font-bold text-amber-900">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">2</span>
                Customer details
              </li>
            </ol>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Customer name *
                <input
                  required
                  autoComplete="name"
                  value={customer.name}
                  onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
                  placeholder="Enter customer name"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none transition placeholder:text-slate-400 focus:border-[#087768] focus:ring-4 focus:ring-emerald-800/10"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Phone number *
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  value={customer.phone}
                  onChange={(event) => setCustomer({ ...customer, phone: event.target.value })}
                  placeholder="Enter phone number"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none transition placeholder:text-slate-400 focus:border-[#087768] focus:ring-4 focus:ring-emerald-800/10"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  value={customer.email}
                  onChange={(event) => setCustomer({ ...customer, email: event.target.value })}
                  placeholder="Enter email address (optional)"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none transition placeholder:text-slate-400 focus:border-[#087768] focus:ring-4 focus:ring-emerald-800/10"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                City
                <input
                  autoComplete="address-level2"
                  value={customer.city}
                  onChange={(event) => setCustomer({ ...customer, city: event.target.value })}
                  placeholder="Enter city"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none transition placeholder:text-slate-400 focus:border-[#087768] focus:ring-4 focus:ring-emerald-800/10"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                District
                <input
                  value={customer.district}
                  onChange={(event) => setCustomer({ ...customer, district: event.target.value })}
                  placeholder="Enter district"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none transition placeholder:text-slate-400 focus:border-[#087768] focus:ring-4 focus:ring-emerald-800/10"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                State
                <CustomSelect
                  autoComplete="address-level1"
                  value={customer.state}
                  onChange={(event) => setCustomer({ ...customer, state: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none transition placeholder:text-slate-400 focus:border-[#087768] focus:ring-4 focus:ring-emerald-800/10"
                >
                  <option value="">Select state</option>
                  {INDIAN_STATES_AND_UTS.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </CustomSelect>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                PIN code
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={customer.pincode}
                  onChange={(event) => setCustomer({ ...customer, pincode: event.target.value })}
                  placeholder="6-digit PIN code"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none transition placeholder:text-slate-400 focus:border-[#087768] focus:ring-4 focus:ring-emerald-800/10"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Address
                <textarea
                  rows={4}
                  autoComplete="street-address"
                  value={customer.address}
                  onChange={(event) => setCustomer({ ...customer, address: event.target.value })}
                  placeholder="Enter customer address (optional)"
                  className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none transition placeholder:text-slate-400 focus:border-[#087768] focus:ring-4 focus:ring-emerald-800/10"
                />
              </label>
            </div>
          </form>

          <OrderSummary
            cart={pricedCart}
            removeFromCart={removeFromCart}
            updateCartQuantity={updateCartQuantity}
            onNetWeightChange={handleNetWeightChange}
            gstIncluded={gstIncluded}
            gstRate={gstRate}
            setGstIncluded={setGstIncluded}
            setGstRate={setGstRate}
            discountType={discountType}
            setDiscountType={setDiscountType}
            discountValue={discountValue}
            setDiscountValue={setDiscountValue}
            advanceAmount={advanceAmount}
            setAdvanceAmount={setAdvanceAmount}
            submitting={submitting}
            orderStep={orderStep}
            onNext={() => setOrderStep("details")}
          />
        </div>
      )}
    </section>
  );
};

export default TackOrders;
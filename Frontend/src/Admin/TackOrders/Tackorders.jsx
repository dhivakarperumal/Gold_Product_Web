import { useContext, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../../api";
import { formatCurrency } from "../../utils/currency";
import { calculatePriceForNetWeight } from "../../utils/productPricing";
import { getProductImageUrl } from "../../Components/Home/productDisplay";
import { StoreContext } from "../../PrivateRouter/StoreContext";
import { FiArrowLeft, FiBox, FiMinus, FiPlus, FiTag, FiTrash2, FiUser } from "react-icons/fi";

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

function formatWeight(value) {
  const weight = Number(value);
  return value == null || value === "" || !Number.isFinite(weight)
    ? ""
    : `${weight.toLocaleString("en-IN", { maximumFractionDigits: 3 })} g`;
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
  loadingCart,
  removeFromCart,
  updateCartQuantity,
  onNetWeightChange,
  gstIncluded,
  setGstIncluded,
  gstRate,
  setGstRate,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  advanceAmount,
  setAdvanceAmount,
  submitting = false,
  savedOrder = null,
  onNext,
  orderStep
}) {
  const itemCount = cart.reduce((total, item) => total + Number(item.quantity || 0), 0);
  const hasInvalidNetWeight = cart.some((item) => item.netWeightError);
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
    <aside className="mb-4 flex min-h-0 flex-col rounded-xl bg-gradient-to-b from-[#003B32] to-[#14534a] p-2 text-white shadow-lg sm:p-5 xl:min-h-[89vh]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Order Summary</h2>
          <p className="mt-1 text-xs text-white/60">{itemCount} items</p>
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold">{cart.length} products</span>
      </div>

      <div className="space-y-3 pr-1">
        {loadingCart ? (
          <p className="py-6 text-center text-sm text-white/60">Loading cart...</p>
        ) : cart.length === 0 ? (
          <p className="py-5 text-sm text-white/55">No products added yet.</p>
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
                  aria-label={`Remove ${item.name} from cart`}
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

            <div>
              <p className="mb-2 text-sm font-bold">GST for this order</p>
              <div className="grid grid-cols-2 gap-2">
                {[true, false].map((included) => (
                  <button
                    key={String(included)}
                    type="button"
                    aria-pressed={gstIncluded === included}
                    onClick={() => setGstIncluded(included)}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                      gstIncluded === included
                        ? "border-orange-400 bg-orange-500/20 text-orange-200"
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {included ? "Include GST" : "Exclude GST"}
                  </button>
                ))}
              </div>
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
                />
                <span>%</span>
              </span>
            </label>
            <div className="flex justify-between gap-2 text-xs text-white/55">
              <span>GST on subtotal (before discount)</span>
              <span>{formatCurrency(gstAmount)}</span>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">Discount</p>
              <div className="flex gap-2">
                <select
                  value={discountType}
                  onChange={(event) => setDiscountType(event.target.value)}
                  aria-label="Discount type"
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#4b3021] px-2 py-2 text-sm text-white outline-none focus:border-orange-400"
                >
                  <option value="Percent">Percent</option>
                  <option value="Fixed">Fixed amount</option>
                </select>
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
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next Details
            <FiArrowLeft className="rotate-180" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            form="tack-order-form"
            disabled={submitting || Boolean(savedOrder) || cart.length === 0 || hasInvalidNetWeight}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
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
  const { tackOrdersSearch: search } = useOutletContext();
  const { cart, loadingCart, addToCart, removeFromCart, updateCartQuantity, clearCart } = useContext(StoreContext);
  const [products, setProducts] = useState([]);
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
  const [gstIncluded, setGstIncluded] = useState(true);
  const [gstRate, setGstRate] = useState("12");
  const [discountType, setDiscountType] = useState("Percent");
  const [discountValue, setDiscountValue] = useState("0");
  const [netWeightEdits, setNetWeightEdits] = useState({});
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savedOrder, setSavedOrder] = useState(null);

  useEffect(() => {
    let active = true;

    const fetchProducts = async () => {
      setLoading(true);
      setError("");

      try {
        const firstResponse = await api.get("/products/mine", {
          params: { page: 1, limit: 100, search: search.trim() }
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
            params: { page: requestedPage, limit: 100, search: search.trim() }
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
  }, [retryCount, search]);

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

  const handleCreateTackOrder = async (event) => {
    event.preventDefault();
    if (submitting || savedOrder) return;
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

      try {
        await clearCart();
      } catch (clearError) {
        console.error("Tack order created but the cart could not be cleared:", clearError);
        setSavedOrder(data);
        toast.error(`Tack order ${data.order_no} was created, but the cart could not be cleared.`);
        return;
      }

      toast.success(`Tack order ${data.order_no} added. Status: ${data.order_status || "Order Placed"}.`);
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
      setNetWeightEdits({});
      setOrderStep("products");
    } catch (submitError) {
      console.error("Failed to create tack order:", submitError);
      toast.error(submitError.response?.data?.message || "Could not add tack order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-0 flex h-[90vh] min-h-0 flex-col bg-[#fff8ef] px-2 pt-4 pb-0 sm:pt-6">
      {orderStep === "products" ? (
      <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-stretch">
        <main className="flex min-w-0 flex-col xl:min-h-0">
          <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="aspect-[4/3] animate-pulse bg-slate-100 xl:aspect-[8/5]" />
              <div className="space-y-3 p-4 xl:p-3">
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                <div className="h-10 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const imageUrl = getProductImageUrl(product);
            const stock = Number(product.total_stock ?? 0);
            const price = Number(product.final_selling_price ?? product.offer_price ?? product.mrp ?? 0);
            const netWeight = formatWeight(product.net_gold_weight) || "—";
            const originalPrice = Number(product.mrp ?? 0);
            const offerPrice = Number(product.offer_price ?? price);
            const discountPercent = originalPrice > offerPrice && originalPrice > 0
              ? Math.round(((originalPrice - offerPrice) / originalPrice) * 100)
              : 0;
            const discountAmount = Number(product.applied_discount ?? 0);
            const hasOffer = discountPercent > 0 || discountAmount > 0 || Number(product.offer ?? 0) > 0;
            const offerLabel = discountPercent > 0
              ? `${discountPercent}% OFF`
              : discountAmount > 0
                ? `${formatCurrency(discountAmount)} OFF`
                : product.offer_type === "Percentage" && Number(product.offer) > 0
                  ? `${Math.round(Number(product.offer))}% OFF`
                  : "SPECIAL OFFER";
            const stockLabel = stock <= 0 ? "Out of stock" : stock < 10 ? "Low stock" : "In stock";
            const stockStyle = stock <= 0
              ? "bg-rose-100 text-rose-700"
              : stock < 10
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-700";

            return (
              <article
                key={product.id}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
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
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
                    {product.category || "Uncategorized"}
                  </span>
                  {hasOffer && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-extrabold tracking-wide text-white shadow-md">
                      <FiTag size={13} aria-hidden="true" />
                      {offerLabel}
                    </span>
                  )}
                  <span className={`absolute bottom-3 right-3 rounded-full px-3 py-1 text-xs font-bold shadow-sm ${stockStyle}`}>
                    {stockLabel}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-4 xl:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold text-slate-800">
                        {product.name || "Unnamed product"}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                        <span>{product.product_code || "No product code"}</span>
                      </div>
                    </div>
                    <p className="shrink-0 text-right text-base font-extrabold text-[#14534a]">
                      {formatCurrency(price)}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                      <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                        <p className="text-[10px] font-medium text-slate-500">Metal / Purity</p>
                        <p className="mt-1 break-words text-xs font-semibold leading-snug text-slate-700">
                        {[product.metal_type, product.purity].filter(Boolean).join(" / ") || "Not specified"}
                        </p>
                      </div>
                      <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                        <p className="text-[10px] font-medium text-slate-500">Net weight</p>
                        <p className="mt-1 text-xs font-semibold text-slate-700">{netWeight}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void addToCart(product)}
                      disabled={stock <= 0}
                      aria-label={`Add ${product.name || "product"} to cart`}
                      title="Add to cart"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#14534a] text-white shadow-sm transition hover:bg-[#0f4039] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14534a] disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <FiPlus size={20} aria-hidden="true" />
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
          <h2 className="mt-4 text-lg font-bold text-slate-800">No products found</h2>
          <p className="mt-1 text-sm text-slate-500">
            Try another search to find a product.
          </p>
        </div>
            )}
          </div>

        </main>

        <OrderSummary
          cart={pricedCart}
          loadingCart={loadingCart}
          removeFromCart={removeFromCart}
          updateCartQuantity={updateCartQuantity}
          onNetWeightChange={handleNetWeightChange}
          gstIncluded={gstIncluded}
          setGstIncluded={setGstIncluded}
          gstRate={gstRate}
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
            className="mx-auto w-full max-w-4xl self-start rounded-2xl border border-orange-100 bg-white p-5 shadow-sm sm:p-7"
          >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 pb-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <FiUser aria-hidden="true" size={20} />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">Order details</p>
                  <h2 className="mt-0.5 text-xl font-extrabold text-slate-800">Customer Details</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Enter the customer information for this shop order.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderStep("products")}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700 transition hover:bg-orange-100"
              >
                <FiArrowLeft aria-hidden="true" />
                Back to Items
              </button>
            </div>
            {savedOrder && (
              <p role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Tack order {savedOrder.order_no} was created, but the cart could not be cleared. Refresh the cart before creating another order.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Customer name *
                <input
                  required
                  autoComplete="name"
                  value={customer.name}
                  onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
                  placeholder="Enter customer name"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-orange-400"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-orange-400"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-orange-400"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                City
                <input
                  autoComplete="address-level2"
                  value={customer.city}
                  onChange={(event) => setCustomer({ ...customer, city: event.target.value })}
                  placeholder="Enter city"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-orange-400"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                District
                <input
                  value={customer.district}
                  onChange={(event) => setCustomer({ ...customer, district: event.target.value })}
                  placeholder="Enter district"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-orange-400"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                State
                <select
                  autoComplete="address-level1"
                  value={customer.state}
                  onChange={(event) => setCustomer({ ...customer, state: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-orange-400"
                >
                  <option value="">Select state</option>
                  {INDIAN_STATES_AND_UTS.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-orange-400"
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
                  className="mt-1 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-orange-400"
                />
              </label>
            </div>
          </form>

          <OrderSummary
            cart={pricedCart}
            loadingCart={loadingCart}
            removeFromCart={removeFromCart}
            updateCartQuantity={updateCartQuantity}
            onNetWeightChange={handleNetWeightChange}
            gstIncluded={gstIncluded}
            setGstIncluded={setGstIncluded}
            gstRate={gstRate}
            setGstRate={setGstRate}
            discountType={discountType}
            setDiscountType={setDiscountType}
            discountValue={discountValue}
            setDiscountValue={setDiscountValue}
            advanceAmount={advanceAmount}
            setAdvanceAmount={setAdvanceAmount}
            submitting={submitting}
            savedOrder={savedOrder}
            orderStep={orderStep}
            onNext={() => setOrderStep("details")}
          />
        </div>
      )}
    </section>
  );
};

export default TackOrders;
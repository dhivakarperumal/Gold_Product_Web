import CustomSelect from "../../Components/CustomSelect.jsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiBox, FiCalendar, FiCheckCircle, FiChevronDown, FiCreditCard, FiDollarSign, FiEdit2, FiEye, FiFileText, FiGrid, FiImage, FiList, FiPlus, FiPrinter, FiRepeat, FiSave, FiSearch, FiTrash2, FiUser, FiX } from "react-icons/fi";
import { toast } from "react-hot-toast";
import api from "../../api";
import DateRangeFilter from "../Components/DateRangeFilter";
import useGoldRates from "../../PrivateRouter/useGoldRates";
import { getReceiptSettings } from "./receiptSettings";
import { formatCompactCurrency as compactCurrency, formatCurrency as currency, roundCurrencyAmount } from "../../utils/currency";
import { resolveBackendImageUrl } from "../../Components/Home/productDisplay";

const EMPTY_CUSTOMER = { name: "", phone: "", email: "", address: "" };
const PAYMENT_METHOD_OPTIONS = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Other"];
const EMPTY_PRODUCT = {
  product_id: "",
  product_name: "",
  category: "",
  purity: "",
  gross_weight: null,
  net_gold_weight: null,
  making_charge_type: "",
  making_charge: null,
  rate_per_gram: null,
  rate_unit: "gram",
  quantity: 1,
  price: ""
};
const EMPTY_EXCHANGE = { product_name: "", category: "", category_is_other: false, metal_type: "Gold", purity: "22K", weight: "", wastage_weight: "" };
const PURITY_LABELS = { "999": "24K", "916": "22K", "833": "20K", "750": "18K", "585": "14K" };
const inputClass = "mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#008577] focus:ring-2 focus:ring-emerald-100";
const labelClass = "block text-xs font-semibold text-slate-600";

function decodeArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getProductImage(product) {
  const rawImages = product.images;
  const images = Array.isArray(rawImages) ? rawImages : decodeArray(rawImages);
  const image = images.find((value) => typeof value === "string" && value.trim())
    || (typeof rawImages === "string" && !rawImages.trim().startsWith("[") ? rawImages : "");
  if (!image) return "";
  return resolveBackendImageUrl(image);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatWeight(value, unit = "") {
  if (value == null || value === "") return "—";
  const formatted = Number(value).toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatMakingCharge(product) {
  if (product.making_charge == null || product.making_charge === "") return "—";
  const value = Number(product.making_charge);
  if (!Number.isFinite(value)) return "—";
  return product.making_charge_type === "Percentage" ? `${value}%` : currency(value);
}

function resolveProductDetails(product, metalRates, activeRateSet) {
  const metalType = product.metal_type || "Gold";
  const rate = findItemRate(metalRates, metalType, product.purity);
  const storedMakingCharge = Number(product.making_charge);
  const defaultMakingCharge = Number(rate?.making_charge_value ?? activeRateSet?.making_charge_value);
  const useRateMakingCharge = (!Number.isFinite(storedMakingCharge) || storedMakingCharge === 0)
    && Number.isFinite(defaultMakingCharge)
    && defaultMakingCharge > 0;
  const storedRate = Number(product.rate_per_gram);
  const activeRate = Number(rate?.rate_per_unit ?? rate?.rate_per_gram);
  return {
    ...product,
    making_charge_type: useRateMakingCharge
      ? rate?.making_charge_type || activeRateSet?.making_charge_type
      : product.making_charge_type || rate?.making_charge_type || activeRateSet?.making_charge_type || "",
    making_charge: useRateMakingCharge ? defaultMakingCharge : product.making_charge,
    rate_per_gram: Number.isFinite(storedRate) && storedRate > 0
      ? storedRate
      : Number.isFinite(activeRate) && activeRate > 0 ? activeRate : null,
    rate_unit: Number.isFinite(storedRate) && storedRate > 0
      ? product.rate_unit || "gram"
      : rate?.rate_unit || product.rate_unit || "gram"
  };
}

function getTackOrderPrefill(order) {
  if (!order) return null;
  const customer = order.customer || {};
  const addressText = customer.address || "";
  const locationParts = [...new Set([customer.city, customer.district, customer.state, customer.pincode].filter(Boolean))];
  const missingLocationParts = locationParts.filter(
    (part) => !addressText.toLowerCase().includes(String(part).toLowerCase())
  );
  const address = [addressText, missingLocationParts.join(", ")].filter(Boolean).join(", ");
  return {
    sourceId: String(order.id),
    sourceNo: order.order_no || "",
    gstEnabled: Boolean(order.gst_included),
    gstRate: Number(order.gst_rate) || 0,
    gstAmount: Number(order.gst_amount) || 0,
    customers: [{
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address
    }],
    products: (Array.isArray(order.items) ? order.items : []).map((item) => ({
      ...EMPTY_PRODUCT,
      product_id: String(item.product_id || ""),
      product_name: item.product_name || "Product",
      category: item.category || "Tack Order",
      purity: item.purity || "",
      net_gold_weight: item.net_gold_weight ?? null,
      quantity: Number(item.quantity) || 1,
      price: String(item.price ?? 0)
    })),
    discount: Number(order.discount_amount) > 0 ? String(order.discount_amount) : "",
    advanceAmount: String(Number(order.advance_amount) || 0)
  };
}

function TextField({ label, value, onChange, type = "text", required = false, placeholder = "", min, step, readOnly = false }) {
  return (
    <label className={labelClass}>
      {label}{required && <span className="ml-1 text-rose-500">*</span>}
      <input
        className={inputClass}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        min={min}
        step={step}
        readOnly={readOnly}
      />
    </label>
  );
}

function findItemRate(metalRates, metalType, purity) {
  const normalizedMetal = String(metalType || "").toLowerCase();
  const purityText = String(purity || "").toLowerCase();
  const normalizedPurity = purityText.match(/\d{3}/)?.[0]
    || ({ "24k": "999", "22k": "916", "20k": "833", "18k": "750", "14k": "585" })[purityText.match(/\d{2}k/)?.[0]];
  return metalRates.find((rate) => (
    String(rate.metal_type).toLowerCase() === normalizedMetal
    && String(rate.purity).toLowerCase() === String(normalizedPurity || purityText).toLowerCase()
  ));
}

function ItemFields({ item, onChange, onCategorySelect, onMetalSelect, categories, metalRates, exchange = false }) {
  const selectedMetalRates = exchange
    ? metalRates.filter((rate) => rate.metal_type.toLowerCase() === item.metal_type.toLowerCase())
    : [];
  const purityLabel = (purity) => item.metal_type === "Gold"
    ? PURITY_LABELS[purity] || purity
    : purity;
  const purityOptions = exchange
    ? [...new Set(selectedMetalRates.map((rate) => purityLabel(rate.purity)))]
    : ["24K", "22K", "18K"];
  const selectedMetalRate = selectedMetalRates.find((rate) => (
    purityLabel(rate.purity).toLowerCase() === item.purity.toLowerCase()
  ));
  const weightUnit = selectedMetalRate?.rate_unit === "carat" ? "carat" : "g";
  const rateUnit = selectedMetalRate?.rate_unit || "gram";
  const dailyRate = Number(selectedMetalRate?.rate_per_unit ?? selectedMetalRate?.rate_per_gram) || 0;
  const enteredRate = item.rate_per_unit === "" || item.rate_per_unit == null
    ? dailyRate
    : Number(item.rate_per_unit) || 0;
  const weight = Math.round((Number(item.weight) || 0) * 1000) / 1000;
  const wastageWeight = Math.round((Number(item.wastage_weight) || 0) * 1000) / 1000;
  const netWeight = Math.round(Math.max(0, weight - wastageWeight) * 1000) / 1000;
  const exchangeAmount = Math.round(netWeight * enteredRate * 100) / 100;

  return (
    <div className={`grid gap-3 md:grid-cols-2 ${exchange ? "xl:grid-cols-4" : "xl:grid-cols-4"}`}>
      {!exchange && <TextField label="Product Name" value={item.product_name} onChange={(value) => onChange("product_name", value)} required placeholder="Enter product name" />}
      {exchange ? (
        <div>
          <label className={labelClass}>
            Category<span className="ml-1 text-rose-500">*</span>
            <CustomSelect
              className={inputClass}
              value={item.category_is_other ? "__other__" : item.category}
              onChange={(event) => {
                const isOther = event.target.value === "__other__";
                onCategorySelect(event.target.value, isOther);
              }}
              required={!item.category_is_other}
            >
              <option value="">Choose category</option>
              {categories.map((category) => <option key={category.id || category.name} value={category.name}>{category.name}</option>)}
              <option value="__other__">Other</option>
            </CustomSelect>
          </label>
          {item.category_is_other && (
            <input
              className={inputClass}
              value={item.category}
              onChange={(event) => onChange("category", event.target.value)}
              required
              maxLength={100}
              placeholder="Enter category"
              aria-label="Enter other category"
            />
          )}
        </div>
      ) : (
        <TextField label="Category" value={item.category} onChange={(value) => onChange("category", value)} required placeholder="e.g. Necklace" />
      )}
      {exchange && (
        <label className={labelClass}>
          Metal Type<span className="ml-1 text-rose-500">*</span>
          <CustomSelect
            className={inputClass}
            value={item.metal_type}
            onChange={(event) => {
              const selectedRates = metalRates.filter((rate) => rate.metal_type === event.target.value);
              const firstRate = selectedRates[0];
              const nextPurity = firstRate
                ? event.target.value === "Gold" ? PURITY_LABELS[firstRate.purity] || firstRate.purity : firstRate.purity
                : "";
              onMetalSelect(event.target.value, nextPurity);
            }}
            required
          >
            {[...new Set(metalRates.map((rate) => rate.metal_type))].map((metalType) => (
              <option key={metalType} value={metalType}>{metalType}</option>
            ))}
          </CustomSelect>
        </label>
      )}
      <label className={labelClass}>
        {item.metal_type || "Gold"} Purity<span className="ml-1 text-rose-500">*</span>
        <CustomSelect className={inputClass} value={item.purity} onChange={(event) => {
          onChange("purity", event.target.value);
          if (exchange) onChange("rate_per_unit", "");
        }} required disabled={exchange && purityOptions.length === 0}>
          {purityOptions.length === 0 && <option value="">No active purity rates</option>}
          {purityOptions.map((purity) => <option key={purity}>{purity}</option>)}
        </CustomSelect>
      </label>
      {exchange ? (
        <>
          <TextField label={`${item.metal_type || "Gold"} Weight (${weightUnit})`} type="number" value={item.weight} onChange={(value) => onChange("weight", value)} required min="0" step="0.001" placeholder="Enter weight" />
          <TextField label={`${item.metal_type || "Gold"} Wastage Weight (${weightUnit})`} type="number" value={item.wastage_weight} onChange={(value) => onChange("wastage_weight", value)} min="0" step="0.001" placeholder="0.000" />
          <TextField label={`Net Weight (${weightUnit})`} type="number" value={weight > 0 ? netWeight.toFixed(3) : ""} onChange={() => {}} readOnly placeholder="Calculated weight" />
          <TextField label={`Rate (₹ / ${rateUnit})`} type="number" value={item.rate_per_unit === "" || item.rate_per_unit == null ? dailyRate || "" : item.rate_per_unit} onChange={(value) => onChange("rate_per_unit", value)} required min="0.01" step="0.01" placeholder="Enter rate" />
          <TextField label="Exchange Amount (₹)" type="number" value={weight > 0 && enteredRate > 0 ? exchangeAmount.toFixed(2) : ""} onChange={() => {}} readOnly placeholder="Calculated from rate" />
        </>
      ) : (
        <TextField label="Unit Price (₹)" type="number" value={item.price} onChange={(value) => onChange("price", value)} required min="0" step="0.01" placeholder="0.00" />
      )}
    </div>
  );
}

function CatalogProductOption({ product, selected, onClick }) {
  const image = getProductImage(product);
  const price = Number(product.final_selling_price) > 0
    ? Number(product.final_selling_price)
    : Number(product.offer_price) > 0
      ? Number(product.offer_price)
      : Number(product.mrp || 0);

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-emerald-50 ${selected ? "bg-emerald-50 text-[#00695C]" : "text-slate-700"}`}
    >
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-300">
        <FiImage size={18} aria-hidden="true" />
        {image && (
          <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={(event) => { event.currentTarget.style.display = "none"; }}
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{product.name}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">
          {product.category || "Uncategorized"} · {product.purity || "Purity not set"}
        </span>
        <span className="mt-0.5 block text-xs font-semibold text-[#00695C]">{currency(price)}</span>
      </span>
    </button>
  );
}

function CatalogProductFields({ product, catalogProducts, loading, onSelect, selectionId }) {
  const [selectionMode, setSelectionMode] = useState("select");
  const [searchTerm, setSearchTerm] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const selectedProduct = catalogProducts.find(
    (catalogProduct) => String(catalogProduct.id) === product.product_id
  );
  const filteredProducts = catalogProducts.filter((catalogProduct) =>
    [catalogProduct.name, catalogProduct.category, catalogProduct.purity, catalogProduct.product_code]
      .some((value) => String(value || "").toLowerCase().includes(searchTerm.trim().toLowerCase()))
  );

  return (
    <div className="min-w-[280px] space-y-2">
      <div>
        <span className={labelClass}>
          Choose Existing Product<span className="ml-1 text-rose-500">*</span>
        </span>
        <div className="mt-2 flex w-full rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Product selection method">
          {[
            { value: "select", label: "Select" },
            { value: "search", label: "Search" }
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectionMode(option.value)}
              aria-pressed={selectionMode === option.value}
              className={`flex-1 rounded-md px-4 py-2 text-xs font-semibold transition ${selectionMode === option.value ? "bg-[#00695C] text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {selectionMode === "select" ? (
        <div>
          <span className={labelClass}>Select from catalog</span>
          <button
            type="button"
            className={`${inputClass} flex items-center gap-3 text-left`}
            aria-haspopup="listbox"
            aria-expanded={catalogOpen}
            aria-controls={`catalog-options-${selectionId}`}
            disabled={loading}
            onClick={() => setCatalogOpen((open) => !open)}
          >
            {selectedProduct ? (
              <>
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-slate-300">
                  <FiImage size={16} aria-hidden="true" />
                  {getProductImage(selectedProduct) && (
                    <img
                      src={getProductImage(selectedProduct)}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(event) => { event.currentTarget.style.display = "none"; }}
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{selectedProduct.name}</span>
                  <span className="block truncate text-xs font-normal text-slate-500">
                    {selectedProduct.category || "Uncategorized"} · {selectedProduct.purity || "Purity not set"}
                  </span>
                </span>
              </>
            ) : (
              <span className="min-w-0 flex-1 font-normal text-slate-500">
                {loading ? "Loading products..." : "Choose a catalog product"}
              </span>
            )}
            <FiChevronDown className={`shrink-0 transition-transform ${catalogOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {catalogOpen && (
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              <label className="relative block border-b border-slate-100 p-2">
                <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <span className="sr-only">Search catalog products</span>
                <input
                  className={`${inputClass} mt-0 pl-9`}
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search products..."
                  autoComplete="off"
                />
              </label>
              <div id={`catalog-options-${selectionId}`} className="max-h-64 overflow-y-auto" role="listbox" aria-label="Catalog products">
                {filteredProducts.length > 0 ? filteredProducts.map((catalogProduct) => (
                  <CatalogProductOption
                    key={catalogProduct.id}
                    product={catalogProduct}
                    selected={String(catalogProduct.id) === product.product_id}
                    onClick={() => {
                      onSelect(String(catalogProduct.id));
                      setSearchTerm("");
                      setCatalogOpen(false);
                    }}
                  />
                )) : (
                  <p className="px-3 py-4 text-sm text-slate-500" role="status">
                    {loading ? "Loading products..." : "No catalog products found."}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className={labelClass} htmlFor={`product-search-${selectionId}`}>
            Search catalog
            <span className="relative block">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id={`product-search-${selectionId}`}
                className={`${inputClass} pl-9`}
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                disabled={loading}
                placeholder={loading ? "Loading products..." : "Search by name, category, purity, or SKU"}
                autoComplete="off"
              />
            </span>
          </label>
          {searchTerm.trim() && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm" role="listbox" aria-label="Matching catalog products">
              {filteredProducts.length > 0 ? filteredProducts.map((catalogProduct) => (
                <CatalogProductOption
                  key={catalogProduct.id}
                  product={catalogProduct}
                  selected={String(catalogProduct.id) === product.product_id}
                  onClick={() => {
                    onSelect(String(catalogProduct.id));
                    setSearchTerm("");
                  }}
                />
              )) : (
                <p className="px-3 py-3 text-sm text-slate-500" role="status">No matching catalog products.</p>
              )}
            </div>
          )}
          {!searchTerm.trim() && product.product_id && (
            <p className="mt-2 text-xs text-slate-500">
              Selected: {product.product_name}. Search above to choose a different product.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function BillingManagement() {
  const location = useLocation();
  const navigate = useNavigate();
  const tackOrderPrefill = getTackOrderPrefill(location.state?.tackOrderToBill);
  const [bills, setBills] = useState([]);
  const [dateRange, setDateRange] = useState({ preset: "all", startDate: "", endDate: "" });
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const { current: currentGoldRates } = useGoldRates();
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogProductDetails, setCatalogProductDetails] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(() => Boolean(tackOrderPrefill)
    || new URLSearchParams(window.location.search).get("new") === "1");
  const [editingBillId, setEditingBillId] = useState(null);
  const [tackOrderSourceId, setTackOrderSourceId] = useState(tackOrderPrefill?.sourceId || null);
  const [tackOrderSourceNo, setTackOrderSourceNo] = useState(tackOrderPrefill?.sourceNo || "");
  const [tackOrderAdvanceAmount, setTackOrderAdvanceAmount] = useState(tackOrderPrefill?.advanceAmount || "0");
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState("Other");
  const [cashCollectedAmount, setCashCollectedAmount] = useState("0");
  const [cashCollectedManuallyEdited, setCashCollectedManuallyEdited] = useState(false);
  const [cashCollectionMethod, setCashCollectionMethod] = useState("Cash");
  const [viewingBill, setViewingBill] = useState(null);
  const [billSearch, setBillSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [billView, setBillView] = useState("list");
  const [todayKey] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [customers, setCustomers] = useState(() => tackOrderPrefill?.customers || [{ ...EMPTY_CUSTOMER }]);
  const [products, setProducts] = useState(() => tackOrderPrefill?.products || []);
  const [productToAdd, setProductToAdd] = useState({ ...EMPTY_PRODUCT });
  const [gstRateInput, setGstRateInput] = useState(() => (
    tackOrderPrefill?.gstEnabled ? String(tackOrderPrefill.gstRate) : "0"
  ));
  const [taxMode, setTaxMode] = useState("Tax Exclusive");
  const [discountInput, setDiscountInput] = useState(tackOrderPrefill?.discount || "");
  const [exchanges, setExchanges] = useState([]);
  const [paymentType, setPaymentType] = useState("FULL_PAYMENT");
  const metalRates = useMemo(
    () => currentGoldRates?.rates || [],
    [currentGoldRates]
  );
  const getProductWithCatalogDetails = (product) => {
    const catalogProduct = catalogProductDetails.find(
      (item) => String(item.id) === String(product.product_id)
    );
    const useCatalogMakingCharge = !(Number(product.making_charge) > 0)
      && Number(catalogProduct?.making_charge) > 0;
    const catalogRate = Number(catalogProduct?.gold_rate_per_gram);
    return resolveProductDetails({
      ...product,
      images: product.images ?? catalogProduct?.images,
      metal_type: product.metal_type || catalogProduct?.metal_type,
      gross_weight: product.gross_weight ?? catalogProduct?.gross_weight,
      net_gold_weight: product.net_gold_weight ?? catalogProduct?.net_gold_weight,
      making_charge_type: useCatalogMakingCharge
        ? catalogProduct.making_charge_type
        : product.making_charge_type || catalogProduct?.making_charge_type,
      making_charge: useCatalogMakingCharge
        ? catalogProduct.making_charge
        : product.making_charge ?? catalogProduct?.making_charge,
      rate_per_gram: Number(product.rate_per_gram) > 0
        ? product.rate_per_gram
        : Number.isFinite(catalogRate) && catalogRate > 0
          ? catalogRate
          : product.rate_per_gram ?? catalogProduct?.gold_rate_per_gram,
      rate_unit: product.rate_unit || catalogProduct?.rate_unit
    }, metalRates, currentGoldRates);
  };

  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/billings", {
        params: { startDate: dateRange.startDate, endDate: dateRange.endDate }
      });
      if (!Array.isArray(response.data)) throw new Error("The server returned an invalid bills list.");
      setBills(response.data);
    } catch (error) {
      console.error("Failed to load bills:", error);
      toast.error(error.response?.data?.message || error.message || "Could not load bills.");
    } finally {
      setLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  const loadCatalogProducts = useCallback(async () => {
    setCatalogLoading(true);
    try {
      let page = 1;
      let totalPages = 1;
      const productsFromCatalog = [];
      do {
        const response = await api.get("/products/mine", {
          params: { page, limit: 100 }
        });
        if (!Array.isArray(response.data?.products)) {
          throw new Error("The server returned an invalid product catalog.");
        }
        productsFromCatalog.push(...response.data.products);
        totalPages = Math.max(1, Number(response.data.pagination?.totalPages) || 1);
        page += 1;
      } while (page <= totalPages);
      setCatalogProductDetails(productsFromCatalog);
      setCatalogProducts(productsFromCatalog.filter((product) => product.status === "Active"));
    } catch (error) {
      console.error("Failed to load billing product catalog:", error);
      toast.error(error.response?.data?.message || error.message || "Could not load catalog products.");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => { loadBills(); }, [loadBills]);
  useEffect(() => { loadCatalogProducts(); }, [loadCatalogProducts]);
  useEffect(() => {
    const tackOrderId = tackOrderPrefill?.sourceId;
    if (!tackOrderId || loading) return;
    const linkedBill = bills.find((bill) => Number(bill.source_tack_order_id) === Number(tackOrderId));
    if (linkedBill) setViewingBill(linkedBill);
  }, [bills, loading, tackOrderPrefill?.sourceId]);
  useEffect(() => {
    if (location.state?.tackOrderToBill) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);
  useEffect(() => {
    let active = true;
    api.get("/categories")
      .then((response) => {
        if (!Array.isArray(response.data)) throw new Error("The server returned an invalid category list.");
        if (active) setCategories(response.data.filter((category) => category.status === "Active"));
      })
      .catch((error) => {
        console.error("Failed to load exchange item categories:", error);
        toast.error(error.response?.data?.message || error.message || "Could not load categories.");
      });
    return () => { active = false; };
  }, []);

  const subtotal = useMemo(
    () => products.reduce(
      (sum, product) => sum + (Number(product.price) || 0) * (Number(product.quantity) || 1),
      0
    ),
    [products]
  );
  const exchangeCredit = useMemo(
    () => paymentType === "EXCHANGE_GOLD"
      ? exchanges.reduce((sum, exchange) => {
        const rate = findItemRate(metalRates, exchange.metal_type, exchange.purity);
        const weight = Math.round((Number(exchange.weight) || 0) * 1000) / 1000;
        const wastageWeight = Math.round((Number(exchange.wastage_weight) || 0) * 1000) / 1000;
        const netWeight = Math.round(Math.max(0, weight - wastageWeight) * 1000) / 1000;
        const ratePerUnit = exchange.rate_per_unit === "" || exchange.rate_per_unit == null
          ? Number(rate?.rate_per_unit ?? rate?.rate_per_gram) || 0
          : Number(exchange.rate_per_unit) || 0;
        const credit = netWeight * ratePerUnit;
        return sum + (Number.isFinite(credit) ? Math.round(credit * 100) / 100 : 0);
      }, 0)
      : 0,
    [exchanges, metalRates, paymentType]
  );
  const discountAmount = discountInput.trim() === "" ? 0 : Number(discountInput);
  const validDiscount = Number.isFinite(discountAmount)
    && discountAmount >= 0
    && discountAmount <= subtotal
    && discountAmount + exchangeCredit <= subtotal;
  const parsedGstRate = gstRateInput.trim() === "" ? NaN : Number(gstRateInput);
  const gstRate = Number.isFinite(parsedGstRate) ? parsedGstRate : 0;
  const validGst = Number.isFinite(parsedGstRate) && gstRate >= 0 && gstRate <= 100;
  const taxableSubtotal = Math.max(0, subtotal - discountAmount - exchangeCredit);
  const calculatedGst = validGst && validDiscount && gstRate > 0
    ? taxMode === "Tax Inclusive"
      ? Math.round((taxableSubtotal * gstRate / (100 + gstRate)) * 100) / 100
      : Math.round(taxableSubtotal * gstRate) / 100
    : 0;
  const gst = calculatedGst;
  const total = roundCurrencyAmount(taxMode === "Tax Inclusive"
    ? taxableSubtotal
    : Math.round((taxableSubtotal + gst) * 100) / 100);
  const advanceAmount = tackOrderSourceId ? Number(tackOrderAdvanceAmount) || 0 : 0;
  const validAdvanceAmount = Number.isFinite(advanceAmount) && advanceAmount >= 0 && advanceAmount <= total;
  const maxCashCollected = Math.max(0, total - advanceAmount);
  const effectiveCashCollectedAmount = cashCollectedManuallyEdited
    ? cashCollectedAmount
    : String(maxCashCollected);
  const parsedCashCollected = Number(effectiveCashCollectedAmount);
  const validCashCollected = Number.isFinite(parsedCashCollected)
    && parsedCashCollected >= 0
    && parsedCashCollected <= maxCashCollected;
  const totalBilled = bills.reduce((sum, bill) => sum + (Number(bill.total_amount) || 0), 0);
  const todayBilled = bills.reduce((sum, bill) => {
    if (!bill.created_at || new Date(bill.created_at).toLocaleDateString("en-CA") !== todayKey) return sum;
    return sum + (Number(bill.total_amount) || 0);
  }, 0);
  const totalExchangeAmount = bills.reduce((sum, bill) => {
    if (bill.payment_type !== "EXCHANGE_GOLD") return sum;
    return sum + decodeArray(bill.exchanges).reduce((exchangeSum, exchange) => (
      exchangeSum + (Number(exchange.credit_amount) || 0)
    ), 0);
  }, 0);
  const fullPaymentAmount = bills.reduce((sum, bill) => (
    bill.payment_type === "FULL_PAYMENT" ? sum + (Number(bill.paid_amount) || 0) : sum
  ), 0);
  const visibleBills = useMemo(() => {
    const query = billSearch.trim().toLowerCase();
    return bills.filter((bill) => {
      if (paymentFilter !== "ALL" && bill.payment_type !== paymentFilter) return false;
      if (!query) return true;
      const searchableValues = [
        bill.invoice_no,
        ...decodeArray(bill.customers).flatMap((customer) => [customer.name, customer.phone, customer.email]),
        ...decodeArray(bill.products).flatMap((product) => [product.product_name, product.sku, product.category]),
        ...decodeArray(bill.exchanges).flatMap((exchange) => [exchange.product_name, exchange.category, exchange.metal_type, exchange.purity])
      ];
      return searchableValues.some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [bills, billSearch, paymentFilter]);

  const printBill = async (bill) => {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast.error("Allow pop-ups to print this bill.");
      return;
    }

    const billCustomers = decodeArray(bill.customers);
    const billProducts = decodeArray(bill.products).map(getProductWithCatalogDetails);
    const billExchanges = decodeArray(bill.exchanges);
    const lineItems = [
      ...billProducts.map((product) => ({
        name: product.product_name,
        category: product.category,
        purity: product.purity,
        makingCharge: formatMakingCharge(product),
        quantity: Number(product.quantity) || 1,
        weight: null,
        wastageWeight: null,
        netWeight: product.net_gold_weight,
        rate: product.rate_per_gram,
        rateUnit: product.rate_unit || "gram",
        amount: (Number(product.price) || 0) * (Number(product.quantity) || 1),
        isExchange: false
      })),
      ...billExchanges.map((exchange) => ({
        name: exchange.product_name || "Exchange item",
        category: exchange.category,
        purity: `${exchange.metal_type || ""} ${exchange.purity || ""}`.trim(),
        makingCharge: "—",
        quantity: 1,
        weight: exchange.weight,
        wastageWeight: exchange.wastage_weight,
        netWeight: exchange.net_weight,
        rate: exchange.rate_per_unit,
        rateUnit: exchange.rate_unit || "gram",
        amount: -(Number(exchange.credit_amount) || 0),
        isExchange: true
      }))
    ];
    const rows = lineItems.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td class="${item.isExchange ? "exchange" : ""}">${escapeHtml(item.name || "—")}</td>
        <td>${item.quantity}</td>
        <td>${escapeHtml(item.category || "—")}</td>
        <td>${escapeHtml(item.purity || "—")}</td>
        <td>${escapeHtml(item.makingCharge)}</td>
        <td>${item.isExchange ? formatWeight(item.weight, item.rateUnit === "carat" ? "carat" : "g") : "—"}</td>
        <td>${item.isExchange ? formatWeight(item.wastageWeight, item.rateUnit === "carat" ? "carat" : "g") : "—"}</td>
        <td>${item.isExchange ? formatWeight(item.netWeight, item.rateUnit === "carat" ? "carat" : "g") : "—"}</td>
        <td class="amount">${item.rate == null || item.rate === "" ? "—" : `${currency(item.rate)} / ${escapeHtml(item.rateUnit)}`}</td>
        <td class="amount ${item.isExchange ? "exchange" : ""}">${item.isExchange ? "−" : ""}${currency(Math.abs(item.amount))}</td>
      </tr>
    `).join("");
    const customerDetails = billCustomers.map((customer) => `
      <div class="customer">
        <strong>${escapeHtml(customer.name || "Customer")}</strong>
        ${customer.phone ? `<div>${escapeHtml(customer.phone)}</div>` : ""}
        ${customer.email ? `<div>${escapeHtml(customer.email)}</div>` : ""}
        ${customer.address ? `<div>${escapeHtml(customer.address)}</div>` : ""}
      </div>
    `).join("");
    const exchangeTotal = billExchanges.reduce((sum, item) => sum + (Number(item.credit_amount) || 0), 0);
    const date = bill.created_at ? new Date(bill.created_at).toLocaleDateString("en-IN") : "—";
    let receiptSettings;
    try {
      receiptSettings = await getReceiptSettings();
    } catch (error) {
      printWindow.close();
      console.error("Failed to load receipt settings for printing:", error);
      toast.error(error.response?.data?.message || "Could not load receipt settings.");
      return;
    }
    let logoUrl = "";
    if (receiptSettings.logoUrl) {
      try {
        if (/^data:image\/(?:png|jpeg|webp);base64,/i.test(receiptSettings.logoUrl)) {
          logoUrl = receiptSettings.logoUrl;
        } else {
          const parsedLogoUrl = new URL(receiptSettings.logoUrl, window.location.origin);
          if (!["http:", "https:"].includes(parsedLogoUrl.protocol)) {
            throw new Error("Logo URL must use HTTP or HTTPS.");
          }
          logoUrl = parsedLogoUrl.href;
        }
      } catch (error) {
        toast.error("Receipt logo URL is invalid.");
        console.error("Invalid receipt logo URL:", error);
        printWindow.close();
        return;
      }
    }
    const shopName = escapeHtml(receiptSettings.shopName);
    const shopAddress = escapeHtml(receiptSettings.address);
    const shopGstNumber = escapeHtml(receiptSettings.gstNumber);
    const footerMessage = escapeHtml(receiptSettings.footerMessage);

    try {
      printWindow.document.open();
      printWindow.document.write(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Bill ${escapeHtml(bill.invoice_no)}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 36px; color: #1e293b; font: 14px Arial, sans-serif; }
            header { display: flex; flex-direction: column; align-items: center; gap: 12px; padding-bottom: 12px; text-align: center; }
            .brand { display: flex; flex-direction: column; align-items: center; gap: 6px; }
            .logo { display: block; width: 96px; height: 76px; object-fit: contain; }
            h1 { margin: 0 0 6px; color: #00695c; font-size: 26px; }
            .address { max-width: 620px; color: #475569; line-height: 1.5; }
            .invoice-meta { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 12px 0; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #00695c; }
            .invoice-meta-right { text-align: right; }
            h2 { margin: 24px 0 10px; font-size: 16px; }
            p { margin: 4px 0; }
            .customers { display: flex; flex-wrap: wrap; gap: 20px; }
            .customer { min-width: 200px; line-height: 1.6; }
            table { width: 100%; margin-top: 12px; border-collapse: collapse; }
            th, td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; }
            th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; }
            .amount { text-align: right; white-space: nowrap; }
            .exchange { color: #be123c; font-weight: 600; }
            th.amount { text-align: right; }
            .totals { width: min(100%, 340px); margin: 20px 0 0 auto; }
            .total-row { display: flex; justify-content: space-between; gap: 20px; padding: 6px 0; }
            .grand-total { margin-top: 6px; padding-top: 12px; border-top: 2px solid #cbd5e1; font-size: 18px; font-weight: 700; }
            footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #cbd5e1; color: #475569; text-align: center; line-height: 1.6; }
            footer strong { display: block; margin-bottom: 4px; color: #00695c; font-size: 15px; }
            footer .thanks { color: #1e293b; font-weight: 600; }
            @page { margin: 0; }
            @media print { body { padding: 12mm; } }
          </style>
        </head>
        <body>
          <header>
            <div class="brand">
              ${logoUrl ? `<img id="shop-logo" class="logo" src="${escapeHtml(logoUrl)}" alt="${shopName} logo" />` : ""}
              <div>
                <h1>${shopName}</h1>
                ${shopAddress ? `<p class="address">${shopAddress}</p>` : ""}
                ${shopGstNumber ? `<p class="address"><strong>GSTIN:</strong> ${shopGstNumber}</p>` : ""}
              </div>
            </div>
          </header>
          <div class="invoice-meta">
            <p>Invoice No: <strong>${escapeHtml(bill.invoice_no || "—")}</strong></p>
            <div class="invoice-meta-right">
              <p>Date: ${escapeHtml(date)}</p>
              <p>Payment: ${bill.payment_type === "EXCHANGE_GOLD" ? "Exchange Gold" : "Full Payment"}</p>
            </div>
          </div>
          <h2>Customer${billCustomers.length === 1 ? "" : "s"}</h2>
          <div class="customers">${customerDetails || "<p>No customer details</p>"}</div>
          <h2>Items</h2>
          <table>
            <thead><tr><th>S.No.</th><th>Item</th><th>Qty</th><th>Category</th><th>Purity</th><th>Making Charge</th><th>Weight</th><th>Wastage</th><th>Net Weight</th><th class="amount">Rate</th><th class="amount">Amount</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="11">No items</td></tr>'}</tbody>
          </table>
          <div class="totals">
            <div class="total-row"><span>Sub-Total</span><span>${currency(bill.sub_total)}</span></div>
            ${Number(bill.discount_amount) > 0 ? `<div class="total-row"><span>Discount</span><span>−${currency(bill.discount_amount)}</span></div>` : ""}
            ${exchangeTotal > 0 ? `<div class="total-row"><span>Exchange Amount</span><span>−${currency(exchangeTotal)}</span></div>` : ""}
            <div class="total-row"><span>GST (${escapeHtml(Number(bill.gst_rate || 0))}%, ${escapeHtml(bill.tax_mode || "Tax Exclusive")})</span><span>${currency(bill.gst_amount)}</span></div>
            <div class="total-row grand-total"><span>Total</span><span>${currency(bill.total_amount)}</span></div>
          </div>
          <footer>
            ${footerMessage ? `<div class="thanks">${footerMessage}</div>` : ""}
          </footer>
        </body>
      </html>`);
      printWindow.document.close();
      printWindow.focus();
      let printStarted = false;
      const startPrint = () => {
        if (printStarted || printWindow.closed) return;
        printStarted = true;
        printWindow.focus();
        printWindow.print();
      };
      const logo = printWindow.document.getElementById("shop-logo");
      if (!logo || logo.complete) startPrint();
      else {
        logo?.addEventListener("load", startPrint, { once: true });
        logo?.addEventListener("error", startPrint, { once: true });
        printWindow.setTimeout(startPrint, 1000);
      }
    } catch (error) {
      printWindow.close();
      console.error("Failed to open bill print dialog:", error);
      toast.error("Could not open the print dialog. Please try again.");
    }
  };

  const resetForm = () => {
    setEditingBillId(null);
    setTackOrderSourceId(null);
    setTackOrderSourceNo("");
    setTackOrderAdvanceAmount("0");
    setAdvancePaymentMethod("Other");
    setCashCollectedAmount("0");
    setCashCollectedManuallyEdited(false);
    setCashCollectionMethod("Cash");
    setCustomers([{ ...EMPTY_CUSTOMER }]);
    setProducts([]);
    setProductToAdd({ ...EMPTY_PRODUCT });
    setDiscountInput("");
    setGstRateInput("0");
    setTaxMode("Tax Exclusive");
    setExchanges([]);
    setPaymentType("FULL_PAYMENT");
  };

  const editBill = (bill) => {
    const billCustomers = decodeArray(bill.customers);
    const billProducts = decodeArray(bill.products);
    const billExchanges = decodeArray(bill.exchanges);
    setEditingBillId(bill.id);
    setCustomers(billCustomers.length ? billCustomers : [{ ...EMPTY_CUSTOMER }]);
    setProducts(billProducts.map((product) => ({
      ...product,
      product_id: String(product.product_id || ""),
      quantity: Number(product.quantity) || 1
    })));
    setTackOrderSourceId(null);
    setTackOrderSourceNo("");
    setTackOrderAdvanceAmount("0");
    setAdvancePaymentMethod("Other");
    setCashCollectedAmount("0");
    setCashCollectedManuallyEdited(false);
    setCashCollectionMethod("Cash");
    setProductToAdd({ ...EMPTY_PRODUCT });
    setExchanges(billExchanges.map((exchange) => ({
      ...EMPTY_EXCHANGE,
      ...exchange,
      category_is_other: !categories.some((category) => category.name === exchange.category),
      weight: String(exchange.weight ?? ""),
      wastage_weight: String(exchange.wastage_weight ?? ""),
      rate_per_unit: String(exchange.rate_per_unit ?? "")
    })));
    setPaymentType(bill.payment_type);
    setDiscountInput(Number(bill.discount_amount) ? String(bill.discount_amount) : "");
    setGstRateInput(String(Number(bill.gst_rate) || 0));
    setTaxMode(bill.tax_mode === "Tax Inclusive" ? "Tax Inclusive" : "Tax Exclusive");
    setShowForm(true);
  };

  const deleteBill = async (bill) => {
    if (Number(bill.payment_count) > 0 || Number(bill.paid_amount) > 0) {
      toast.error("This bill has payment history and cannot be deleted.");
      return;
    }
    if (!window.confirm(`Delete bill ${bill.invoice_no}? This cannot be undone.`)) return;
    try {
      await api.delete(`/billings/${bill.id}`);
      toast.success("Bill deleted.");
      await loadBills();
    } catch (error) {
      console.error("Failed to delete bill:", error);
      toast.error(error.response?.data?.message || "Could not delete bill.");
    }
  };

  const updateRow = (setter, rows, index, field, value) => {
    setter(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };

  const selectCatalogProduct = (productId) => {
    const selected = catalogProducts.find((item) => String(item.id) === productId);
    if (!selected) {
      setProductToAdd({ ...EMPTY_PRODUCT });
      return;
    }
    const price = Number(selected.final_selling_price) > 0
      ? Number(selected.final_selling_price)
      : Number(selected.offer_price) > 0
        ? Number(selected.offer_price)
        : Number(selected.mrp || 0);
    setProductToAdd(resolveProductDetails({
      product_id: String(selected.id),
      product_name: selected.name,
      category: selected.category,
      purity: selected.purity || "",
      metal_type: selected.metal_type || "Gold",
      gross_weight: selected.gross_weight ?? null,
      net_gold_weight: selected.net_gold_weight ?? null,
      making_charge_type: selected.making_charge_type || "",
      making_charge: selected.making_charge ?? null,
      rate_per_gram: selected.gold_rate_per_gram ?? null,
      rate_unit: selected.rate_unit || "gram",
      quantity: 1,
      price
    }, metalRates, currentGoldRates));
  };

  const addSelectedProduct = () => {
    if (!productToAdd.product_id) {
      toast.error("Choose a catalog product before adding it.");
      return;
    }
    setProducts((rows) => [...rows, productToAdd]);
    setProductToAdd({ ...EMPTY_PRODUCT });
  };

  const saveBill = async (event) => {
    event.preventDefault();
    if (products.length === 0) {
      toast.error("Add at least one product.");
      return;
    }
    if (products.some((product) => !product.product_id)) {
      toast.error("Select a catalog product for each product row.");
      return;
    }
    if (paymentType === "EXCHANGE_GOLD" && exchanges.length === 0) {
      toast.error("Add at least one exchange item.");
      return;
    }
    if (paymentType === "EXCHANGE_GOLD" && exchanges.some((exchange) => (
      !Number.isFinite(Number(exchange.weight))
      || Number(exchange.weight) <= 0
      || !Number.isFinite(Number(exchange.wastage_weight || 0))
      || Number(exchange.wastage_weight || 0) < 0
      || Number(exchange.wastage_weight || 0) > Number(exchange.weight)
    ))) {
      toast.error("Enter a valid weight and wastage weight for each exchange item.");
      return;
    }
    if (paymentType === "EXCHANGE_GOLD" && exchanges.some((exchange) => {
      const currentRate = findItemRate(metalRates, exchange.metal_type, exchange.purity);
      const rate = exchange.rate_per_unit === "" || exchange.rate_per_unit == null
        ? Number(currentRate?.rate_per_unit ?? currentRate?.rate_per_gram)
        : Number(exchange.rate_per_unit);
      return !Number.isFinite(rate) || rate <= 0;
    })) {
      toast.error("Enter a valid rate for each exchange item.");
      return;
    }
    if (exchangeCredit > subtotal) {
      toast.error("Exchange amount cannot exceed the purchased products subtotal.");
      return;
    }
    const advanceAmount = tackOrderSourceId ? Number(tackOrderAdvanceAmount) || 0 : 0;
    const cashCollected = parsedCashCollected;
    if (!Number.isFinite(cashCollected) || cashCollected < 0) {
      toast.error("Enter a valid non-negative cash collected amount.");
      return;
    }
    if (!validAdvanceAmount) {
      toast.error("Tack order advance cannot exceed the bill total.");
      return;
    }
    if (advanceAmount + cashCollected > total) {
      toast.error("Tack order advance and cash collected cannot exceed the bill total.");
      return;
    }
    if (!validDiscount) {
      toast.error("Discount and exchange credit cannot exceed the purchased products subtotal.");
      return;
    }
    if (!validGst) {
      toast.error("Enter a valid GST percentage between 0 and 100.");
      return;
    }
    setSaving(true);
    try {
      const billingPayload = {
        customers,
        products: products.map((product) => ({ product_id: Number(product.product_id) })),
        ...(tackOrderSourceId ? { tack_order_id: tackOrderSourceId } : {}),
        ...(tackOrderSourceId && Number(tackOrderAdvanceAmount) > 0
          ? { advance_payment_method: advancePaymentMethod || "Other" }
          : {}),
        ...(!editingBillId ? {
          cash_collected_amount: cashCollected,
          cash_collection_method: cashCollectionMethod
        } : {}),
        exchanges: paymentType === "EXCHANGE_GOLD"
          ? exchanges.map((exchange) => ({
            product_name: `${exchange.metal_type || "Gold"} ${exchange.purity || ""} exchange item`.trim(),
            category: exchange.category,
            metal_type: exchange.metal_type,
            purity: exchange.purity,
            weight: Number(exchange.weight),
            wastage_weight: Number(exchange.wastage_weight || 0),
            rate_per_unit: Number(exchange.rate_per_unit === "" || exchange.rate_per_unit == null
              ? findItemRate(metalRates, exchange.metal_type, exchange.purity)?.rate_per_unit
                ?? findItemRate(metalRates, exchange.metal_type, exchange.purity)?.rate_per_gram
              : exchange.rate_per_unit)
          }))
          : [],
        payment_type: paymentType,
        discount_amount: discountAmount,
        gst_rate: gstRate,
        tax_mode: taxMode
      };
      if (editingBillId) {
        await api.put(`/billings/${editingBillId}`, billingPayload);
        toast.success("Bill updated.");
      } else {
        const { data } = await api.post("/billings", billingPayload);
        toast.success(data.already_exists
          ? "This tack order already has a bill and is marked Completed."
          : tackOrderSourceId
            ? "Bill saved. Tack order marked Completed."
            : "Bill saved.");
      }
      resetForm();
      setShowForm(false);
      await loadBills();
    } catch (error) {
      console.error("Failed to save bill:", error);
      toast.error(error.response?.data?.message || "Could not save bill.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen space-y-5 bg-slate-50/70 py-1 text-slate-800">
      {!showForm ? (
        <>
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#063f36] via-[#075348] to-[#0b6b5b] px-5 py-5 text-white shadow-[0_14px_32px_rgba(6,63,54,0.18)] sm:px-7">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-200">Payments &amp; invoices</p>
              <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">Billing overview</h1>
              <p className="mt-1 text-xs text-white/70 sm:text-sm">Review invoices, track collections, and manage customer payments.</p>
            </div>
            <button type="button" onClick={() => setShowForm(true)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#075348] shadow-sm transition hover:bg-emerald-50">
              <FiPlus size={18} /> New bill
            </button>
          </header>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Billing totals">
            {[
              {
                label: "Total billed",
                value: totalBilled,
                detail: `${bills.length} invoice${bills.length === 1 ? "" : "s"} recorded`,
                icon: <FiDollarSign aria-hidden="true" />,
                accentStyle: "border-emerald-100 border-t-4 border-t-emerald-500 bg-gradient-to-br from-white to-emerald-50",
                iconStyle: "bg-emerald-700 text-white shadow-lg shadow-emerald-900/15",
                detailStyle: "text-emerald-700"
              },
              {
                label: "Today's billing",
                value: todayBilled,
                detail: "Invoices created today",
                icon: <FiCalendar aria-hidden="true" />,
                accentStyle: "border-sky-100 border-t-4 border-t-sky-500 bg-gradient-to-br from-white to-sky-50",
                iconStyle: "bg-sky-700 text-white shadow-lg shadow-sky-900/15",
                detailStyle: "text-sky-700"
              },
              {
                label: "Exchange credit",
                value: totalExchangeAmount,
                detail: "Gold exchange value",
                icon: <FiRepeat aria-hidden="true" />,
                accentStyle: "border-amber-100 border-t-4 border-t-amber-500 bg-gradient-to-br from-white to-amber-50",
                iconStyle: "bg-amber-500 text-white shadow-lg shadow-amber-900/15",
                detailStyle: "text-amber-700"
              },
              {
                label: "Full payment collected",
                value: fullPaymentAmount,
                detail: "From full-payment invoices",
                icon: <FiCreditCard aria-hidden="true" />,
                accentStyle: "border-rose-100 border-t-4 border-t-rose-500 bg-gradient-to-br from-white to-rose-50",
                iconStyle: "bg-rose-600 text-white shadow-lg shadow-rose-900/15",
                detailStyle: "text-rose-700"
              }
            ].map((card) => (
              <article
                key={card.label}
                className={`flex min-h-[148px] min-w-0 items-center justify-between gap-4 rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${card.accentStyle}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">{card.label}</p>
                  <p className="mt-2 truncate text-2xl font-black leading-tight text-slate-950" title={loading ? undefined : currency(card.value)}>
                    {loading ? "—" : compactCurrency(card.value)}
                  </p>
                  <div className={`mt-3 flex min-w-0 items-center gap-2 text-xs font-bold ${card.detailStyle}`}>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-current" />
                    <span className="truncate">{loading ? "Loading billing totals" : card.detail}</span>
                  </div>
                </div>
                <span className={`flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-2xl text-2xl ${card.iconStyle}`}>
                  {card.icon}
                </span>
              </article>
            ))}
          </section>
          <section aria-label="Search and filter bills" className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="relative min-w-[220px] flex-1 sm:max-w-[480px]">
              <FiSearch aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={billSearch}
                onChange={(event) => setBillSearch(event.target.value)}
                placeholder="Search bills by invoice, customer, phone..."
                aria-label="Search bills"
                className="h-[52px] w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-11 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#00695C] focus:ring-2 focus:ring-emerald-100"
              />
              {billSearch && (
                <button type="button" onClick={() => setBillSearch("")} aria-label="Clear bill search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700">
                  <FiX size={16} />
                </button>
              )}
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
              <DateRangeFilter onApply={setDateRange} controlClassName="h-[52px] min-w-[190px] px-4" />
              <CustomSelect
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value)}
                aria-label="Filter bills by payment type"
                className="h-[52px] min-w-[160px] rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm font-semibold text-slate-600 outline-none focus:border-[#00695C] focus:ring-2 focus:ring-emerald-100"
              >
                <option value="ALL">All Payment Types</option>
                <option value="FULL_PAYMENT">Full Payment</option>
                <option value="EXCHANGE_GOLD">Exchange Gold</option>
              </CustomSelect>
              <div role="group" aria-label="Bill view" className="flex h-[52px] items-center rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setBillView("list")}
                  aria-label="Show bills as a list"
                  aria-pressed={billView === "list"}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${billView === "list" ? "bg-[#004D40] text-white shadow-sm" : "text-slate-500 hover:bg-white"}`}
                >
                  <FiList size={19} />
                </button>
                <button
                  type="button"
                  onClick={() => setBillView("grid")}
                  aria-label="Show bills as cards"
                  aria-pressed={billView === "grid"}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${billView === "grid" ? "bg-[#004D40] text-white shadow-sm" : "text-slate-500 hover:bg-white"}`}
                >
                  <FiGrid size={18} />
                </button>
              </div>
            </div>
          </section>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-sm font-extrabold text-slate-800">Recent invoices</h2>
                <p className="mt-0.5 text-xs text-slate-500">{loading ? "Loading bills..." : `${visibleBills.length} invoice${visibleBills.length === 1 ? "" : "s"} found`}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                {visibleBills.length} {visibleBills.length === 1 ? "record" : "records"}
              </span>
            </header>
            {billView === "list" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead className="bg-gradient-to-r from-[#07564B] via-[#064A41] to-[#043D37] text-[10px] uppercase tracking-[0.12em] text-white">
                  <tr>
                    <th className="px-4 py-4 font-extrabold">S.No.</th>
                    <th className="px-4 py-4 font-extrabold">Invoice</th>
                    <th className="px-4 py-4 font-extrabold">Customer(s)</th>
                    <th className="px-4 py-4 font-extrabold">Items</th>
                    <th className="px-4 py-4 font-extrabold">Type</th>
                    <th className="px-4 py-4 font-extrabold">Date</th>
                    <th className="px-4 py-4 text-right font-extrabold">Total</th>
                    <th className="px-4 py-4 text-right font-extrabold">Paid / Due</th>
                    <th className="px-4 py-4 text-right font-extrabold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    Array.from({ length: 5 }, (_, index) => (
                      <tr key={`bill-loading-${index}`} aria-hidden="true">
                        {Array.from({ length: 9 }, (_, cellIndex) => (
                          <td key={cellIndex} className="px-4 py-5"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
                        ))}
                      </tr>
                    ))
                  ) : visibleBills.length === 0 ? (
                    <tr><td colSpan="9" className="px-4 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><FiFileText size={22} aria-hidden="true" /></span>
                        <p className="mt-3 text-sm font-bold text-slate-800">{bills.length === 0 ? "No bills yet" : "No matching bills"}</p>
                        <p className="mt-1 text-xs text-slate-500">{bills.length === 0 ? "Create your first invoice to see it here." : "Try another search or payment type."}</p>
                      </div>
                    </td></tr>
                  ) : visibleBills.map((bill, index) => {
                    const billCustomers = decodeArray(bill.customers);
                    const billProducts = decodeArray(bill.products);
                    return (
                      <tr key={bill.id} className="group text-sm transition-colors hover:bg-emerald-50/40">
                        <td className="px-4 py-4 text-xs font-semibold text-slate-400">{index + 1}</td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-[#00695C]">{bill.invoice_no}</p>
                          {bill.source_tack_order_id && <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Tack order</span>}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          <p className="font-semibold">{billCustomers.map((customer) => customer.name).join(", ") || "—"}</p>
                          {billCustomers[0]?.phone && <p className="mt-0.5 text-xs text-slate-400">{billCustomers[0].phone}</p>}
                        </td>
                        <td className="px-4 py-4 text-slate-600">{billProducts.length} item{billProducts.length === 1 ? "" : "s"}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${bill.payment_type === "EXCHANGE_GOLD" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}>
                            {bill.payment_type === "EXCHANGE_GOLD" ? "Exchange Gold" : "Full Payment"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">{bill.created_at ? new Date(bill.created_at).toLocaleDateString("en-IN") : "—"}</td>
                        <td className="px-4 py-4 text-right font-extrabold text-slate-900">{currency(bill.total_amount)}</td>
                        <td className="px-4 py-4 text-right">
                          <span className="block font-bold text-emerald-700">{currency(bill.paid_amount)}</span>
                          <span className={`mt-1 block text-xs font-medium ${Number(bill.balance_due) > 0 ? "text-rose-600" : "text-slate-400"}`}>Due {currency(bill.balance_due)}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-0.5">
                            <button type="button" onClick={() => setViewingBill(bill)} className="rounded-md p-2 text-sky-700 hover:bg-sky-50" aria-label={`View bill ${bill.invoice_no}`} title="View"><FiEye /></button>
                            <button type="button" onClick={() => printBill(bill)} className="rounded-md p-2 text-[#00695C] hover:bg-emerald-50" aria-label={`Print bill ${bill.invoice_no}`} title="Print"><FiPrinter /></button>
                            {Number(bill.paid_amount) === 0 && <button type="button" onClick={() => editBill(bill)} className="rounded-md p-2 text-amber-700 hover:bg-amber-50" aria-label={`Edit bill ${bill.invoice_no}`} title="Edit"><FiEdit2 /></button>}
                            <button type="button" onClick={() => deleteBill(bill)} disabled={Number(bill.payment_count) > 0 || Number(bill.paid_amount) > 0} className="rounded-md p-2 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label={Number(bill.payment_count) > 0 || Number(bill.paid_amount) > 0 ? `Cannot delete ${bill.invoice_no}; payment history exists` : `Delete bill ${bill.invoice_no}`} title={Number(bill.payment_count) > 0 || Number(bill.paid_amount) > 0 ? "Payment history is preserved; this bill cannot be deleted" : "Delete"}><FiTrash2 /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            ) : (
              <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {loading ? (
                  [1, 2, 3].map((item) => <div key={item} aria-hidden="true" className="h-56 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />)
                ) : visibleBills.length === 0 ? (
                  <div className="col-span-full rounded-2xl border border-dashed border-slate-200 px-6 py-14 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><FiFileText size={22} aria-hidden="true" /></span>
                    <p className="mt-3 text-sm font-bold text-slate-800">{bills.length === 0 ? "No bills yet" : "No matching bills"}</p>
                    <p className="mt-1 text-xs text-slate-500">{bills.length === 0 ? "Create your first invoice to see it here." : "Try another search or payment type."}</p>
                  </div>
                ) : visibleBills.map((bill, index) => {
                  const billCustomers = decodeArray(bill.customers);
                  const billProducts = decodeArray(bill.products);
                  return (
                    <article key={bill.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      <header className="flex items-start justify-between gap-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 p-4">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Invoice #{index + 1}</p>
                          <h2 className="mt-1 truncate text-sm font-black text-slate-800" title={bill.invoice_no}>{bill.invoice_no}</h2>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${bill.payment_type === "EXCHANGE_GOLD" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>
                          {bill.payment_type === "EXCHANGE_GOLD" ? "Exchange Gold" : "Full Payment"}
                        </span>
                      </header>
                      <div className="space-y-4 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer</p>
                            <p className="mt-1 truncate text-sm font-bold text-slate-800">{billCustomers.map((customer) => customer.name).join(", ") || "No customer name"}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</p>
                            <p className="mt-1 text-lg font-black text-slate-900">{currency(bill.total_amount)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                          <div>
                            <p className="text-[10px] font-semibold text-slate-400">Items</p>
                            <p className="mt-1 text-xs font-bold text-slate-700">{billProducts.length} item{billProducts.length === 1 ? "" : "s"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-slate-400">Date</p>
                            <p className="mt-1 text-xs font-bold text-slate-700">{bill.created_at ? new Date(bill.created_at).toLocaleDateString("en-IN") : "—"}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 text-xs">
                            <p className="font-bold text-emerald-700">Paid {currency(bill.paid_amount)}</p>
                            <p className={`mt-1 font-semibold ${Number(bill.balance_due) > 0 ? "text-rose-600" : "text-slate-400"}`}>Due {currency(bill.balance_due)}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 border-l border-slate-100 pl-2">
                            <button type="button" onClick={() => setViewingBill(bill)} className="rounded-lg p-2 text-sky-700 transition hover:bg-sky-50" aria-label={`View bill ${bill.invoice_no}`} title="View"><FiEye /></button>
                            <button type="button" onClick={() => printBill(bill)} className="rounded-lg p-2 text-[#00695C] transition hover:bg-emerald-50" aria-label={`Print bill ${bill.invoice_no}`} title="Print"><FiPrinter /></button>
                            {Number(bill.paid_amount) === 0 && <button type="button" onClick={() => editBill(bill)} className="rounded-lg p-2 text-amber-700 transition hover:bg-amber-50" aria-label={`Edit bill ${bill.invoice_no}`} title="Edit"><FiEdit2 /></button>}
                            <button type="button" onClick={() => deleteBill(bill)} disabled={Number(bill.payment_count) > 0 || Number(bill.paid_amount) > 0} className="rounded-lg p-2 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label={Number(bill.payment_count) > 0 || Number(bill.paid_amount) > 0 ? `Cannot delete ${bill.invoice_no}; payment history exists` : `Delete bill ${bill.invoice_no}`} title={Number(bill.payment_count) > 0 || Number(bill.paid_amount) > 0 ? "Payment history is preserved; this bill cannot be deleted" : "Delete"}><FiTrash2 /></button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : (
        <form onSubmit={saveBill} className="space-y-5">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#063f36] via-[#075348] to-[#0b6b5b] px-5 py-5 text-white shadow-[0_14px_32px_rgba(6,63,54,0.18)] sm:px-7">
            <div className="flex min-w-0 items-center gap-4">
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20" aria-label="Back to bills"><FiArrowLeft size={19} /></button>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-200">Billing workspace</p>
                <h1 className="mt-1 truncate text-xl font-black tracking-tight sm:text-2xl">{editingBillId ? "Edit bill" : "Create a new bill"}</h1>
                <p className="mt-1 text-xs text-white/70 sm:text-sm">Add customer and product details, then review the invoice total.</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white">
              <FiFileText aria-hidden="true" />
              {tackOrderSourceId ? `Tack order ${tackOrderSourceNo}` : editingBillId ? "Editing invoice" : "New invoice"}
            </span>
          </header>
          {tackOrderSourceId && (
            <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-4 text-sm text-emerald-900 shadow-sm">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white"><FiCheckCircle aria-hidden="true" /></span>
              <div>
                <p className="font-bold">Prefilled from Tack Order {tackOrderSourceNo}</p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                  Review the details before saving.
                  {Number(tackOrderAdvanceAmount) > 0 && ` Its ${currency(tackOrderAdvanceAmount)} advance will be recorded as a payment.`}
                </p>
              </div>
            </div>
          )}

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800"><FiUser size={20} aria-hidden="true" /></span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-700">Step 1 · Customer</p>
                  <h2 className="mt-0.5 text-base font-extrabold text-slate-900">Customer details</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Add everyone associated with this invoice.</p>
                </div>
              </div>
              {customers.map((customer, index) => (
                <div key={`customer-${index}`} className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  {customers.length > 1 && <div className="flex justify-end"><button type="button" onClick={() => setCustomers((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} className="text-rose-500" aria-label={`Remove customer ${index + 1}`}><FiTrash2 /></button></div>}
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextField label="Customer Name" value={customer.name} onChange={(value) => updateRow(setCustomers, customers, index, "name", value)} required placeholder="Enter customer name" />
                    <TextField label="Phone Number" value={customer.phone} onChange={(value) => updateRow(setCustomers, customers, index, "phone", value)} type="tel" required placeholder="Enter phone number" />
                    <TextField label="Email Address" value={customer.email} onChange={(value) => updateRow(setCustomers, customers, index, "email", value)} type="email" placeholder="Enter email address" />
                    <label className={labelClass}>
                      Address
                      <textarea
                        className={`${inputClass} min-h-20`}
                        value={customer.address}
                        onChange={(event) => updateRow(setCustomers, customers, index, "address", event.target.value)}
                        rows="2"
                        maxLength={500}
                        placeholder="Enter customer address"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </section>

            <div className="space-y-4">
              {!tackOrderSourceId && <section className="flex min-h-[300px] flex-col space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-800"><FiPlus size={20} aria-hidden="true" /></span>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-700">Step 2 · Products</p>
                    <h2 className="mt-0.5 text-base font-extrabold text-slate-900">Add a product</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Choose a catalog product, then add it to this bill.</p>
                  </div>
                </div>
                <CatalogProductFields
                  product={productToAdd}
                  catalogProducts={catalogProducts}
                  loading={catalogLoading}
                  selectionId="new"
                  onSelect={selectCatalogProduct}
                />
                <div className="mt-auto flex justify-end">
                  <button type="button" onClick={addSelectedProduct} disabled={!productToAdd.product_id} className="inline-flex items-center gap-1.5 rounded-lg bg-[#00695C] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#008577] disabled:cursor-not-allowed disabled:opacity-50">
                    <FiPlus /> Add Product
                  </button>
                </div>
              </section>}

            </div>
          </div>

          <section className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-800"><FiBox size={20} aria-hidden="true" /></span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-violet-700">Invoice items</p>
                  <h2 className="mt-0.5 text-base font-extrabold text-slate-900">Products in bill</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{tackOrderSourceId ? "Product quantities and weights are taken from the saved tack order." : "Products you add will appear in this table."}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{products.length} {products.length === 1 ? "item" : "items"}</span>
            </div>
            {products.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm"><FiBox size={21} aria-hidden="true" /></span>
                <p className="mt-3 text-sm font-bold text-slate-700">Your bill is waiting for products</p>
                <p className="mt-1 text-xs text-slate-500">{tackOrderSourceId ? "No products were found in the linked Tack Order." : "Select a catalog product above to get started."}</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[980px] border-collapse text-left">
                  <thead className="bg-gradient-to-r from-[#07564B] via-[#064A41] to-[#043D37] text-xs uppercase tracking-wide text-white">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Product</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Purity</th>
                      <th className="px-4 py-3 text-right font-semibold">Qty</th>
                      <th className="px-4 py-3 text-right font-semibold">Making Charge</th>
                      <th className="px-4 py-3 text-right font-semibold">Net Weight</th>
                      <th className="px-4 py-3 text-right font-semibold">Gram Rate</th>
                      <th className="px-4 py-3 text-right font-semibold">Unit Price</th>
                      <th className="px-4 py-3 text-right font-semibold">Total</th>
                      {!tackOrderSourceId && <th className="px-4 py-3 text-right font-semibold">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((savedProduct, index) => {
                      const product = getProductWithCatalogDetails(savedProduct);
                      const productImage = getProductImage(product);
                      return (
                      <tr key={`${product.product_id}-${index}`} className="transition-colors hover:bg-emerald-50/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-300">
                              <FiImage size={18} aria-hidden="true" />
                              {productImage && (
                                <img
                                  src={productImage}
                                  alt={product.product_name || "Product"}
                                  className="absolute inset-0 h-full w-full object-cover"
                                  onError={(event) => { event.currentTarget.style.display = "none"; }}
                                />
                              )}
                            </div>
                            <span className="text-sm font-medium text-slate-800">{product.product_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{product.category || "—"}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{product.purity || "—"}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-700">{Number(product.quantity) || 1}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-700">{formatMakingCharge(product)}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-700">{product.net_gold_weight == null ? "—" : formatWeight(product.net_gold_weight, "g")}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-700">{product.rate_per_gram == null ? "—" : `${currency(product.rate_per_gram)} / ${product.rate_unit || "gram"}`}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-800">{currency(product.price)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{currency((Number(product.price) || 0) * (Number(product.quantity) || 1))}</td>
                        {!tackOrderSourceId && <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => setProducts((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} className="rounded-md p-2 text-rose-500 hover:bg-rose-50" aria-label={`Remove product ${index + 1}`}><FiTrash2 /></button>
                        </td>}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><FiCreditCard size={20} aria-hidden="true" /></span>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-700">Step 3 · Payment</p>
                <h2 className="mt-0.5 text-base font-extrabold text-slate-900">Payment method</h2>
                <p className="mt-0.5 text-xs text-slate-500">Choose how this invoice is settled. GST is set in the bill summary.</p>
              </div>
            </div>
            {tackOrderSourceId && Number(tackOrderAdvanceAmount) > 0 && (
              <label className={labelClass}>
                Tack Order Advance Payment Method
                <CustomSelect
                  className={inputClass}
                  value={advancePaymentMethod || "Other"}
                  onChange={(event) => setAdvancePaymentMethod(event.target.value)}
                >
                  {PAYMENT_METHOD_OPTIONS.map((method) => <option key={method} value={method}>{method}</option>)}
                </CustomSelect>
                <span className="mt-1 block text-xs font-normal text-slate-500">The Tack Order doesn’t store a payment method, so this defaults to Other.</span>
              </label>
            )}
            {!editingBillId && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  Amount collected now (₹)
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    max={maxCashCollected}
                    step="0.01"
                    value={effectiveCashCollectedAmount}
                    onFocus={(event) => {
                      if (!cashCollectedManuallyEdited) event.currentTarget.select();
                    }}
                    onChange={(event) => {
                      setCashCollectedAmount(event.target.value);
                      setCashCollectedManuallyEdited(true);
                    }}
                    aria-invalid={!validCashCollected}
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-500">Prefilled with the remaining balance; enter the actual amount received (0 if none).</span>
                </label>
                <label className={labelClass}>
                  Payment method
                  <CustomSelect
                    className={inputClass}
                    value={cashCollectionMethod}
                    onChange={(event) => setCashCollectionMethod(event.target.value)}
                  >
                    {PAYMENT_METHOD_OPTIONS.map((method) => <option key={method} value={method}>{method}</option>)}
                  </CustomSelect>
                </label>
                {!validCashCollected && <p className="text-xs font-semibold text-rose-600 sm:col-span-2">Collected amount cannot exceed the remaining bill balance.</p>}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {[["FULL_PAYMENT", "Full payment", "Record payment without gold exchange."], ["EXCHANGE_GOLD", "Exchange gold", "Apply gold exchange credit to the bill."]].map(([value, label, description]) => (
                <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${paymentType === value ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/10" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}>
                  <input type="radio" name="payment_type" value={value} checked={paymentType === value} onChange={() => setPaymentType(value)} className="mt-1 accent-[#008577]" />
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${paymentType === value ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {value === "EXCHANGE_GOLD" ? <FiRepeat aria-hidden="true" /> : <FiCreditCard aria-hidden="true" />}
                  </span>
                  <span>
                    <span className={`block text-sm font-bold ${paymentType === value ? "text-emerald-900" : "text-slate-800"}`}>{label}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</span>
                  </span>
                </label>
              ))}
            </div>
            {paymentType === "EXCHANGE_GOLD" && (
              <div className="space-y-4 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h3 className="font-bold text-slate-800">Exchange Gold Items</h3><p className="text-xs text-slate-500">Exchange amount is calculated from net weight and today's rate.</p></div>
                  <button type="button" onClick={() => setExchanges((rows) => [...rows, { ...EMPTY_EXCHANGE }])} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100"><FiPlus /> Add Multiple Exchange Items</button>
                </div>
                {exchanges.map((exchange, index) => (
                  <div key={`exchange-${index}`} className="space-y-3 rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
                    <div className="flex justify-end"><button type="button" onClick={() => setExchanges((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} className="text-rose-500" aria-label={`Remove exchange item ${index + 1}`}><FiTrash2 /></button></div>
                    <ItemFields
                      item={exchange}
                      categories={categories}
                      metalRates={metalRates}
                      exchange
                      onChange={(field, value) => updateRow(setExchanges, exchanges, index, field, value)}
                      onCategorySelect={(value, isOther) => setExchanges((rows) => rows.map((row, rowIndex) => rowIndex === index ? {
                        ...row,
                        category_is_other: isOther,
                        category: isOther ? "" : value
                      } : row))}
                      onMetalSelect={(metalType, purity) => setExchanges((rows) => rows.map((row, rowIndex) => rowIndex === index ? {
                        ...row,
                        metal_type: metalType,
                        purity,
                        rate_per_unit: ""
                      } : row))}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md xl:sticky xl:top-5">
            <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#063f36] to-[#0b6b5b] px-5 py-4 text-white">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-emerald-200">Final review</p>
                <h2 className="mt-0.5 text-base font-extrabold">Bill summary</h2>
              </div>
              <FiFileText size={21} aria-hidden="true" className="text-emerald-100" />
            </div>
            <div className="space-y-3 p-5">
            <div className="flex justify-between text-sm text-slate-600"><span>Sub-Total</span><span>{currency(subtotal)}</span></div>
            <label className="flex items-center justify-between gap-4 text-sm font-medium text-slate-600">
              Discount (₹)
              <input
                className={`${inputClass} mt-0 max-w-40 text-right`}
                type="number"
                min="0"
                max={subtotal}
                step="0.01"
                value={discountInput}
                onChange={(event) => setDiscountInput(event.target.value)}
                placeholder="0.00"
                aria-invalid={!validDiscount}
              />
            </label>
            <div className="flex justify-between text-sm text-emerald-700">
              <span>Discount applied</span>
              <span>{validDiscount ? `−${currency(discountAmount)}` : "—"}</span>
            </div>
            {!validDiscount && <p className="text-xs font-semibold text-rose-600">Discount and exchange credit cannot exceed the products subtotal.</p>}
            {paymentType === "EXCHANGE_GOLD" && <div className="flex justify-between text-sm text-amber-700"><span>Exchange Amount</span><span>−{currency(exchangeCredit)}</span></div>}
            <div className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 sm:grid-cols-2">
              <label htmlFor="bill-gst-rate" className={labelClass}>
                GST percentage
                <span className="relative mt-1 block">
                  <input
                    id="bill-gst-rate"
                    className={`${inputClass} pr-9`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={gstRateInput}
                    onChange={(event) => setGstRateInput(event.target.value)}
                    placeholder="0"
                    aria-invalid={!validGst}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span>
                </span>
              </label>
              <label className={labelClass}>
                Tax mode
                <CustomSelect
                  className={inputClass}
                  value={taxMode}
                  onChange={(event) => setTaxMode(event.target.value)}
                >
                  <option>Tax Exclusive</option>
                  <option>Tax Inclusive</option>
                </CustomSelect>
              </label>
              {!validGst && <p className="text-xs font-semibold text-rose-600 sm:col-span-2">Enter a GST percentage between 0 and 100.</p>}
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>GST ({gstRate}%, {taxMode})</span>
              <span>{validGst && validDiscount ? currency(gst) : "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-4 ring-1 ring-emerald-100">
              <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Total bill</p><p className="mt-1 text-[11px] text-slate-500">Including applicable taxes</p></div>
              <span className="text-xl font-black tracking-tight text-emerald-900">{validDiscount && validGst ? currency(total) : "—"}</span>
            </div>
            {tackOrderSourceId && Number(tackOrderAdvanceAmount) > 0 && (
              <div className="flex justify-between text-sm text-emerald-700"><span>Advance Paid</span><span>−{currency(tackOrderAdvanceAmount)}</span></div>
            )}
            {!editingBillId && <>
              <div className="flex justify-between text-sm text-emerald-700"><span>Cash collected now</span><span>{currency(parsedCashCollected || 0)}</span></div>
              <div className="flex justify-between text-sm font-bold text-slate-800"><span>Balance Due</span><span>{validDiscount && validGst && validCashCollected ? currency(Math.max(0, total - advanceAmount - parsedCashCollected)) : "—"}</span></div>
            </>}
            {paymentType === "EXCHANGE_GOLD" && exchangeCredit > subtotal && <p className="text-xs font-semibold text-rose-600">Exchange amount cannot exceed subtotal.</p>}
            </div>
          </section>
          </div>
          <footer className="flex flex-col-reverse items-stretch justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:px-5">
            <p className="text-center text-xs text-slate-500 sm:text-left">Please review customer, item, tax, and payment details before saving.</p>
            <button type="submit" disabled={saving || !validGst || !validDiscount || !validAdvanceAmount || !validCashCollected || (paymentType === "EXCHANGE_GOLD" && exchangeCredit > subtotal)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00695C] to-[#008577] px-6 py-3 text-sm font-extrabold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"><FiSave />{saving ? (editingBillId ? "Updating Bill..." : "Saving Bill...") : (editingBillId ? "Update Bill" : "Save Bill")}</button>
          </footer>
        </form>
      )}
      {viewingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setViewingBill(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="bill-view-title" className="max-h-[90vh] w-full max-w-3xl space-y-5 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500">Bill Details</p>
                <h2 id="bill-view-title" className="mt-1 text-xl font-extrabold text-slate-900">{viewingBill.invoice_no}</h2>
              </div>
              <button type="button" onClick={() => setViewingBill(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close bill details"><FiX /></button>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="mb-2 text-sm font-bold text-slate-800">Customer(s)</h3>
                {decodeArray(viewingBill.customers).map((customer, index) => (
                  <div key={`${customer.email || customer.name}-${index}`} className="mb-3 text-sm text-slate-600 last:mb-0">
                    <p className="font-semibold text-slate-800">{customer.name}</p>
                    {customer.phone && <p>{customer.phone}</p>}
                    {customer.email && <p>{customer.email}</p>}
                    {customer.address && <p>{customer.address}</p>}
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                <h3 className="mb-2 font-bold text-slate-800">Bill Information</h3>
                <p>Payment: {viewingBill.payment_type === "EXCHANGE_GOLD" ? "Exchange Gold" : "Full Payment"}</p>
                <p>Date: {viewingBill.created_at ? new Date(viewingBill.created_at).toLocaleDateString("en-IN") : "—"}</p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[1350px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">S.No.</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Purity</th>
                    <th className="px-3 py-2 text-right">Making Charge</th>
                    <th className="px-3 py-2 text-right">Weight</th>
                    <th className="px-3 py-2 text-right">Wastage</th>
                    <th className="px-3 py-2 text-right">Net Weight</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {decodeArray(viewingBill.products).map((savedProduct, index) => {
                    const product = getProductWithCatalogDetails(savedProduct);
                    const productImage = getProductImage(product);
                    return (
                      <tr key={`view-product-${index}`}>
                        <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-slate-300">
                              <FiImage size={16} aria-hidden="true" />
                              {productImage && (
                                <img
                                  src={productImage}
                                  alt={product.product_name || "Product"}
                                  className="absolute inset-0 h-full w-full object-cover"
                                  onError={(event) => { event.currentTarget.style.display = "none"; }}
                                />
                              )}
                            </div>
                            <span>{product.product_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">{Number(product.quantity) || 1}</td>
                        <td className="px-3 py-2">{product.category || "—"}</td>
                        <td className="px-3 py-2">{product.purity || "—"}</td>
                        <td className="px-3 py-2 text-right">{formatMakingCharge(product)}</td>
                        <td className="px-3 py-2 text-right">—</td>
                        <td className="px-3 py-2 text-right">—</td>
                        <td className="px-3 py-2 text-right">{product.net_gold_weight == null ? "—" : formatWeight(product.net_gold_weight, "g")}</td>
                        <td className="px-3 py-2 text-right">{product.rate_per_gram == null ? "—" : `${currency(product.rate_per_gram)} / ${product.rate_unit || "gram"}`}</td>
                        <td className="px-3 py-2 text-right">{currency((Number(product.price) || 0) * (Number(product.quantity) || 1))}</td>
                      </tr>
                    );
                  })}
                  {decodeArray(viewingBill.exchanges).map((exchange, index) => (
                    <tr key={`view-exchange-${index}`} className="text-rose-700">
                      <td className="px-3 py-2 text-slate-500">{decodeArray(viewingBill.products).length + index + 1}</td>
                      <td className="px-3 py-2">{exchange.product_name || "Exchange item"}</td>
                      <td className="px-3 py-2 text-right">1</td>
                      <td className="px-3 py-2">{exchange.category || "—"}</td>
                      <td className="px-3 py-2">{exchange.metal_type} {exchange.purity}</td>
                      <td className="px-3 py-2 text-right">—</td>
                      <td className="px-3 py-2 text-right">{formatWeight(exchange.weight, exchange.weight_unit === "carat" ? "carat" : "g")}</td>
                      <td className="px-3 py-2 text-right">{formatWeight(exchange.wastage_weight, exchange.weight_unit === "carat" ? "carat" : "g")}</td>
                      <td className="px-3 py-2 text-right">{formatWeight(exchange.net_weight, exchange.weight_unit === "carat" ? "carat" : "g")}</td>
                      <td className="px-3 py-2 text-right">{currency(exchange.rate_per_unit)} / {exchange.rate_unit || "gram"}</td>
                      <td className="px-3 py-2 text-right font-semibold">−{currency(exchange.credit_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ml-auto max-w-sm space-y-2 text-sm">
              <div className="flex justify-between text-slate-600"><span>Sub-Total</span><span>{currency(viewingBill.sub_total)}</span></div>
              {Number(viewingBill.discount_amount) > 0 && <div className="flex justify-between text-emerald-700"><span>Discount</span><span>−{currency(viewingBill.discount_amount)}</span></div>}
              {decodeArray(viewingBill.exchanges).length > 0 && <div className="flex justify-between text-amber-700"><span>Exchange Amount</span><span>−{currency(decodeArray(viewingBill.exchanges).reduce((sum, item) => sum + (Number(item.credit_amount) || 0), 0))}</span></div>}
              <div className="flex justify-between text-slate-600"><span>GST ({Number(viewingBill.gst_rate || 0)}%, {viewingBill.tax_mode || "Tax Exclusive"})</span><span>{currency(viewingBill.gst_amount)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-extrabold text-slate-900"><span>Total</span><span>{currency(viewingBill.total_amount)}</span></div>
              <div className="flex justify-between text-emerald-700"><span>Paid</span><span>{currency(viewingBill.paid_amount)}</span></div>
              <div className="flex justify-between font-bold text-rose-700"><span>Balance due</span><span>{currency(viewingBill.balance_due)}</span></div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

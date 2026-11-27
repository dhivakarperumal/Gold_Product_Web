import CustomSelect from "../../Components/CustomSelect.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { useNavigate, useParams } from "react-router-dom";
import { toast, Toaster } from "react-hot-toast";
import {
  FiArrowLeft,
  FiBox,
  FiCheck,
  FiImage,
  FiSave,
  FiTrash2,
  FiUploadCloud,
  FiX
} from "react-icons/fi";
import api from "../../api";
import { resolveBackendImageUrl } from "../../Components/Home/productDisplay";
import { formatRateDate, getRateForPurity } from "../../PrivateRouter/goldRateUtils";
import useGoldRates from "../../PrivateRouter/useGoldRates";
import { formatCurrency } from "../../utils/currency";

const GOLD_SHOP = "Sri Gold";
const GOLD_PURITY_LABELS = {
  "999": "24K / 999",
  "916": "22K / 916",
  "833": "20K / 833",
  "750": "18K / 750",
  "585": "14K / 585"
};

function getPurityOptions(metalType, rateSet) {
  const type = String(metalType || "").toLowerCase();
  const activeRates = rateSet?.rates?.filter(
    (rate) => String(rate.metal_type || "").toLowerCase() === type
  ) || [];
  const formattedPurities = activeRates
    .map((rate) => String(rate.purity || "").trim())
    .filter(Boolean)
    .map((purity) => GOLD_PURITY_LABELS[purity] || purity);
  return [...new Set(formattedPurities)];
}

const EMPTY_PRODUCT = {
  name: "",
  product_code: "",
  brand: GOLD_SHOP,
  category: "",
  metal_type: "",
  product_type: "Traditional",
  purity: "",
  gross_weight: "",
  net_gold_weight: "",
  gold_rate_per_gram: "",
  making_charge_type: "Percentage",
  making_charge: "",
  wastage_type: "Percentage",
  wastage: "",
  stone_weight: "0",
  stone_charges: "0",
  other_charges: "0",
  stone_type: "None",
  huid: "",
  available_sizes: [],
  product_size: "",
  length: "",
  width: "",
  height: "",
  ring_size: "",
  bangle_size: "",
  chain_length: "",
  size_guide_chart: "",
  mrp: "",
  offer: "0",
  offer_type: "Percentage",
  offer_price: "",
  fixed_discount_amount: "0",
  discount: "0",
  gst_rate: "",
  final_selling_price: "",
  price_includes_gst: true,
  description: "",
  full_description: "",
  highlights: [],
  specifications: "",
  care_instructions: "",
  warranty: "",
  images: [],
  video: "",
  certificate: "",
  rating: "0",
  total_reviews: "0",
  total_stock: "0",
  stock_status: "Out of Stock",
  sku_barcode: "",
  warehouse: "Main Shop",
  status: "Active",
  featured: false,
  new_arrival: false,
  best_seller: false
};

const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.06)] outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10";
const labelClass = "block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500";

const Section = ({ title, children }) => {
  const sectionNumber = title.match(/^\d+/)?.[0];
  const sectionTitle = title.replace(/^\d+\.\s*/, "");

  return (
    <section className="mb-5 inline-block w-full break-inside-avoid rounded-[22px] border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.045)] transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-3 rounded-t-[21px] border-b border-slate-100 bg-gradient-to-r from-emerald-50/90 via-white to-amber-50/40 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-700 to-teal-600 text-sm font-black text-white shadow-md shadow-emerald-900/15 ring-1 ring-white/80">
            {sectionNumber || <FiBox aria-hidden="true" />}
          </span>
          <h2 className="truncate text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">{sectionTitle}</h2>
        </div>
        {sectionNumber && <span className="hidden shrink-0 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400 sm:inline">Section {sectionNumber}</span>}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
};

const Field = ({ label, name, value, onChange, type = "text", placeholder = "", required = false, min, step, readOnly = false }) => (
  <label className={labelClass}>
    {label}{required && <span className="ml-1 text-red-500">*</span>}
    <input
      className={`${inputClass} ${readOnly ? "cursor-not-allowed bg-slate-50 text-slate-600" : ""}`}
      type={type}
      name={name}
      value={value ?? ""}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      min={min}
      step={step}
      readOnly={readOnly}
    />
  </label>
);

const SelectField = ({ label, name, value, onChange, options, required = false }) => (
  <label className={labelClass}>
    {label}{required && <span className="ml-1 text-red-500">*</span>}
    <CustomSelect className={inputClass} name={name} value={value ?? ""} onChange={onChange} required={required}>
      {options.map((option) => {
        const item = typeof option === "string" ? { value: option, label: option } : option;
        return <option key={item.value} value={item.value}>{item.label}</option>;
      })}
    </CustomSelect>
  </label>
);

const AddProducts = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [metals, setMetals] = useState([]);
  const [formData, setFormData] = useState(EMPTY_PRODUCT);
  const [originalPurity, setOriginalPurity] = useState(null);
  const [originalMetalType, setOriginalMetalType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [uploading, setUploading] = useState(false);
  const { current: activeRateSet, loading: ratesLoading, error: ratesError } = useGoldRates();
  const didInitializePurity = useRef(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const categoryRequest = api.get("/categories/manage");
        const metalRequest = api.get("/metals/manage");
        const productRequest = isEdit
          ? api.get(`/products/${id}`)
          : api.get("/products/latest-code");
        const [categoryResponse, metalResponse, productResponse] = await Promise.all([
          categoryRequest,
          metalRequest,
          productRequest
        ]);
        if (!active) return;
        const categoryList = Array.isArray(categoryResponse.data) ? categoryResponse.data : [];
        const metalList = Array.isArray(metalResponse.data) ? metalResponse.data : [];
        setCategories(categoryList);
        setMetals(metalList.filter((metal) => metal.status === "Active"));
        if (isEdit) {
          const product = productResponse.data;
          setOriginalPurity(product.purity || "");
          setOriginalMetalType(product.metal_type || "");
          setFormData({
            ...EMPTY_PRODUCT,
            ...product,
            product_code: product.product_code || "",
            available_sizes: Array.isArray(product.available_sizes) ? product.available_sizes : [],
            highlights: Array.isArray(product.highlights) ? product.highlights : [],
            images: Array.isArray(product.images) ? product.images : [],
            offer: String(product.offer ?? "0"),
            offer_type: product.offer_type || (Number(product.offer) > 0 ? "Percentage" : "None"),
            fixed_discount_amount: String(product.fixed_discount_amount ?? "0"),
            offer_price: String(product.offer_price ?? ""),
            mrp: String(product.mrp ?? ""),
            total_stock: String(product.total_stock ?? "0"),
            price_includes_gst: Boolean(product.price_includes_gst)
          });
        } else {
          const category = categoryList.find((item) => item.name === "Gold Jewellery") || categoryList[0];
          setFormData((current) => ({
            ...current,
            category: category?.name || "",
            subcategory: Array.isArray(category?.subcategory) ? category.subcategory[0] || "" : "",
            metal_type: metalList.find((metal) => metal.status === "Active" && metal.name.toLowerCase() === "gold")?.name
              || metalList.find((metal) => metal.status === "Active")?.name || "",
            product_code: productResponse.data.latestCode || "GOLD-PRD-001"
          }));
        }
      } catch (error) {
        console.error("Failed to load product form data:", error);
        toast.error(error.response?.data?.message || "Could not load product form data.");
      } finally {
        if (active) setFetching(false);
      }
    };
    load();
    return () => { active = false; };
  }, [id, isEdit]);

  useEffect(() => {
    if (
      isEdit
      || !formData.metal_type
      || ratesLoading
      || ratesError
      || didInitializePurity.current
    ) return;

    const configuredPurities = getPurityOptions(formData.metal_type, activeRateSet);
    didInitializePurity.current = true;
    setFormData((current) => ({
      ...current,
      purity: configuredPurities.includes(current.purity)
        ? current.purity
        : configuredPurities[0] || ""
    }));
  }, [activeRateSet, formData.metal_type, isEdit, ratesError, ratesLoading]);

  const configuredPurities = getPurityOptions(formData.metal_type, activeRateSet);
  const purityOptions = isEdit && formData.purity && !configuredPurities.includes(formData.purity)
    ? [formData.purity, ...configuredPurities]
    : configuredPurities;
  const puritySelectOptions = purityOptions.length
    ? [{ value: "", label: "Select purity" }, ...purityOptions]
    : [{ value: "", label: ratesLoading ? "Loading purity rates..." : "No active rate for this metal" }];
  const isDiamond = formData.metal_type.toLowerCase() === "diamond";
  const grossWeight = Number(formData.gross_weight) || 0;
  const stoneWeight = Number(formData.stone_weight) || 0;
  const effectiveNetMetalWeight = isDiamond
    ? Number(formData.net_gold_weight) || 0
    : Math.max(0, grossWeight - stoneWeight);
  const activePurityRate = getRateForPurity(activeRateSet, formData.purity, formData.metal_type || "Gold");
  const rateUnit = activePurityRate?.rate_unit === "carat" || isDiamond ? "Carat" : "Gram";
  const purityChanged = isEdit && originalPurity !== null
    && (formData.purity !== originalPurity || formData.metal_type !== originalMetalType);
  const effectiveGoldRate = (!isEdit || purityChanged) && activePurityRate
    ? Number(activePurityRate.rate_per_gram)
    : Number(formData.gold_rate_per_gram) || 0;
  const effectiveMakingChargeType = !isEdit && !formData.making_charge && activeRateSet
    ? activeRateSet.making_charge_type
    : formData.making_charge_type;
  const effectiveMakingCharge = !isEdit && !formData.making_charge && activeRateSet
    ? String(activeRateSet.making_charge_value)
    : formData.making_charge;
  const effectiveWastage = !isEdit && !formData.wastage && activeRateSet
    ? String(activeRateSet.wastage_percentage)
    : formData.wastage;
  const effectiveWastageType = !isEdit && !formData.wastage && activeRateSet
    ? "Percentage"
    : formData.wastage_type;

  const selectedCategory = categories.find((category) => category.name === formData.category);
  const subcategories = Array.isArray(selectedCategory?.subcategory) ? selectedCategory.subcategory : [];

  const goldValue = useMemo(
    () => effectiveNetMetalWeight * effectiveGoldRate,
    [effectiveNetMetalWeight, effectiveGoldRate]
  );

  const estimatedPrice = useMemo(() => {
    const metalValue = goldValue;
    const makingCharge = effectiveMakingChargeType === "Percentage"
      ? metalValue * (Number(effectiveMakingCharge) || 0) / 100
      : Number(effectiveMakingCharge) || 0;
    const wastageWeight = effectiveWastageType === "Percentage"
      ? effectiveNetMetalWeight * (Number(effectiveWastage) || 0) / 100
      : Number(effectiveWastage) || 0;
    const wastageCharge = wastageWeight * effectiveGoldRate;
    const subtotal = metalValue + makingCharge + wastageCharge + (Number(formData.stone_charges) || 0) + (Number(formData.other_charges) || 0);
    const tax = subtotal * (Number(formData.gst_rate) || 0) / 100;
    return {
      metalValue, makingCharge, wastageCharge,
      stoneCharges: Number(formData.stone_charges) || 0,
      tax, total: formData.price_includes_gst ? subtotal : subtotal + tax
    };
  }, [effectiveGoldRate, effectiveMakingCharge, effectiveMakingChargeType, effectiveNetMetalWeight, effectiveWastage, effectiveWastageType, formData, goldValue]);

  const pricing = useMemo(() => {
    const preDiscountPrice = estimatedPrice.total;
    const offerType = formData.offer_type || "None";
    const requestedDiscount = offerType === "Percentage"
      ? preDiscountPrice * (Number(formData.offer) || 0) / 100
      : offerType === "Fixed Amount" ? Number(formData.fixed_discount_amount) || 0 : 0;
    const discount = Math.min(preDiscountPrice, requestedDiscount);
    const offerPrice = Math.max(0, preDiscountPrice - discount);
    return { preDiscountPrice, offerPrice, discount, finalPrice: offerPrice };
  }, [estimatedPrice.total, formData.offer_type, formData.offer, formData.fixed_discount_amount]);
  const effectiveMrp = formData.mrp === "" ? estimatedPrice.total : Number(formData.mrp) || 0;

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;
    setFormData((current) => {
      if (name === "category") {
        const category = categories.find((item) => item.name === value);
        const categorySubcategories = Array.isArray(category?.subcategory) ? category.subcategory : [];
        return {
          ...current,
          category: value,
          subcategory: categorySubcategories.includes(current.subcategory) ? current.subcategory : categorySubcategories[0] || ""
        };
      }
      if (name === "metal_type") {
        const nextPurities = getPurityOptions(value, activeRateSet);
        return {
          ...current,
          metal_type: value,
          purity: nextPurities.includes(current.purity) ? current.purity : nextPurities[0] || ""
        };
      }
      return { ...current, [name]: nextValue };
    });
  };

  const updateFormField = (name, value) => {
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleUpload = async (event, field) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    input.value = "";
    if (files.length === 0) return;
    const isImage = field === "images";
    const isVideo = field === "video";
    const acceptedTypes = isImage || field === "size_guide_chart" || field === "certificate"
      ? ["image/png", "image/jpeg", ...(isVideo ? ["video/mp4"] : []), ...(field !== "images" ? ["application/pdf"] : [])]
      : ["video/mp4"];
    const invalidType = files.find((file) => !acceptedTypes.includes(file.type));
    if (invalidType) {
      toast.error(isVideo ? "Choose an MP4 video." : "Choose PNG/JPG images or a PDF document.");
      return;
    }
    const maxBytes = isVideo ? 25 * 1024 * 1024 : 5 * 1024 * 1024;
    if (files.some((file) => file.size > maxBytes)) {
      toast.error(isVideo ? "Video must be 25 MB or smaller." : "Each upload must be 5 MB or smaller.");
      return;
    }
    if (isImage && formData.images.length + files.length > 10) {
      toast.error("Upload up to 10 product images.");
      return;
    }

    try {
      setUploading(true);
      const uploadFiles = isImage
        ? await Promise.all(files.map((file) => imageCompression(file, {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1400,
            useWebWorker: true,
            fileType: "image/webp",
            initialQuality: 0.82
          })))
        : files;
      const payload = new FormData();
      uploadFiles.forEach((file) => payload.append(field, file));
      const response = await api.post("/products/upload-media", payload);
      if (isImage) {
        updateFormField("images", [...formData.images, ...(response.data.images || [])]);
      } else {
        updateFormField(field, response.data[field]);
      }
      toast.success("Upload complete.");
    } catch (error) {
      console.error("Product media upload failed:", error);
      toast.error(error.response?.data?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    updateFormField("images", formData.images.filter((_, imageIndex) => imageIndex !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.name.trim() || !formData.product_code.trim() || !formData.category) {
      toast.error("Product name, SKU, and category are required.");
      return;
    }
    if (!isDiamond && stoneWeight > grossWeight) {
      toast.error("Stone weight cannot exceed gross weight.");
      return;
    }
    const stock = Math.max(0, Math.floor(Number(formData.total_stock) || 0));
    const offerPrice = pricing.offerPrice;
    const gst = Number(formData.gst_rate) || 0;
    const finalPrice = pricing.finalPrice;
    const product = {
      ...formData,
      name: formData.name.trim(),
      product_code: formData.product_code.trim(),
      brand: formData.brand.trim() || GOLD_SHOP,
      total_stock: stock,
      stock_status: stock <= 0 ? "Out of Stock" : stock < 10 ? "Low Stock" : "In Stock",
      mrp: Number(effectiveMrp.toFixed(2)),
      offer: Number(formData.offer) || 0,
      offer_type: formData.offer_type || "None",
      fixed_discount_amount: Number(formData.fixed_discount_amount) || 0,
      offer_price: offerPrice,
      discount: pricing.discount,
      gst_rate: gst,
      final_selling_price: Number(finalPrice.toFixed(2)),
      gross_weight: Number(formData.gross_weight) || 0,
      net_gold_weight: effectiveNetMetalWeight,
      gold_rate_per_gram: effectiveGoldRate,
      making_charge_type: effectiveMakingChargeType,
      making_charge: Number(effectiveMakingCharge) || 0,
      wastage_type: effectiveWastageType,
      wastage: Number(effectiveWastage) || 0,
      stone_weight: Number(formData.stone_weight) || 0,
      stone_charges: Number(formData.stone_charges) || 0,
      other_charges: Number(formData.other_charges) || 0,
      rating: Number(formData.rating) || 0,
      total_reviews: Number(formData.total_reviews) || 0,
      price_includes_gst: Boolean(formData.price_includes_gst),
      images: formData.images,
      variants: [{ images: formData.images }]
    };
    try {
      setLoading(true);
      if (isEdit) {
        await api.put(`/products/${id}`, product);
        toast.success("Product updated.");
      } else {
        await api.post("/products", product);
        toast.success("Product added.");
      }
      navigate("/admin/products/all");
    } catch (error) {
      console.error("Product save failed:", error);
      toast.error(error.response?.data?.message || "Could not save the product.");
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="py-20 text-center text-sm font-semibold text-gray-500">Loading product details...</div>;
  }

  const uploadButton = (field, label, accept, multiple = false, compact = false) => (
    <label className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white text-center transition hover:border-emerald-500 hover:from-emerald-50/70 hover:to-white ${compact ? "min-h-20 gap-1 px-4 py-3" : "min-h-36 p-5"}`}>
      <span className={`flex items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 transition group-hover:bg-emerald-700 group-hover:text-white ${compact ? "h-8 w-8" : "mb-2 h-11 w-11"}`}><FiUploadCloud className={compact ? "text-base" : "text-xl"} /></span>
      <span className="text-sm font-bold text-slate-700">{uploading ? "Uploading..." : label}</span>
      <span className={`text-xs text-slate-500 ${compact ? "" : "mt-1"}`}>{accept}</span>
      <input type="file" accept={field === "video" ? "video/mp4" : "image/png,image/jpeg,application/pdf"} multiple={multiple} disabled={uploading} onChange={(event) => handleUpload(event, field)} className="sr-only" />
    </label>
  );

  return (
    <div className="space-y-5 pb-12">
      <Toaster position="top-right" />
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#063f36] via-[#075348] to-[#0b6b5b] px-5 py-5 text-white shadow-[0_16px_36px_rgba(6,63,54,0.2)] sm:px-7 sm:py-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full border-[28px] border-white/5" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-36 h-48 w-48 rounded-full bg-amber-300/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20">
              <FiArrowLeft size={19} />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-200">Catalog management</p>
              <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">{isEdit ? "Edit Product" : "Add Product"}</h1>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/75 sm:text-sm">Build a complete catalog listing with verified pricing, product media, and inventory details.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white">
              <FiBox aria-hidden="true" />
              {isEdit ? "Product editor" : "New catalog item"}
            </span>
            <span className="rounded-full bg-amber-300/15 px-3 py-2 text-xs font-bold text-amber-100">SKU auto-generated</span>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="columns-1 gap-5 lg:columns-2">
          <Section title="1. Basic Information">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Product Name" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Classic Gold Chain" required />
              <Field label="SKU / Product Code (Auto-generated)" name="product_code" value={formData.product_code} onChange={handleChange} placeholder="Generating..." required readOnly />
              <SelectField label="Category" name="category" value={formData.category} onChange={handleChange} required options={[
                { value: "", label: "Select category" },
                ...categories.map((category) => ({ value: category.name, label: category.name }))
              ]} />
              <SelectField label="Subcategory" name="subcategory" value={formData.subcategory} onChange={handleChange} options={[
                { value: "", label: "Select subcategory" },
                ...subcategories.map((subcategory) => ({ value: subcategory, label: subcategory }))
              ]} />
              <SelectField label="Metal Type" name="metal_type" value={formData.metal_type} onChange={handleChange} options={[
                { value: "", label: "Select metal type" },
                ...metals.map((metal) => ({ value: metal.name, label: metal.purity ? `${metal.name} (${metal.purity})` : metal.name }))
              ]} />
              <SelectField label="Product Type" name="product_type" value={formData.product_type} onChange={handleChange} options={["Traditional", "Daily Wear", "Bridal", "Designer"]} />
            </div>
          </Section>

          <Section title={`2. ${isDiamond ? "Diamond" : "Metal"} Details`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField label={isDiamond ? "Diamond Grade" : "Purity"} name="purity" value={formData.purity} onChange={handleChange} options={puritySelectOptions} />
              <Field label="Gross Weight (g)" name="gross_weight" type="number" min="0" step="0.001" value={formData.gross_weight} onChange={handleChange} placeholder="10" />
              <Field
                label={isDiamond ? "Net Diamond Weight (ct)" : "Net Metal Weight (g)"}
                name="net_gold_weight"
                type="number"
                min="0"
                step="0.001"
                value={isDiamond
                  ? formData.net_gold_weight
                  : formData.gross_weight
                    ? effectiveNetMetalWeight.toFixed(3)
                    : ""}
                onChange={handleChange}
                placeholder={isDiamond ? "e.g. 0.50" : "Auto-calculated"}
                readOnly={!isDiamond}
              />
              <Field label={`Rate / ${rateUnit} (₹)`} name="gold_rate_per_gram" type="number" min="0" step="0.01" value={effectiveGoldRate || ""} onChange={handleChange} placeholder={ratesLoading ? "Loading current rate..." : "No active rate"} readOnly />
              <SelectField label="Making Charge Type" name="making_charge_type" value={effectiveMakingChargeType} onChange={handleChange} options={["Percentage", "Fixed Amount"]} />
              <Field label={effectiveMakingChargeType === "Percentage" ? "Making Charge (%)" : "Making Charge (₹)"} name="making_charge" type="number" min="0" step="0.01" value={effectiveMakingCharge} onChange={handleChange} placeholder={effectiveMakingChargeType === "Percentage" ? "10" : "500"} />
              <SelectField label="Wastage Type" name="wastage_type" value={effectiveWastageType} onChange={handleChange} options={["Percentage", "Grams"]} />
              <Field label={effectiveWastageType === "Percentage" ? "Wastage (%)" : "Wastage (g)"} name="wastage" type="number" min="0" step="0.001" value={effectiveWastage} onChange={handleChange} placeholder={effectiveWastageType === "Percentage" ? "e.g. 5" : "e.g. 0.5"} />
              <Field label="Stone Weight (g)" name="stone_weight" type="number" min="0" step="0.001" value={formData.stone_weight} onChange={handleChange} placeholder="0" />
              <Field label="Stone Charges (₹)" name="stone_charges" type="number" min="0" step="0.01" value={formData.stone_charges} onChange={handleChange} placeholder="0" />
              <SelectField label="Stone Type" name="stone_type" value={formData.stone_type} onChange={handleChange} options={["None", "Diamond", "Ruby", "Other"]} />
              <Field label="Hallmark / HUID" name="huid" value={formData.huid} onChange={handleChange} placeholder="Verified HUID" />
            </div>
            {activeRateSet && (
              <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900">
                Active precious metal rates · effective {formatRateDate(activeRateSet.rate_date)}. Existing product rate snapshots remain unchanged.
              </p>
            )}
            {ratesError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Could not refresh rates: {ratesError}</p>}
            {!ratesLoading && !ratesError && !activePurityRate && formData.net_gold_weight && (
              <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">No active rate matches this {formData.metal_type || "metal"} purity. Configure and activate it under Settings → Daily Precious Rates.</p>
            )}
            {goldValue > 0 && (
              <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="mt-1 text-xs">Metal {formatCurrency(estimatedPrice.metalValue)} + making {formatCurrency(estimatedPrice.makingCharge)} + wastage {formatCurrency(estimatedPrice.wastageCharge)} + stones {formatCurrency(estimatedPrice.stoneCharges)} + applicable tax {formatCurrency(estimatedPrice.tax)}{formData.price_includes_gst ? " (included)" : ""}.</p>
                <p className="mt-1 text-xs">
                  {formData.mrp === ""
                    ? "MRP is estimated automatically. Enter a value in the MRP field to override it."
                    : "MRP uses your entered value; daily rate changes will not overwrite it."}
                </p>
              </div>
            )}
          </Section>

          <Section title="3. Size & Dimensions">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Available Sizes" name="available_sizes_text" value={formData.available_sizes.join(", ")} onChange={(event) => updateFormField("available_sizes", event.target.value.split(",").map((size) => size.trim()).filter(Boolean))} placeholder="12, 14, 16, 18 inches" />
              <SelectField label="Product Size" name="product_size" value={formData.product_size} onChange={handleChange} options={[
                { value: "", label: "Select size" }, "Small", "Medium", "Large", "Free Size"
              ]} />
              <Field label="Length" name="length" value={formData.length} onChange={handleChange} placeholder="18 inches" />
              <Field label="Width" name="width" value={formData.width} onChange={handleChange} placeholder="5 mm" />
              <Field label="Height / Thickness" name="height" value={formData.height} onChange={handleChange} placeholder="2 mm" />
              <Field label="Ring Size" name="ring_size" value={formData.ring_size} onChange={handleChange} placeholder="As applicable" />
              <Field label="Bangle Size" name="bangle_size" value={formData.bangle_size} onChange={handleChange} placeholder="As applicable" />
              <Field label="Chain Length" name="chain_length" value={formData.chain_length} onChange={handleChange} placeholder="18 inches" />
            </div>
            <div className="mt-4">
              <p className={`${labelClass} mb-2`}>Size Guide Chart</p>
              {formData.size_guide_chart ? (
                <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  {/\.pdf(?:$|[?#])/i.test(formData.size_guide_chart) ? (
                    <iframe
                      className="h-32 w-full sm:h-40"
                      src={resolveBackendImageUrl(formData.size_guide_chart)}
                      title="Size guide chart preview"
                    />
                  ) : (
                    <img
                      className="h-32 w-full bg-white object-contain sm:h-40"
                      src={resolveBackendImageUrl(formData.size_guide_chart)}
                      alt="Size guide chart preview"
                    />
                  )}
                  <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-3 py-2">
                    <a className="text-sm font-semibold text-[#003B3B] underline" href={resolveBackendImageUrl(formData.size_guide_chart)} target="_blank" rel="noreferrer">Open size guide</a>
                    <button type="button" onClick={() => updateFormField("size_guide_chart", "")} aria-label="Remove size guide" className="text-red-500"><FiX /></button>
                  </div>
                </div>
              ) : uploadButton("size_guide_chart", "Upload size chart image or PDF", "PNG, JPG, PDF up to 5 MB", false, true)}
            </div>
          </Section>

          <Section title="4. Pricing & Offers">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className={labelClass}>MRP (₹)<span className="ml-1 text-red-500">*</span></span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">₹</span>
                  <input
                    className={`${inputClass} pl-8`}
                    type="number"
                    inputMode="decimal"
                    name="mrp"
                    min="0"
                    step="0.01"
                    value={formData.mrp || (estimatedPrice.total > 0 ? estimatedPrice.total.toFixed(2) : "")}
                    onChange={handleChange}
                    placeholder="Enter MRP"
                    required
                  />
                </div>
                <p className="mt-1 text-[11px] font-medium text-gray-500">
                  Estimated jewellery price: {formatCurrency(estimatedPrice.total)}. Edit the value above to set a different MRP.
                </p>
              </div>
              <label className={labelClass}>Offer Type
                <CustomSelect className={inputClass} name="offer_type" value={formData.offer_type} onChange={handleChange}>
                  <option value="None">No offer</option>
                  <option value="Percentage">Percentage discount</option>
                  <option value="Fixed Amount">Fixed amount discount</option>
                </CustomSelect>
              </label>
              {formData.offer_type === "Percentage" && <Field label="Discount (%)" name="offer" type="number" min="0" max="100" step="0.01" value={formData.offer} onChange={handleChange} placeholder="5" />}
              {formData.offer_type === "Fixed Amount" && <Field label="Fixed Discount (₹)" name="fixed_discount_amount" type="number" min="0" step="0.01" value={formData.fixed_discount_amount} onChange={handleChange} placeholder="500" />}
              <Field label="Offer Price (₹)" name="offer_price" type="number" value={pricing.offerPrice.toFixed(2)} onChange={() => {}} readOnly />
              <Field label="Other Charges (₹)" name="other_charges" type="number" min="0" step="0.01" value={formData.other_charges} onChange={handleChange} />
              <Field label="GST (%)" name="gst_rate" type="number" min="0" step="0.01" value={formData.gst_rate} onChange={handleChange} placeholder="Applicable GST" />
            </div>
            <label className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" name="price_includes_gst" checked={formData.price_includes_gst} onChange={handleChange} className="h-4 w-4 accent-[#003B3B]" />
              Price includes GST
            </label>
          </Section>

          <Section title="5. Product Content">
            <div className="space-y-4">
              <label className={labelClass}>Full Description
                <textarea className={inputClass} rows="4" name="full_description" value={formData.full_description} onChange={handleChange} placeholder="Detailed product description..." />
              </label>
              <label className={labelClass}>Care Instructions
                <textarea className={inputClass} rows="2" name="care_instructions" value={formData.care_instructions} onChange={handleChange} placeholder="Store safely and clean appropriately..." />
              </label>
            </div>
          </Section>

          <Section title="6. Media & Uploads">
            <div>
              <p className={`${labelClass} mb-2`}>Main Product Images</p>
              {formData.images.length > 0 && (
                <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {formData.images.map((image, index) => (
                    <div key={`${image}-${index}`} className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200">
                      <img src={resolveBackendImageUrl(image)} alt={`Product ${index + 1}`} className="h-full w-full object-cover" />
                      <button type="button" onClick={() => removeImage(index)} aria-label="Remove product image" className="absolute right-2 top-2 rounded-full bg-white p-1.5 text-red-500 opacity-0 shadow transition group-hover:opacity-100"><FiTrash2 /></button>
                    </div>
                  ))}
                </div>
              )}
              {formData.images.length < 10 && uploadButton("images", "Upload product images", "JPG / PNG up to 5 MB each", true)}
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className={`${labelClass} mb-2`}>Product Video</p>
                {formData.video ? (
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                    <video className="h-32 w-full bg-black object-contain sm:h-40" src={resolveBackendImageUrl(formData.video)} controls preload="metadata">
                      Your browser does not support video playback.
                    </video>
                    <div className="flex justify-end border-t border-gray-200 bg-white px-3 py-2">
                      <button type="button" onClick={() => updateFormField("video", "")} aria-label="Remove video" className="text-red-500"><FiX /></button>
                    </div>
                  </div>
                ) : uploadButton("video", "Upload optional MP4 video", "MP4 up to 25 MB")}
              </div>
              <div>
                <p className={`${labelClass} mb-2`}>Certificate Upload</p>
                {formData.certificate ? (
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                    {/\.pdf(?:$|[?#])/i.test(formData.certificate) ? (
                      <iframe
                        className="h-32 w-full sm:h-40"
                        src={resolveBackendImageUrl(formData.certificate)}
                        title="Certificate preview"
                      />
                    ) : (
                      <img
                        className="h-32 w-full bg-white object-contain sm:h-40"
                        src={resolveBackendImageUrl(formData.certificate)}
                        alt="Certificate preview"
                      />
                    )}
                    <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-3 py-2">
                      <a className="text-sm font-semibold text-[#003B3B] underline" href={resolveBackendImageUrl(formData.certificate)} target="_blank" rel="noreferrer">Open certificate</a>
                      <button type="button" onClick={() => updateFormField("certificate", "")} aria-label="Remove certificate" className="text-red-500"><FiX /></button>
                    </div>
                  </div>
                ) : uploadButton("certificate", "Upload certificate", "PNG, JPG, PDF up to 5 MB")}
              </div>
            </div>
          </Section>

          <Section title="7. Ratings & Reviews">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Average Rating (1–5)" name="rating" type="number" min="0" step="0.1" value={formData.rating} onChange={handleChange} placeholder="0" />
            </div>
          </Section>

          <Section title="8. Inventory & Publishing">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Stock Quantity" name="total_stock" type="number" min="0" step="1" value={formData.total_stock} onChange={handleChange} placeholder="5" />
              <SelectField label="Stock Status" name="stock_status" value={formData.stock_status} onChange={handleChange} options={["In Stock", "Out of Stock", "Low Stock"]} />
              <Field label="Warehouse / Location" name="warehouse" value={formData.warehouse} onChange={handleChange} placeholder="Main Shop" />
              <SelectField label="Product Status" name="status" value={formData.status} onChange={handleChange} options={["Active", "Draft", "Inactive"]} />
            </div>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
              {[
                ["featured", "Featured Product"],
                ["new_arrival", "New Arrival"],
                ["best_seller", "Best Seller"]
              ].map(([name, label]) => (
                <label key={name} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" name={name} checked={Boolean(formData[name])} onChange={handleChange} className="h-4 w-4 accent-[#003B3B]" />
                  {label}
                </label>
              ))}
            </div>
          </Section>
        </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <section className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
            <header className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#063f36] to-[#0b6b5b] px-5 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><FiImage size={18} aria-hidden="true" /></span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-emerald-200">Live preview</p>
                  <h2 className="text-sm font-extrabold">Product snapshot</h2>
                </div>
              </div>
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white">{isEdit ? "Editing" : "New"}</span>
            </header>
            <div className="space-y-3 p-4">
              <div className="relative h-40 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-100 via-emerald-50 to-teal-100 sm:h-48">
                {formData.images[0] ? (
                  <img src={resolveBackendImageUrl(formData.images[0])} alt={formData.name || "Product preview"} className="h-full w-full object-contain p-2" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-slate-400">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/80 bg-white/80 text-slate-400 shadow-sm"><FiImage size={22} /></span>
                    <span className="mt-2 text-xs font-bold text-slate-600">Your product image appears here</span>
                    <span className="mt-1 text-[11px] text-slate-500">Upload photos in Media & Uploads</span>
                  </div>
                )}
                <span className="absolute left-3 top-3 rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-600 shadow-sm">Catalog preview</span>
              </div>

              <div className="min-w-0">
                <p className="truncate text-base font-extrabold text-slate-900">{formData.name || "Product name"}</p>
                <p className="mt-1 truncate text-xs font-medium text-slate-500">{formData.product_code || "SKU will appear here"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.category && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">{formData.category}</span>}
                  {formData.metal_type && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">{formData.metal_type}</span>}
                  {formData.purity && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{formData.purity}</span>}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-800">Final selling price</p>
                <p className="mt-1 text-2xl font-black tracking-tight text-emerald-950">{formatCurrency(pricing.finalPrice)}</p>
                <p className="mt-1 text-[11px] text-emerald-800/80">Based on metal rate, charges, and selected offer.</p>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Inventory</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{formData.total_stock || 0} units</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold ${formData.stock_status === "In Stock" ? "bg-emerald-100 text-emerald-800" : formData.stock_status === "Low Stock" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                  {formData.stock_status || "Out of Stock"}
                </span>
              </div>
            </div>
          </section>
          <section className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.045)]">
            <p className="text-sm font-extrabold text-slate-900">Ready to save?</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Review the product details and save to update your catalog.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => navigate(-1)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={loading || uploading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00695C] to-[#008577] px-3 py-3 text-sm font-extrabold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? <FiCheck /> : <FiSave />}
                {loading ? "Saving..." : isEdit ? "Update" : "Save Product"}
              </button>
            </div>
          </section>
          </div>
      </form>
    </div>
  );
};

export default AddProducts;

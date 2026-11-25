import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CreditCard, Eye, EyeOff, FileText, KeyRound, LoaderCircle, MapPin, Store, UserRound, X } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../api";

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const INDIAN_STATES_AND_UTS = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands",
  "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
  "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

function formatDate(value) {
  const [year, month, day] = value.split("-");
  const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1];
  return `${day} ${monthName} ${year}`;
}

function formatStoredDate(value) {
  const date = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? formatDate(date) : "—";
}

function mobileLoginPassword(value) {
  return String(value || "").replace(/[\s()-]/g, "").trim();
}

function validateField(name, value, isRequired = false) {
  const trimmed = String(value || "").trim();
  if (name === "mobile") {
    const mobile = trimmed.replace(/[\s()-]/g, "");
    if (!mobile) return "Mobile number is required.";
    return /^\+?[1-9]\d{9,14}$/.test(mobile) ? "" : "Enter a valid mobile number with 10–15 digits.";
  }
  if (name === "aadhaarNumber" && trimmed && !/^\d{12}$/.test(trimmed)) {
    return "Aadhaar number must contain exactly 12 digits.";
  }
  if (name === "gstNumber" && trimmed
    && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(trimmed)) {
    return "Enter a valid 15-character GSTIN.";
  }
  if (name === "pincode" && trimmed && !/^[1-9]\d{5}$/.test(trimmed)) {
    return "Pincode must be a valid 6-digit Indian postal code.";
  }
  if (name === "email") {
    if (!trimmed && isRequired) return "Email ID is required for shop login.";
    if (trimmed && (trimmed.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))) {
      return "Enter a valid email address.";
    }
  }
  return "";
}

function estimatedEndDate(startDate, duration) {
  const months = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12 }[duration];
  if (!months || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return "";
  const [year, month, day] = startDate.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  if (start.toISOString().slice(0, 10) !== startDate) return "";
  const end = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end.toISOString().slice(0, 10);
}

function createInitialForm(shop) {
  return {
    shopName: shop?.shop_name || "",
    ownerName: shop?.owner_name || "",
    mobile: shop?.mobile || "",
    email: shop?.email || "",
    loginUsername: shop?.owner_username || "",
    loginPassword: mobileLoginPassword(shop?.mobile),
    confirmPassword: mobileLoginPassword(shop?.mobile),
    aadhaarNumber: shop?.aadhaar_number || "",
    gstNumber: shop?.gst_number || "",
    address: shop?.address || "",
    city: shop?.city || "",
    state: shop?.state || "",
    pincode: shop?.pincode || "",
    maxBranches: shop?.max_branches || 1,
    maxStaff: shop?.max_staff || 1,
    notes: shop?.notes || "",
    status: shop?.status || "pending",
    planId: "",
    duration: "monthly",
    startDate: today()
  };
}

const inputClass = "mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100";
const labelClass = "text-xs font-semibold uppercase tracking-wide text-stone-600";

function Field({
  label, name, value, onChange, onBlur, error, required, type = "text", placeholder,
  min, max, maxLength, inputMode, autoCapitalize
}) {
  return (
    <label className={labelClass}>
      {label}{required && <span className="ml-1 text-rose-600">*</span>}
      <input
        className={`${inputClass} ${error ? "border-rose-500 focus:border-rose-500 focus:ring-rose-100" : ""}`}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        maxLength={maxLength}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
      />
      {error && <span id={`${name}-error`} className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-rose-700">{error}</span>}
    </label>
  );
}

function FileField({ label, name, accept, multiple = false, files, onChange, hint }) {
  const selectedFiles = Array.isArray(files) ? files : files ? [files] : [];
  return (
    <label className="block text-xs font-semibold text-stone-700">
      {label}
      <input
        className="mt-1.5 block w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-amber-900"
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        onChange={onChange}
      />
      <span className="mt-1 block text-[11px] font-normal text-stone-500">{hint}</span>
      {selectedFiles.length > 0 && (
        <span className="mt-1 block truncate text-[11px] font-medium text-emerald-700">
          {selectedFiles.map((file) => file.name).join(", ")}
        </span>
      )}
    </label>
  );
}

function PasswordField({ label, name, value, onChange, visible, onToggle, placeholder }) {
  return (
    <label className={`block ${labelClass}`}>
      {label}<span className="ml-1 text-rose-600">*</span>
      <span className="relative block">
        <input
          className={`${inputClass} pr-11`}
          type={visible ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          required
          placeholder={placeholder}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
    </label>
  );
}

const TABS = [
  { id: "personal", label: "Personal Details", icon: UserRound },
  { id: "shop", label: "Shop Details", icon: Store },
  { id: "subscription", label: "Subscription", icon: CreditCard },
  { id: "login", label: "Login Credential", icon: KeyRound }
];

export default function AddGoldShop({
  mode = "create",
  initialShop = null,
  plans = [],
  submitting = false,
  onCancel,
  onSubmit
}) {
  const [form, setForm] = useState(() => createInitialForm(initialShop));
  const [files, setFiles] = useState({ profilePhoto: null });
  const [existingDocuments, setExistingDocuments] = useState([]);
  const [shopDetails, setShopDetails] = useState(initialShop);
  const [shopDetailsLoading, setShopDetailsLoading] = useState(mode === "edit" && Boolean(initialShop?.id));
  const [shopDetailsError, setShopDetailsError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentLocation, setCurrentLocation] = useState("");
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const isEditing = mode === "edit";

  useEffect(() => {
    if (!isEditing || !initialShop?.id) return undefined;
    let active = true;
    api.get(`/super-admin/gold-shops/${initialShop.id}`)
      .then(({ data }) => {
        if (active) {
          setShopDetails(data.shop);
          setForm(createInitialForm(data.shop));
          setExistingDocuments(data.shop?.documents || []);
        }
      })
      .catch((error) => {
        if (active) {
          const message = error.response?.data?.message || "Could not load full shop details.";
          setShopDetailsError(message);
          toast.error(message);
        }
      })
      .finally(() => {
        if (active) setShopDetailsLoading(false);
      });
    return () => { active = false; };
  }, [initialShop?.id, isEditing]);

  const selectedPlanId = form.planId || (plans.length ? String(plans[0].id) : "");

  const selectedPlan = useMemo(
    () => plans.find((plan) => String(plan.id) === selectedPlanId),
    [selectedPlanId, plans]
  );
  const price = selectedPlan ? Number(selectedPlan[`${form.duration}_price`]) : 0;
  const endDate = estimatedEndDate(form.startDate, form.duration);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => {
      if (name !== "mobile") return { ...current, [name]: value };

      const currentMobilePassword = mobileLoginPassword(current.mobile);
      return {
        ...current,
        mobile: value,
        loginPassword: !current.loginPassword || current.loginPassword === currentMobilePassword
          ? mobileLoginPassword(value)
          : current.loginPassword,
        confirmPassword: !current.confirmPassword || current.confirmPassword === currentMobilePassword
          ? mobileLoginPassword(value)
          : current.confirmPassword
      };
    });
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
    setFormError("");
  };

  const handleFieldBlur = (event) => {
    const { name, value } = event.target;
    const error = validateField(name, value, name === "email" && !isEditing);
    setFieldErrors((current) => ({ ...current, [name]: error }));
  };

  const handleFileChange = (name, event) => {
    const selected = Array.from(event.target.files || []);
    if (selected.some((file) => file.size > 5 * 1024 * 1024)) {
      setFormError("Profile photos must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    if (selected.some((file) => !["image/jpeg", "image/png"].includes(file.type))) {
      setFormError("Profile photos must be JPG or PNG images.");
      event.target.value = "";
      return;
    }
    setFiles((current) => ({
      ...current,
      [name]: selected[0] || null
    }));
    setFormError("");
    event.target.value = "";
  };

  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not supported by this browser.");
      return;
    }
    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordinates = `Latitude: ${coords.latitude.toFixed(6)}, Longitude: ${coords.longitude.toFixed(6)}`;
        setCurrentLocation(coordinates);
        setFetchingLocation(false);
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. Allow location access in your browser and try again."
          : error.code === error.POSITION_UNAVAILABLE
            ? "Your current location is unavailable."
            : "Location request timed out. Please try again.";
        toast.error(message);
        setFetchingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const downloadDocument = async (document) => {
    try {
      const { data } = await api.get(
        `/super-admin/gold-shops/${initialShop.id}/documents/${document.id}`,
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(data);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.original_name;
      link.click();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not download this document.");
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (shopDetailsLoading || shopDetailsError) return;
    if (activeTabIndex !== TABS.length - 1) {
      setActiveTab(TABS[activeTabIndex + 1].id);
      setFormError("");
      return;
    }
    const fieldsToValidate = [
      ["mobile", "personal", true],
      ["aadhaarNumber", "personal", false],
      ["gstNumber", "shop", false],
      ["pincode", "shop", false],
      ["email", "login", !isEditing]
    ];
    const errors = {};
    for (const [name, tab, required] of fieldsToValidate) {
      const error = validateField(name, form[name], required);
      if (error) errors[name] = { message: error, tab };
    }
    setFieldErrors(Object.fromEntries(Object.entries(errors).map(([name, error]) => [name, error.message])));
    const firstInvalidField = fieldsToValidate.find(([name]) => errors[name]);
    if (firstInvalidField) {
      setActiveTab(firstInvalidField[1]);
      setFormError("Please correct the highlighted fields.");
      return;
    }
    const requiredFields = [
      ["ownerName", "personal", "Owner name is required."],
      ["shopName", "shop", "Shop name is required."]
    ];
    const missingField = requiredFields.find(([name]) => !String(form[name] || "").trim());
    if (missingField) {
      setActiveTab(missingField[1]);
      setFormError(missingField[2]);
      return;
    }
    if (!isEditing && (!selectedPlanId || !form.startDate)) {
      setActiveTab("subscription");
      setFormError("Select a subscription plan and start date.");
      return;
    }
    if (!isEditing && !/^[A-Za-z0-9._@+-]{3,150}$/.test(form.loginUsername.trim())) {
      setActiveTab("login");
      setFormError("Username must be 3 to 150 letters, numbers, or . _ @ + - characters.");
      return;
    }
    if (!isEditing && (form.loginPassword.length < 8 || new TextEncoder().encode(form.loginPassword).length > 72)) {
      setActiveTab("login");
      setFormError("Password must be at least 8 characters and no more than 72 bytes.");
      return;
    }
    if (!isEditing && form.loginPassword !== form.confirmPassword) {
      setActiveTab("login");
      setFormError("Password and confirm password do not match.");
      return;
    }
    const shop = {
      shopName: form.shopName.trim(),
      ownerName: form.ownerName.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim(),
      aadhaarNumber: form.aadhaarNumber.trim(),
      ...(isEditing ? {} : {
        credentials: {
          username: form.loginUsername.trim(),
          password: form.loginPassword
        }
      }),
      gstNumber: form.gstNumber.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      maxBranches: isEditing ? (initialShop?.max_branches || 1) : 1,
      maxStaff: isEditing ? (initialShop?.max_staff || 1) : 1,
      notes: form.notes.trim(),
      documents: files
    };
    if (!isEditing) {
      shop.subscription = {
        planId: Number(selectedPlanId),
        duration: form.duration,
        startDate: form.startDate
      };
    }
    onSubmit(shop);
  };

  const sectionClass = "rounded-2xl border border-stone-200 bg-white p-4 sm:p-5";
  const activeTabIndex = TABS.findIndex((tab) => tab.id === activeTab);

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="gold-shop-form-title"
        className="my-auto flex h-[calc(100vh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-[#fbfaf7] shadow-2xl sm:h-[calc(100vh-3rem)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-amber-100 bg-gradient-to-r from-[#13211d] to-[#26342d] px-5 py-5 text-white sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
              Gold Shops Management
            </p>
            <h2 id="gold-shop-form-title" className="mt-1 text-xl font-bold sm:text-2xl">
              {isEditing ? "Edit Gold Shop" : "Add New Gold Shop"}
            </h2>
            <p className="mt-1 text-sm text-white/65">
              {isEditing ? "Update owner, address, shop, and document information." : "Register a shop, login, and first subscription."}
            </p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close form" className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white">
            <X size={20} />
          </button>
        </header>

        <form noValidate onSubmit={(event) => submit(event)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {shopDetailsLoading && <p role="status" className="rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">Loading full shop details…</p>}
          {shopDetailsError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">Could not load full shop details. Close the form and try again.</p>}
          <fieldset disabled={shopDetailsLoading || Boolean(shopDetailsError)} className="contents">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1.5 sm:grid-cols-3 lg:grid-cols-5" role="tablist" aria-label="Gold shop form sections">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`gold-shop-tab-${id}`}
                aria-selected={activeTab === id}
                aria-controls={`gold-shop-panel-${id}`}
                onClick={() => { setActiveTab(id); setFormError(""); }}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-bold transition sm:px-3 ${activeTab === id ? "bg-white text-amber-900 shadow-sm" : "text-stone-600 hover:bg-white/70"}`}
              >
                <Icon size={15} />{label}
              </button>
            ))}
          </div>

          {formError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{formError}</p>}

            <section id="gold-shop-panel-personal" role="tabpanel" aria-labelledby="gold-shop-tab-personal" hidden={activeTab !== "personal"} className={sectionClass}>
              <h3 className="mb-4 font-bold text-stone-800">Personal Details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Owner name" name="ownerName" value={form.ownerName} onChange={handleChange} required placeholder="Full name" />
                <Field label="Mobile number" name="mobile" value={form.mobile} onChange={handleChange} onBlur={handleFieldBlur} error={fieldErrors.mobile} required type="tel" inputMode="tel" maxLength={20} placeholder="+919876543210" />
                <FileField label="Profile photo" name="profilePhoto" accept="image/png,image/jpeg,.png,.jpg,.jpeg" files={files.profilePhoto} onChange={(event) => handleFileChange("profilePhoto", event)} hint="JPG or PNG, up to 5 MB." />
                <Field label="Aadhaar number" name="aadhaarNumber" value={form.aadhaarNumber} onChange={handleChange} onBlur={handleFieldBlur} error={fieldErrors.aadhaarNumber} type="text" inputMode="numeric" maxLength={12} placeholder="12-digit Aadhaar number" />
              </div>
            </section>

            <section id="gold-shop-panel-shop" role="tabpanel" aria-labelledby="gold-shop-tab-shop" hidden={activeTab !== "shop"} className="space-y-4">
              <div className={sectionClass}>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-stone-800">Shop Details</h3>
                    <p className="mt-1 text-xs text-stone-500">The shop code is generated automatically when saved.</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold tracking-wide text-amber-800">GOLD-XXXX</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Shop name" name="shopName" value={form.shopName} onChange={handleChange} required placeholder="e.g. Sri Golds" />
                  <Field label="GST number" name="gstNumber" value={form.gstNumber} onChange={handleChange} onBlur={handleFieldBlur} error={fieldErrors.gstNumber} maxLength={15} autoCapitalize="characters" placeholder="15-character GSTIN" />
                  <div className="grid gap-4 sm:col-span-2 lg:grid-cols-3">
                    <Field label="City" name="city" value={form.city} onChange={handleChange} placeholder="City" />
                    <label className={labelClass}>
                      State
                      <select className={inputClass} name="state" value={form.state} onChange={handleChange}>
                        <option value="">Select state</option>
                        {INDIAN_STATES_AND_UTS.map((state) => <option key={state} value={state}>{state}</option>)}
                      </select>
                    </label>
                    <Field label="Pincode" name="pincode" value={form.pincode} onChange={handleChange} onBlur={handleFieldBlur} error={fieldErrors.pincode} inputMode="numeric" maxLength={6} placeholder="6-digit pincode" />
                  </div>
                  <label className={`${labelClass} sm:col-span-2`}>
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span>Shop address</span>
                      <button type="button" onClick={fetchCurrentLocation} disabled={fetchingLocation} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-2.5 py-1.5 text-[11px] font-bold normal-case tracking-normal text-amber-900 transition hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60">
                        <MapPin size={13} />{fetchingLocation ? "Fetching location…" : "Fetch current location"}
                      </button>
                    </span>
                    <textarea className={`${inputClass} min-h-24 resize-y`} name="address" value={form.address} onChange={handleChange} rows={3} placeholder="Street address" />
                    {currentLocation && <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-stone-500">{currentLocation}. Enter the street address, city, state, and pincode manually; coordinates are not sent to an external service.</span>}
                  </label>
                  <label className={`${labelClass} sm:col-span-2`}>
                    Admin notes
                    <textarea className={`${inputClass} min-h-20 resize-y`} name="notes" value={form.notes} onChange={handleChange} rows={2} placeholder="Internal notes about this shop" />
                  </label>
                </div>
                {existingDocuments.length > 0 && (
                  <div className="mt-5 border-t border-stone-100 pt-4">
                    <h4 className="mb-2 text-xs font-bold text-stone-700">Previously uploaded documents</h4>
                    <ul className="space-y-2">
                      {existingDocuments.map((document) => (
                        <li key={document.id} className="flex items-center justify-between gap-3 text-xs">
                          <span className="flex min-w-0 items-center gap-2 truncate text-stone-600"><FileText size={14} />{document.original_name}</span>
                          <button type="button" onClick={() => downloadDocument(document)} className="shrink-0 font-bold text-amber-800 hover:underline">Download</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {isEditing && <p className="text-xs text-stone-500">Current status: <span className="font-semibold capitalize text-stone-700">{initialShop?.status || "unknown"}</span>. Change status from the shop actions.</p>}
            </section>

            <section id="gold-shop-panel-subscription" role="tabpanel" aria-labelledby="gold-shop-tab-subscription" hidden={activeTab !== "subscription"} className={sectionClass}>
              <h3 className="mb-4 font-bold text-stone-800">Subscription Details</h3>
              {isEditing ? (
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3"><p className={labelClass}>Plan</p><p className="mt-1 font-semibold text-stone-800">{shopDetails?.plan_name || "No plan"}</p></div>
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3"><p className={labelClass}>Duration</p><p className="mt-1 font-semibold capitalize text-stone-800">{shopDetails?.duration?.replace("_", " ") || "—"}</p></div>
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3"><p className={labelClass}>Amount</p><p className="mt-1 font-semibold text-stone-800">{shopDetails?.subscription_amount == null ? "—" : `₹${Number(shopDetails.subscription_amount).toLocaleString("en-IN")}`}</p></div>
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3"><p className={labelClass}>Payment status</p><p className="mt-1 font-semibold capitalize text-stone-800">{shopDetails?.payment_status || "—"}</p></div>
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3"><p className={labelClass}>Start date</p><p className="mt-1 font-semibold text-stone-800">{formatStoredDate(shopDetails?.start_date)}</p></div>
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3"><p className={labelClass}>Expiry date</p><p className="mt-1 font-semibold text-stone-800">{formatStoredDate(shopDetails?.end_date)}</p></div>
                  <p className="text-xs text-stone-500 sm:col-span-2">Use Change Subscription from the shop actions to modify this subscription.</p>
                </div>
              ) : (
                <>
                  <p className="mb-4 text-xs text-stone-500">Price is read from the selected plan; payment remains pending until confirmed.</p>
                  {!plans.length ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">No active subscription plans are available.</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className={labelClass}>
                        Subscription plan<span className="ml-1 text-rose-600">*</span>
                        <select className={inputClass} name="planId" value={selectedPlanId} onChange={handleChange}>
                          {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.plan_name}</option>)}
                        </select>
                      </label>
                      <label className={labelClass}>
                        Duration<span className="ml-1 text-rose-600">*</span>
                        <select className={inputClass} name="duration" value={form.duration} onChange={handleChange}>
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="half_yearly">Half-Yearly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </label>
                      <div className="rounded-xl bg-amber-50 p-3"><p className={labelClass}>Subscription price</p><p className="mt-1 text-xl font-bold text-amber-900">{Number.isFinite(price) ? `₹${price.toLocaleString("en-IN")}` : "Not configured"}</p></div>
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3"><p className={labelClass}>Estimated end date</p><p className="mt-1 text-sm font-semibold text-stone-800">{endDate ? formatDate(endDate) : "Select a valid start date"}</p></div>
                      <label className={labelClass}>
                        Start date<span className="ml-1 text-rose-600">*</span>
                        <span className="relative block"><CalendarDays className="absolute right-3 top-4 h-4 w-4 text-stone-400" /><input className={inputClass} type="date" name="startDate" value={form.startDate} onChange={handleChange} /></span>
                      </label>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className={labelClass}>Approval status</p><p className="mt-1 text-sm font-semibold text-amber-800">{isEditing ? (shopDetails?.approval_status || "Pending") : "Pending"}</p></div>
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3"><p className={labelClass}>Payment status</p><p className="mt-1 text-sm font-semibold text-amber-800">Pending Super Admin confirmation</p></div>
                    </div>
                  )}
                </>
              )}
            </section>

            <section id="gold-shop-panel-login" role="tabpanel" aria-labelledby="gold-shop-tab-login" hidden={activeTab !== "login"} className={sectionClass}>
              <h3 className="mb-4 font-bold text-stone-800">Login Credential</h3>
              {isEditing ? (
                <div className="space-y-3">
                  <p className="text-sm text-stone-600">Login credentials are not displayed or changed here.</p>
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
                    <p>Username: <span className="font-semibold">{shopDetails?.owner_username || "Not assigned"}</span></p>
                    <p className="mt-1">Email: <span className="font-semibold">{shopDetails?.owner_email || shopDetails?.email || "Not assigned"}</span></p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Email ID" name="email" value={form.email} onChange={handleChange} onBlur={handleFieldBlur} error={fieldErrors.email} required={!isEditing} type="email" maxLength={255} placeholder="owner@example.com" />
                  <Field label="Username" name="loginUsername" value={form.loginUsername} onChange={handleChange} required placeholder="e.g. sri-golds-admin" />
                  <PasswordField label="Password" name="loginPassword" value={form.loginPassword} onChange={handleChange} visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} placeholder="At least 8 characters" />
                  <PasswordField label="Confirm password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((visible) => !visible)} placeholder="Re-enter the password" />
                  <p className="text-xs text-stone-500 sm:col-span-2">The mobile number is used as the default password and updates automatically when the number changes. You can enter a different password. Using a phone number as a password is less secure. The login account is created only after approval; passwords are stored as secure hashes.</p>
                </div>
              )}
            </section>
          </fieldset>
          </div>

          <footer className="flex shrink-0 justify-between gap-3 border-t border-stone-200 bg-[#fbfaf7] px-4 py-4 sm:px-6">
            <button type="button" disabled={shopDetailsLoading || Boolean(shopDetailsError) || activeTabIndex === 0} onClick={() => { setActiveTab(TABS[activeTabIndex - 1].id); setFormError(""); }} className="rounded-xl border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 disabled:opacity-40">Previous</button>
            {activeTabIndex === TABS.length - 1 ? (
              <button type="submit" disabled={submitting || shopDetailsLoading || Boolean(shopDetailsError) || (!isEditing && !plans.length)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-900/10 transition hover:from-amber-700 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Save Gold Shop"}
              </button>
            ) : (
              <button type="button" disabled={shopDetailsLoading || Boolean(shopDetailsError)} onClick={() => { setActiveTab(TABS[activeTabIndex + 1].id); setFormError(""); }} className="rounded-xl bg-stone-800 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                Save &amp; Next
              </button>
            )}
          </footer>
        </form>
      </section>
    </div>
  );
}
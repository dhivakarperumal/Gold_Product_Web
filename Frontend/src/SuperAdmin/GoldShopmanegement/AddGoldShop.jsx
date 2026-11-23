import { useMemo, useState } from "react";
import { CalendarDays, LoaderCircle, X } from "lucide-react";

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function formatDate(value) {
  const [year, month, day] = value.split("-");
  const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1];
  return `${day} ${monthName} ${year}`;
}

function estimatedEndDate(startDate, duration) {
  const months = { monthly: 1, quarterly: 3, yearly: 12 }[duration];
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

function Field({ label, name, value, onChange, required, type = "text", placeholder, min, max }) {
  return (
    <label className={labelClass}>
      {label}{required && <span className="ml-1 text-rose-600">*</span>}
      <input
        className={inputClass}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
      />
    </label>
  );
}

export default function AddGoldShop({
  mode = "create",
  initialShop = null,
  plans = [],
  submitting = false,
  onCancel,
  onSubmit
}) {
  const [form, setForm] = useState(() => createInitialForm(initialShop));
  const isEditing = mode === "edit";

  const selectedPlanId = form.planId || (plans.length ? String(plans[0].id) : "");

  const selectedPlan = useMemo(
    () => plans.find((plan) => String(plan.id) === selectedPlanId),
    [selectedPlanId, plans]
  );
  const price = selectedPlan ? Number(selectedPlan[`${form.duration}_price`]) : 0;
  const endDate = estimatedEndDate(form.startDate, form.duration);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submit = (event, addAnother = false) => {
    event.preventDefault();
    if (addAnother && !event.currentTarget.form?.reportValidity()) return;
    const shop = {
      shopName: form.shopName.trim(),
      ownerName: form.ownerName.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim(),
      gstNumber: form.gstNumber.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      maxBranches: Number(form.maxBranches),
      maxStaff: Number(form.maxStaff),
      notes: form.notes.trim()
    };
    if (!isEditing) {
      shop.status = form.status;
      shop.subscription = {
        planId: Number(selectedPlanId),
        duration: form.duration,
        startDate: form.startDate
      };
    }
    onSubmit(shop, addAnother);
  };

  const sectionClass = "rounded-2xl border border-stone-200 bg-white p-4 sm:p-5";

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="gold-shop-form-title"
        className="my-auto w-full max-w-4xl overflow-hidden rounded-3xl bg-[#fbfaf7] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-amber-100 bg-gradient-to-r from-[#13211d] to-[#26342d] px-5 py-5 text-white sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
              Gold Shops Management
            </p>
            <h2 id="gold-shop-form-title" className="mt-1 text-xl font-bold sm:text-2xl">
              {isEditing ? "Edit Gold Shop" : "Add New Gold Shop"}
            </h2>
            <p className="mt-1 text-sm text-white/65">
              {isEditing ? "Update shop and account-limit information." : "Register a shop and create its first subscription."}
            </p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close form" className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={(event) => submit(event)} className="max-h-[calc(100vh-9rem)] space-y-4 overflow-y-auto p-4 sm:p-6">
          <section className={sectionClass}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-stone-800">Shop information</h3>
                <p className="mt-1 text-xs text-stone-500">The shop code is generated automatically when saved.</p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold tracking-wide text-amber-800">GOLD-XXXX</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Shop name" name="shopName" value={form.shopName} onChange={handleChange} required placeholder="e.g. Sri Golds" />
              <Field label="Owner name" name="ownerName" value={form.ownerName} onChange={handleChange} required placeholder="Full name" />
              <Field label="Mobile number" name="mobile" value={form.mobile} onChange={handleChange} required type="tel" placeholder="+919876543210" />
              <Field label="Email address" name="email" value={form.email} onChange={handleChange} type="email" placeholder="owner@example.com" />
              <Field label="GST number" name="gstNumber" value={form.gstNumber} onChange={handleChange} placeholder="15-character GSTIN" />
              <Field label="Pincode" name="pincode" value={form.pincode} onChange={handleChange} placeholder="Postal code" />
              <Field label="City" name="city" value={form.city} onChange={handleChange} placeholder="City" />
              <Field label="State" name="state" value={form.state} onChange={handleChange} placeholder="State" />
              <label className={`${labelClass} sm:col-span-2`}>
                Shop address
                <textarea className={`${inputClass} min-h-20 resize-y`} name="address" value={form.address} onChange={handleChange} rows={2} placeholder="Street address" />
              </label>
            </div>
          </section>

          {!isEditing && (
            <section className={sectionClass}>
              <div className="mb-4">
                <h3 className="font-bold text-stone-800">Subscription details</h3>
                <p className="mt-1 text-xs text-stone-500">Price is read from the selected plan; payment remains pending until the gateway confirms it.</p>
              </div>
              {!plans.length ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
                  No active subscription plans are available.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Subscription plan<span className="ml-1 text-rose-600">*</span>
                    <select className={inputClass} name="planId" value={selectedPlanId} onChange={handleChange} required>
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
                  <div className="rounded-xl bg-amber-50 p-3">
                    <p className={labelClass}>Subscription price</p>
                    <p className="mt-1 text-xl font-bold text-amber-900">
                      {Number.isFinite(price) ? `₹${price.toLocaleString("en-IN")}` : "Not configured"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                    <p className={labelClass}>Estimated end date</p>
                    <p className="mt-1 text-sm font-semibold text-stone-800">
                      {endDate ? formatDate(endDate) : "Select a valid start date"}
                    </p>
                  </div>
                  <label className={labelClass}>
                    Start date<span className="ml-1 text-rose-600">*</span>
                    <span className="relative block">
                      <CalendarDays className="absolute right-3 top-4 h-4 w-4 text-stone-400" />
                      <input className={inputClass} type="date" name="startDate" value={form.startDate} onChange={handleChange} required />
                    </span>
                  </label>
                  <label className={labelClass}>
                    Shop status
                    <select className={inputClass} name="status" value={form.status} onChange={handleChange}>
                      <option value="pending">Pending</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </label>
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                    <p className={labelClass}>Payment status</p>
                    <p className="mt-1 text-sm font-semibold text-amber-800">Pending gateway confirmation</p>
                    <p className="mt-1 text-xs text-stone-500">The frontend cannot mark a payment as paid.</p>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className={sectionClass}>
            <h3 className="mb-4 font-bold text-stone-800">Additional settings</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Maximum branches" name="maxBranches" value={form.maxBranches} onChange={handleChange} required type="number" min="1" max="100000" />
              <Field label="Maximum staff accounts" name="maxStaff" value={form.maxStaff} onChange={handleChange} required type="number" min="1" max="100000" />
              <label className={`${labelClass} sm:col-span-2`}>
                Admin notes
                <textarea className={`${inputClass} min-h-20 resize-y`} name="notes" value={form.notes} onChange={handleChange} rows={2} placeholder="Internal notes about this shop" />
              </label>
              {isEditing && (
                <p className="text-xs text-stone-500 sm:col-span-2">
                  Current status: <span className="font-semibold capitalize text-stone-700">{initialShop?.status || "unknown"}</span>. Change status from the shop actions.
                </p>
              )}
            </div>
          </section>

          <footer className="flex flex-col-reverse gap-3 border-t border-stone-200 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-100">
              Cancel
            </button>
            {!isEditing && (
              <button type="button" onClick={() => setForm(createInitialForm(null))} className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-100">
                Reset
              </button>
            )}
            {!isEditing && (
              <button type="button" disabled={submitting || !plans.length} onClick={(event) => submit(event, true)} className="rounded-xl border border-amber-300 px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50">
                Save &amp; Add Another
              </button>
            )}
            <button type="submit" disabled={submitting || (!isEditing && !plans.length)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-900/10 transition hover:from-amber-700 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Save Gold Shop"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
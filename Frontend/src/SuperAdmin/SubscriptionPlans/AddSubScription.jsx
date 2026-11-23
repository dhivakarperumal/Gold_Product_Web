import { useMemo, useState } from "react";
import { LoaderCircle, X } from "lucide-react";

const FEATURE_OPTIONS = [
  ["goldInventory", "Gold Inventory"],
  ["silverInventory", "Silver Inventory"],
  ["purchaseManagement", "Purchase Management"],
  ["salesBilling", "Sales & Billing"],
  ["customerManagement", "Customer Management"],
  ["supplierManagement", "Supplier Management"],
  ["goldRateManagement", "Gold Rate Management"],
  ["stockManagement", "Stock Management"],
  ["barcodeManagement", "Barcode Management"],
  ["invoicePrinting", "Invoice Printing"],
  ["reportsAnalytics", "Reports & Analytics"],
  ["backupExport", "Backup & Export"]
];

const EMPTY_FEATURES = Object.fromEntries(FEATURE_OPTIONS.map(([key]) => [key, false]));

const EMPTY = {
  planName: "",
  planCode: "",
  description: "",
  monthlyPrice: "",
  quarterlyPrice: "",
  halfYearlyPrice: "",
  yearlyPrice: "",
  setupFee: "",
  freeTrialDays: 0,
  maxBranches: "",
  maxStaff: "",
  maxUsers: "",
  maxProducts: "",
  maxMonthlyInvoices: "",
  gracePeriodDays: 0,
  status: "active",
  isFeatured: false,
  displayOrder: 0,
  features: EMPTY_FEATURES
};

const inputClass = "mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#008577]";
const labelClass = "block text-[11px] font-semibold text-slate-700";

function numberField(label, name, value, onChange, min = 0) {
  return (
    <label className={labelClass}>
      {label}
      <input type="number" min={min} step={name.includes("Price") || name === "setupFee" ? "0.01" : "1"} name={name} value={value} onChange={onChange} className={inputClass} />
    </label>
  );
}

export default function AddSubScription({ initialPlan = null, mode = "create", submitting = false, onCancel, onSubmit }) {
  const [form, setForm] = useState(() => initialPlan ? {
      planName: initialPlan.plan_name || "",
      planCode: initialPlan.plan_code || "",
      description: initialPlan.description || "",
      monthlyPrice: initialPlan.monthly_price ?? "",
      quarterlyPrice: initialPlan.quarterly_price ?? "",
      halfYearlyPrice: initialPlan.half_yearly_price ?? "",
      yearlyPrice: initialPlan.yearly_price ?? "",
      setupFee: initialPlan.setup_fee ?? 0,
      freeTrialDays: initialPlan.free_trial_days ?? 0,
      maxBranches: initialPlan.max_branches ?? "",
      maxStaff: initialPlan.max_staff ?? "",
      maxUsers: initialPlan.max_users ?? "",
      maxProducts: initialPlan.max_products ?? "",
      maxMonthlyInvoices: initialPlan.max_monthly_invoices ?? "",
      gracePeriodDays: initialPlan.grace_period_days ?? 0,
      status: initialPlan.status || "active",
      isFeatured: Boolean(initialPlan.is_featured),
      displayOrder: initialPlan.display_order ?? 0,
      features: { ...EMPTY_FEATURES, ...(initialPlan.features || {}) }
    } : EMPTY);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const payload = useMemo(() => ({
    planName: form.planName,
    planCode: form.planCode,
    description: form.description,
    monthlyPrice: Number(form.monthlyPrice || 0),
    quarterlyPrice: Number(form.quarterlyPrice || 0),
    halfYearlyPrice: Number(form.halfYearlyPrice || 0),
    yearlyPrice: Number(form.yearlyPrice || 0),
    setupFee: Number(form.setupFee || 0),
    freeTrialDays: Number(form.freeTrialDays || 0),
    maxBranches: form.maxBranches === "" ? null : Number(form.maxBranches),
    maxStaff: form.maxStaff === "" ? null : Number(form.maxStaff),
    maxUsers: form.maxUsers === "" ? null : Number(form.maxUsers),
    maxProducts: form.maxProducts === "" ? null : Number(form.maxProducts),
    maxMonthlyInvoices: form.maxMonthlyInvoices === "" ? null : Number(form.maxMonthlyInvoices),
    gracePeriodDays: Number(form.gracePeriodDays || 0),
    status: form.status,
    isFeatured: form.isFeatured,
    displayOrder: Number(form.displayOrder || 0),
    features: form.features
  }), [form]);

  const submit = (event) => {
    event.preventDefault();
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
      <section role="dialog" aria-modal="true" aria-label={mode === "edit" ? "Edit subscription plan" : "Create subscription plan"} className="my-auto w-full max-w-5xl overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
        <header className="flex items-start justify-between gap-4 bg-[#153B35] px-5 py-4 text-white">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">Subscription Plans</p>
            <h2 className="mt-1 text-xl font-black">{mode === "edit" ? "Edit Subscription Plan" : "Create New Plan"}</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-full p-2 text-white/70 hover:bg-white/10"><X size={20} /></button>
        </header>
        <form onSubmit={submit} className="max-h-[calc(100vh-8rem)] overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-extrabold text-slate-900">Basic Information</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className={labelClass}>Plan Name <span className="text-rose-600">*</span><input required maxLength={80} name="planName" value={form.planName} onChange={handleChange} placeholder="Enterprise" className={inputClass} /></label>
                  <label className={labelClass}>Plan Code <span className="text-slate-400">(auto if blank)</span><input maxLength={50} name="planCode" value={form.planCode} onChange={handleChange} placeholder="ENTERPRISE-01" className={inputClass} /></label>
                  <label className={`${labelClass} sm:col-span-2`}>Description<textarea maxLength={5000} name="description" value={form.description} onChange={handleChange} rows="3" placeholder="Describe this subscription plan..." className={`${inputClass} resize-y`} /></label>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-extrabold text-slate-900">Plan Pricing</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {numberField("Monthly Price (₹)", "monthlyPrice", form.monthlyPrice, handleChange)}
                  {numberField("Quarterly Price (₹)", "quarterlyPrice", form.quarterlyPrice, handleChange)}
                  {numberField("Half-Yearly Price (₹)", "halfYearlyPrice", form.halfYearlyPrice, handleChange)}
                  {numberField("Yearly Price (₹)", "yearlyPrice", form.yearlyPrice, handleChange)}
                  {numberField("Setup Fee (₹)", "setupFee", form.setupFee, handleChange)}
                  {numberField("Free Trial Days", "freeTrialDays", form.freeTrialDays, handleChange)}
                </div>
                </section>
                <div className="mt-3 space-y-3">
                  <label className={labelClass}>Plan Status<select name="status" value={form.status} onChange={handleChange} className={inputClass}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                </div>
              
            </div>

            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-extrabold text-slate-900">Feature Permissions</h3>
                <div className="mt-3 space-y-1">
                  {FEATURE_OPTIONS.map(([key, label]) => (
                    <label key={key} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 text-xs text-slate-700 hover:bg-slate-50">
                      <span>{label}</span>
                      <input type="checkbox" checked={Boolean(form.features[key])} onChange={(event) => setForm((current) => ({ ...current, features: { ...current.features, [key]: event.target.checked } }))} className="h-4 w-4 accent-emerald-700" />
                    </label>
                  ))}
                </div>
              </section>
              
            </div>
          </div>

          <footer className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onCancel} className="min-h-9 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-700">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#00796B] px-4 text-xs font-bold text-white disabled:opacity-50">
              {submitting && <LoaderCircle size={14} className="animate-spin" />}
              {mode === "edit" ? "Save Changes" : "Create Plan"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
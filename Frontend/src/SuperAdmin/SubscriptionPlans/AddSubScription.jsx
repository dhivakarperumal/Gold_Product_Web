import CustomSelect from "../../Components/CustomSelect.jsx";
import { useMemo, useState } from "react";
import { BadgeCheck, Building2, CircleDollarSign, Layers3, LoaderCircle, Settings2, ShieldCheck, Sparkles, X } from "lucide-react";

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

const inputClass = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#008577] focus:bg-white focus:ring-4 focus:ring-emerald-100/70";
const labelClass = "block min-w-0 text-[11px] font-bold text-slate-600";

function numberField(label, name, value, onChange, min = 0, placeholder = "0") {
  return (
    <label className={labelClass}>
      {label}
      <input type="number" min={min} step={name.includes("Price") || name === "setupFee" ? "0.01" : "1"} name={name} value={value} placeholder={placeholder} onChange={onChange} className={inputClass} />
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

  const selectedFeatureCount = FEATURE_OPTIONS.filter(([key]) => Boolean(form.features[key])).length;
  const allFeaturesEnabled = selectedFeatureCount === FEATURE_OPTIONS.length;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscription-plan-dialog-title"
        className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-[#F6F9F7] shadow-2xl shadow-slate-950/40 sm:max-h-[calc(100dvh-3rem)]"
      >
        <header className="relative isolate flex shrink-0 items-center justify-between gap-4 overflow-hidden rounded-t-3xl bg-gradient-to-r from-[#063B35] via-[#075F54] to-[#0D776D] px-5 py-4 text-white sm:px-7 sm:py-5">
          <span aria-hidden="true" className="absolute -right-8 -top-20 h-48 w-48 rounded-full border border-white/10 bg-white/5" />
          <div className="relative flex min-w-0 items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-amber-200 shadow-inner">
              <Layers3 size={23} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Subscription Plans · Control Center</p>
              <h2 id="subscription-plan-dialog-title" className="mt-1 truncate text-lg font-black sm:text-xl">{mode === "edit" ? "Edit Subscription Plan" : "Create New Plan"}</h2>
              <p className="mt-1 text-xs text-emerald-50/80">{mode === "edit" ? "Update pricing, access, and plan limits." : "Configure pricing, access, and plan limits."}</p>
            </div>
          </div>
          <div className="relative flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white/90 sm:inline-flex">
              <Sparkles size={13} className="text-amber-200" />
              {mode === "edit" ? "Plan settings" : "New plan"}
            </span>
            <button type="button" onClick={onCancel} aria-label="Close plan form" className="rounded-xl p-2.5 text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"><X size={19} /></button>
          </div>
        </header>

        <form onSubmit={submit} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]">
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><Layers3 size={18} /></span>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Basic information</h3>
                    <p className="mt-0.5 text-[10px] text-slate-500">Name and identify this subscription plan.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className={labelClass}>Plan Name <span className="text-rose-600">*</span><input required maxLength={80} name="planName" value={form.planName} onChange={handleChange} placeholder="Enterprise" className={inputClass} /></label>
                  <label className={labelClass}>Plan Code <span className="text-slate-400">(auto if blank)</span><input maxLength={50} name="planCode" value={form.planCode} onChange={handleChange} placeholder="ENTERPRISE-01" className={inputClass} /></label>
                  <div className={labelClass}>
                    Plan Status
                    <CustomSelect aria-label="Plan status" name="status" value={form.status} onChange={handleChange} className={inputClass}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </CustomSelect>
                  </div>
                  <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>Description<textarea maxLength={5000} name="description" value={form.description} onChange={handleChange} rows="3" placeholder="Describe this subscription plan..." className={`${inputClass} min-h-24 resize-y`} /></label>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-800"><CircleDollarSign size={18} /></span>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Plan pricing</h3>
                    <p className="mt-0.5 text-[10px] text-slate-500">Set the billing amount for each renewal period.</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {numberField("Monthly Price (₹)", "monthlyPrice", form.monthlyPrice, handleChange)}
                  {numberField("Quarterly Price (₹)", "quarterlyPrice", form.quarterlyPrice, handleChange)}
                  {numberField("Half-Yearly Price (₹)", "halfYearlyPrice", form.halfYearlyPrice, handleChange)}
                  {numberField("Yearly Price (₹)", "yearlyPrice", form.yearlyPrice, handleChange)}
                  {numberField("Setup Fee (₹)", "setupFee", form.setupFee, handleChange)}
                  {numberField("Free Trial Days", "freeTrialDays", form.freeTrialDays, handleChange)}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-800"><Building2 size={18} /></span>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Plan limits</h3>
                    <p className="mt-0.5 text-[10px] text-slate-500">Leave a limit blank to allow unlimited usage.</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {numberField("Max Branches", "maxBranches", form.maxBranches, handleChange, 0, "Unlimited")}
                  {numberField("Max Staff", "maxStaff", form.maxStaff, handleChange, 0, "Unlimited")}
                  {numberField("Max Users", "maxUsers", form.maxUsers, handleChange, 0, "Unlimited")}
                  {numberField("Max Products", "maxProducts", form.maxProducts, handleChange, 0, "Unlimited")}
                  {numberField("Monthly Invoices", "maxMonthlyInvoices", form.maxMonthlyInvoices, handleChange, 0, "Unlimited")}
                  {numberField("Grace Period (days)", "gracePeriodDays", form.gracePeriodDays, handleChange)}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-800"><Settings2 size={18} /></span>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Plan settings</h3>
                    <p className="mt-0.5 text-[10px] text-slate-500">Control how the plan is highlighted and ordered.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {numberField("Display Order", "displayOrder", form.displayOrder, handleChange)}
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-amber-100 bg-gradient-to-r from-amber-50/80 to-white px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800"><BadgeCheck size={16} /></span>
                      <span>
                        <span className="block text-[11px] font-bold text-slate-700">Featured plan</span>
                        <span className="mt-0.5 block text-[9px] text-slate-500">Highlight this plan</span>
                      </span>
                    </span>
                    <input type="checkbox" name="isFeatured" checked={form.isFeatured} onChange={handleChange} className="h-4 w-4 shrink-0 accent-amber-600" />
                  </label>
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><ShieldCheck size={18} /></span>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Feature permissions</h3>
                    <p className="mt-0.5 text-[10px] text-slate-500">Choose what shops can access.</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800 ring-1 ring-inset ring-emerald-100">{selectedFeatureCount}/{FEATURE_OPTIONS.length}</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] font-semibold text-slate-400">Included features</span>
                <button type="button" onClick={() => setForm((current) => ({ ...current, features: Object.fromEntries(FEATURE_OPTIONS.map(([key]) => [key, !allFeaturesEnabled])) }))} className="text-[10px] font-bold text-emerald-800 transition hover:text-emerald-600">
                  {allFeaturesEnabled ? "Clear all" : "Select all"}
                </button>
              </div>
              <div className="mt-3 space-y-1.5">
                {FEATURE_OPTIONS.map(([key, label]) => {
                  const enabled = Boolean(form.features[key]);
                  return (
                    <label key={key} className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs transition ${enabled ? "border-emerald-100 bg-emerald-50/70 text-emerald-950" : "border-transparent text-slate-600 hover:border-slate-100 hover:bg-slate-50"}`}>
                      <span className="font-semibold">{label}</span>
                      <input type="checkbox" checked={enabled} onChange={(event) => setForm((current) => ({ ...current, features: { ...current.features, [key]: event.target.checked } }))} className="h-4 w-4 shrink-0 accent-emerald-700" />
                    </label>
                  );
                })}
              </div>
            </section>
          </div>

          <footer className="sticky bottom-0 z-20 -mx-4 -mb-4 mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
            <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00695C] to-[#008577] px-5 text-xs font-extrabold text-white shadow-md shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <LoaderCircle size={15} className="animate-spin" />}
              {mode === "edit" ? "Save Changes" : "Create Plan"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
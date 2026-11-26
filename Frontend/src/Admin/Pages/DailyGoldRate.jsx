import CustomSelect from "../../Components/CustomSelect.jsx";
import { useCallback, useEffect, useState } from "react";
import { FiActivity, FiCalendar, FiCheckCircle, FiChevronLeft, FiChevronRight, FiClock, FiEdit2, FiEye, FiLayers, FiPlus, FiSave, FiTrash2, FiX } from "react-icons/fi";
import { toast } from "react-hot-toast";
import api from "../../api";
import { formatRateDate } from "../../PrivateRouter/goldRateUtils";
import useGoldRates from "../../PrivateRouter/useGoldRates";
import { formatCurrency as currency } from "../../utils/currency";

const RATE_FIELDS = [
  { key: "gold_999", label: "Gold 24K (999)", metal: "Gold", purity: "999", unit: "gram" },
  { key: "gold_916", label: "Gold 22K (916)", metal: "Gold", purity: "916", unit: "gram" },
  { key: "gold_833", label: "Gold 20K (833)", metal: "Gold", purity: "833", unit: "gram" },
  { key: "gold_750", label: "Gold 18K (750)", metal: "Gold", purity: "750", unit: "gram" },
  { key: "gold_585", label: "Gold 14K (585)", metal: "Gold", purity: "585", unit: "gram" },
  { key: "silver_999", label: "Silver 999", metal: "Silver", purity: "999", unit: "gram" },
  { key: "platinum_950", label: "Platinum 950", metal: "Platinum", purity: "950", unit: "gram" },
  { key: "platinum_900", label: "Platinum 900", metal: "Platinum", purity: "900", unit: "gram" },
  { key: "diamond_df_vvs", label: "Diamond D–F / VVS", metal: "Diamond", purity: "D-F / VVS", unit: "carat" },
  { key: "diamond_gh_vs", label: "Diamond G–H / VS", metal: "Diamond", purity: "G-H / VS", unit: "carat" },
  { key: "diamond_ij_si", label: "Diamond I–J / SI", metal: "Diamond", purity: "I-J / SI", unit: "carat" }
];
const RATE_METALS = ["Gold", "Silver", "Platinum", "Diamond"];
const METAL_THEMES = {
  Gold: {
    symbol: "Au",
    panel: "border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-white to-yellow-50/70",
    badge: "bg-gradient-to-br from-amber-400 to-orange-500 text-white",
    count: "bg-amber-100 text-amber-800",
    tile: "border-amber-200/70 bg-white/90 hover:border-amber-300",
    value: "text-amber-950",
    marker: "bg-amber-500"
  },
  Silver: {
    symbol: "Ag",
    panel: "border-sky-200/80 bg-gradient-to-br from-sky-50/90 via-white to-cyan-50/70",
    badge: "bg-gradient-to-br from-sky-400 to-cyan-600 text-white",
    count: "bg-sky-100 text-sky-800",
    tile: "border-sky-200/70 bg-white/90 hover:border-sky-300",
    value: "text-sky-950",
    marker: "bg-sky-500"
  },
  Platinum: {
    symbol: "Pt",
    panel: "border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-indigo-50/70",
    badge: "bg-gradient-to-br from-violet-500 to-indigo-600 text-white",
    count: "bg-violet-100 text-violet-800",
    tile: "border-violet-200/70 bg-white/90 hover:border-violet-300",
    value: "text-violet-950",
    marker: "bg-violet-500"
  },
  Diamond: {
    symbol: "D",
    panel: "border-fuchsia-200/80 bg-gradient-to-br from-fuchsia-50/90 via-white to-pink-50/70",
    badge: "bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white",
    count: "bg-fuchsia-100 text-fuchsia-800",
    tile: "border-fuchsia-200/70 bg-white/90 hover:border-fuchsia-300",
    value: "text-fuchsia-950",
    marker: "bg-fuchsia-500"
  }
};

const inputClassName = "mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#008577] focus:ring-4 focus:ring-emerald-100";
const HISTORY_PAGE_SIZE = 10;

const localDate = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const localDateTime = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

function blankForm() {
  const now = new Date();
  return {
    id: null,
    expected_updated_at: null,
    expected_version: null,
    status: "Draft",
    created_by: null,
    created_by_name: "",
    created_at: null,
    updated_by: null,
    updated_by_name: "",
    updated_at: null,
    rate_date: localDate(now),
    effective_from: localDateTime(now),
    making_charge_type: "Percentage",
    making_charge_value: "",
    wastage_percentage: "",
    reason: "",
    rates: Object.fromEntries(RATE_FIELDS.map(({ key }) => [key, ""]))
  };
}

function formFromBatch(batch) {
  return {
    ...blankForm(),
    id: batch.id,
    expected_updated_at: batch.updated_at,
    expected_version: batch.version,
    status: batch.status,
    created_by: batch.created_by,
    created_by_name: batch.created_by_name || "",
    created_at: batch.created_at,
    updated_by: batch.updated_by,
    updated_by_name: batch.updated_by_name || "",
    updated_at: batch.updated_at,
    rate_date: String(batch.rate_date).slice(0, 10),
    effective_from: localDateTime(new Date(batch.effective_from)),
    making_charge_type: batch.making_charge_type,
    making_charge_value: String(batch.making_charge_value),
    wastage_percentage: String(batch.wastage_percentage),
    rates: Object.fromEntries(RATE_FIELDS.map(({ key, metal, purity }) => {
      const rate = batch.rates.find((item) => item.metal_type.toLowerCase() === metal.toLowerCase() && item.purity === purity);
      return [key, rate ? String(rate.rate_per_unit ?? rate.rate_per_gram) : ""];
    }))
  };
}

function TablePagination({ page, pageSize, total, onPageChange }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const firstItem = total ? (currentPage - 1) * pageSize + 1 : 0;
  const lastItem = Math.min(currentPage * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">
        Showing <span className="font-bold text-slate-700">{firstItem}–{lastItem}</span> of <span className="font-bold text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous page"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-emerald-200 hover:text-[#006B62] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FiChevronLeft /> Previous
        </button>
        <span className="min-w-16 text-center text-xs font-bold text-slate-600">Page {currentPage} of {pageCount}</span>
        <button
          type="button"
          aria-label="Next page"
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-emerald-200 hover:text-[#006B62] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next <FiChevronRight />
        </button>
      </div>
    </div>
  );
}

export default function DailyGoldRate() {
  const { current, loading: currentLoading, error: currentError, refresh } = useGoldRates();
  const [form, setForm] = useState(blankForm);
  const [batches, setBatches] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [reasonOption, setReasonOption] = useState("");
  const [batchPage, setBatchPage] = useState(1);
  const [changePage, setChangePage] = useState(1);

  const batchPageCount = Math.max(1, Math.ceil(batches.length / HISTORY_PAGE_SIZE));
  const changePageCount = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const visibleBatchPage = Math.min(batchPage, batchPageCount);
  const visibleChangePage = Math.min(changePage, changePageCount);
  const visibleBatches = batches.slice((visibleBatchPage - 1) * HISTORY_PAGE_SIZE, visibleBatchPage * HISTORY_PAGE_SIZE);
  const visibleHistory = history.slice((visibleChangePage - 1) * HISTORY_PAGE_SIZE, visibleChangePage * HISTORY_PAGE_SIZE);

  const loadHistory = useCallback(async () => {
    try {
      const response = await api.get("/gold-rates/history");
      const rateBatches = Array.isArray(response.data.batches) ? response.data.batches : [];
      setBatches(rateBatches);
      setForm((existingForm) => {
        const draft = rateBatches.find((batch) => batch.status === "Draft");
        return existingForm.id || !draft ? existingForm : formFromBatch(draft);
      });
      setHistory(Array.isArray(response.data.history) ? response.data.history : []);
    } catch (error) {
      console.error("Failed to load gold rate history:", error);
      toast.error(error.response?.data?.message || "Could not load rate history.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (!formOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) setFormOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [formOpen, saving]);

  const setField = (name, value) => setForm((previous) => ({ ...previous, [name]: value }));
  const setRate = (key, value) => setForm((previous) => ({
    ...previous,
    rates: { ...previous.rates, [key]: value }
  }));

  const requestBody = () => ({
    ...form,
    making_charge_value: Number(form.making_charge_value),
    wastage_percentage: Number(form.wastage_percentage),
    rates: Object.fromEntries(Object.entries(form.rates).map(([key, value]) => [key, Number(value)]))
  });

  const persistDraft = async () => {
    const payload = requestBody();
    const response = form.id
      ? await api.put(`/gold-rates/${form.id}`, { ...payload, expected_version: form.expected_version })
      : await api.post("/gold-rates", payload);
    setForm(formFromBatch(response.data));
    await loadHistory();
    return response.data;
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.reason.trim()) {
      toast.error("Select or enter a reason for this rate change.");
      return;
    }
    const missingRate = RATE_FIELDS.find(({ key }) => !form.rates[key] || Number(form.rates[key]) <= 0);
    if (missingRate) {
      toast.error(`Enter a valid positive rate for ${missingRate.label}.`);
      return;
    }
    if (!window.confirm("Save and activate these rates? Applicable product prices will be recalculated. Previously issued invoices will retain their saved prices.")) return;
    setSaving(true);
    try {
      const batch = await persistDraft();
      const { data: activated } = await api.post(`/gold-rates/${batch.id}/activate`, { reason: form.reason.trim() });
      setForm(blankForm());
      const updatedCount = activated.price_recalculation?.updated;
      toast.success(Number.isInteger(updatedCount)
        ? `Rates activated. ${updatedCount} product prices recalculated; invoice history preserved.`
        : "Rates activated for their effective time; invoice history is preserved.");
      const [refreshResult] = await Promise.allSettled([refresh(), loadHistory()]);
      setFormOpen(false);
      if (refreshResult.status === "rejected") {
        toast.error("Rates were activated, but the active rate display could not be refreshed. Retry the rate refresh.");
      }
    } catch (error) {
      console.error("Failed to save and activate gold rates:", error);
      toast.error(error.response?.data?.message || "Could not save and activate these rates.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditRateBatch = (batch) => {
    const batchForm = formFromBatch(batch);
    setForm({
      ...batchForm,
      id: batch.status === "Draft" ? batchForm.id : null,
      expected_updated_at: batch.status === "Draft" ? batchForm.expected_updated_at : null,
      expected_version: batch.status === "Draft" ? batchForm.expected_version : null,
      status: "Draft",
      reason: ""
    });
    setReasonOption("");
    setFormOpen(true);
  };

  const handleDeleteDraft = async (batch) => {
    if (batch.status !== "Draft" || deletingBatchId !== null) return;
    if (!window.confirm(`Delete the draft rate set for ${formatRateDate(batch.rate_date)}? This cannot be undone.`)) return;
    setDeletingBatchId(batch.id);
    try {
      await api.delete(`/gold-rates/${batch.id}`);
      if (form.id === batch.id) {
        setForm(blankForm());
        setFormOpen(false);
      }
      await loadHistory();
      toast.success("Draft rate set deleted.");
    } catch (error) {
      console.error("Failed to delete draft gold rates:", error);
      toast.error(error.response?.data?.message || "Could not delete the draft rate set.");
    } finally {
      setDeletingBatchId(null);
    }
  };

  const rateSetStatus = currentLoading ? "Loading" : current?.status || "Not configured";
  const draftCount = batches.filter((batch) => batch.status === "Draft").length;
  const overviewCards = [
    {
      label: "Rate set status",
      value: rateSetStatus,
      detail: current ? "Currently applied to new calculations" : "Create a rate set to get started",
      icon: current ? FiCheckCircle : FiActivity,
      accentClass: "from-emerald-400 to-teal-600",
      iconClass: current ? "bg-gradient-to-br from-emerald-400 to-teal-600 text-white" : "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
    },
    {
      label: "Rate date",
      value: current ? formatRateDate(current.rate_date) : "—",
      detail: current ? `Effective ${new Date(current.effective_from).toLocaleString()}` : "No active rate date",
      icon: FiCalendar,
      accentClass: "from-sky-400 to-cyan-600",
      iconClass: "bg-gradient-to-br from-sky-400 to-cyan-600 text-white"
    },
    {
      label: "Metal categories",
      value: RATE_METALS.length,
      detail: "Gold · Silver · Platinum · Diamond",
      icon: FiLayers,
      accentClass: "from-violet-500 to-indigo-600",
      iconClass: "bg-gradient-to-br from-violet-500 to-indigo-600 text-white"
    },
    {
      label: "Draft rate sets",
      value: historyLoading ? "…" : draftCount,
      detail: historyLoading ? "Checking rate history" : `${draftCount} draft${draftCount === 1 ? "" : "s"} awaiting activation`,
      icon: FiClock,
      accentClass: "from-orange-400 to-rose-500",
      iconClass: "bg-gradient-to-br from-orange-400 to-rose-500 text-white"
    }
  ];

  return (
    <main className="min-h-full space-y-5 bg-gradient-to-br from-[#edf7f2] via-[#f5f7f2] to-[#fbf2e5] p-4 sm:p-6 lg:p-8">
      <header className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-[#063b36] via-[#087768] to-[#b58128] p-5 text-white shadow-[0_20px_50px_rgba(4,64,54,0.2)] sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 h-72 w-72 rounded-full border-[34px] border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-40 h-56 w-56 rounded-full bg-amber-300/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-amber-200 shadow-inner backdrop-blur sm:flex">
              <FiActivity size={25} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-100">Pricing workspace · Market control</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">Daily Precious Rates</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
                Review active market rates and manage audited Gold, Silver, Platinum and Diamond pricing.
              </p>
            </div>
          </div>
          <div className="relative flex w-full flex-wrap gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              aria-expanded={historyOpen}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition sm:flex-none ${
                historyOpen
                  ? "border-white/30 bg-white/20 text-white"
                  : "border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/20"
              }`}
            >
              <FiEye aria-hidden="true" />{historyOpen ? "Hide history" : "Rate history"}
            </button>
            <button
              type="button"
              onClick={() => { setForm(blankForm()); setReasonOption(""); setFormOpen(true); }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-400 px-4 py-3 text-sm font-extrabold text-[#3d2c0d] shadow-[0_8px_22px_rgba(245,190,75,0.25)] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 sm:flex-none"
            >
              <FiPlus aria-hidden="true" /> New Rate Set
            </button>
          </div>
        </div>
      </header>

      <section aria-label="Rate overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map(({ label, value, detail, icon: Icon, iconClass, accentClass }) => (
          <article key={label} className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-[0_8px_24px_rgba(26,67,55,0.07)] transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className={`h-1 bg-gradient-to-r ${accentClass}`} />
            <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-2 truncate text-xl font-black tracking-tight text-slate-900">{value}</p>
              </div>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
                <Icon size={18} aria-hidden="true" />
              </span>
            </div>
            <p className="mt-3 truncate border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-500" title={detail}>{detail}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/90 bg-white/95 shadow-[0_16px_42px_rgba(26,67,55,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50/70 px-5 py-5 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-900/15">
              <FiLayers size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#008577]">Live pricing</p>
              <h2 className="mt-0.5 text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">Currently applied rate set</h2>
            </div>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
            current?.status === "Active"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : currentLoading
                ? "border-sky-200 bg-sky-50 text-sky-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${current?.status === "Active" ? "bg-emerald-500" : currentLoading ? "bg-sky-500" : "bg-amber-500"}`} />
            {rateSetStatus}
          </span>
        </div>

        <div className="p-5 sm:p-7">
          {currentError && (
            <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              Rate refresh failed: {currentError}
            </p>
          )}

          {currentLoading && !current ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading active rates">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : current ? (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#eff8f4] to-[#f7f6ef] p-4 sm:px-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Rate date</p>
                  <p className="mt-1 text-lg font-extrabold text-slate-900">{formatRateDate(current.rate_date)}</p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-white bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                  <FiClock className="shrink-0 text-[#008577]" aria-hidden="true" />
                  <span>Effective {new Date(current.effective_from).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-5">
                {RATE_METALS.map((metal) => {
                  const metalRates = RATE_FIELDS.filter((field) => field.metal === metal);
                  return (
                    <section key={metal} aria-label={`${metal} rates`} className={`rounded-2xl border p-4 sm:p-5 ${METAL_THEMES[metal].panel}`}>
                      <div className="mb-3 flex items-center gap-2">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black shadow-sm ${METAL_THEMES[metal].badge}`}>{METAL_THEMES[metal].symbol}</span>
                        <h3 className="text-sm font-extrabold text-slate-800">{metal}</h3>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${METAL_THEMES[metal].count}`}>
                          {metalRates.length} {metalRates.length === 1 ? "rate" : "rates"}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                        {metalRates.map(({ key, label, purity, unit }) => {
                          const rate = current.rates.find((item) => item.metal_type.toLowerCase() === metal.toLowerCase() && item.purity === purity);
                          return (
                            <article key={key} className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${METAL_THEMES[metal].tile}`}>
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-slate-500">{label}</p>
                                <span className={`h-2 w-2 shrink-0 rounded-full ${METAL_THEMES[metal].marker}`} />
                              </div>
                              <p className={`mt-2 text-lg font-black tracking-tight ${METAL_THEMES[metal].value}`}>
                                {rate ? <>{currency(rate.rate_per_unit ?? rate.rate_per_gram)}<span className="ml-1 text-xs font-semibold text-slate-500">/ {unit === "carat" ? "ct" : "g"}</span></> : <span className="text-sm font-semibold text-slate-400">Not set</span>}
                              </p>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>

              <section className="mt-6 border-t border-slate-100 pt-5">
                <div className="mb-3 flex items-center gap-2">
                  <FiActivity className="text-[#008577]" aria-hidden="true" />
                  <h3 className="text-sm font-extrabold text-slate-800">Making &amp; wastage charges</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
                    <p className="text-xs font-semibold text-slate-500">Default making charge</p>
                    <p className="mt-1 text-lg font-extrabold text-slate-900">
                      {current.making_charge_type === "Percentage"
                        ? `${Number(current.making_charge_value).toLocaleString("en-IN")}%`
                        : currency(current.making_charge_value)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4">
                    <p className="text-xs font-semibold text-slate-500">Wastage</p>
                    <p className="mt-1 text-lg font-extrabold text-slate-900">{Number(current.wastage_percentage).toLocaleString("en-IN")}%</p>
                  </div>
                </div>
              </section>

              <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70">
                <summary className="px-4 py-3 text-xs font-bold text-slate-600">View rate set audit details</summary>
                <div className="grid gap-3 border-t border-slate-200 p-4 text-xs sm:grid-cols-2">
                  <p className="text-slate-500">Created by <span className="font-semibold text-slate-800">{current.created_by_name || current.created_by || "Unknown"}{current.created_by_name && current.created_by ? ` (${current.created_by})` : ""}</span><span className="mt-1 block">{current.created_at ? new Date(current.created_at).toLocaleString() : "Creation time unavailable"}</span></p>
                  <p className="text-slate-500">Last updated by <span className="font-semibold text-slate-800">{current.updated_by_name || current.updated_by || "Unknown"}{current.updated_by_name && current.updated_by ? ` (${current.updated_by})` : ""}</span><span className="mt-1 block">{current.updated_at ? new Date(current.updated_at).toLocaleString() : "Update time unavailable"}</span></p>
                </div>
              </details>

              <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
                <FiCheckCircle className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                Activation applies to new calculations. Previously saved invoices retain their recorded prices.
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <FiActivity size={22} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-extrabold text-slate-900">No active rate set</h3>
              <p className="mt-1 text-sm text-slate-500">Create a rate set to start applying precious metal prices to new calculations.</p>
              <button
                type="button"
                onClick={() => { setForm(blankForm()); setReasonOption(""); setFormOpen(true); }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#14534a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0f4039]"
              >
                <FiPlus aria-hidden="true" /> Create Rate Set
              </button>
            </div>
          )}
        </div>
      </section>

      {formOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}>
      <form onSubmit={handleSave} className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#008577]">{form.id ? "Draft rate set" : "New rate set"}</p>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900">{form.id ? "Update Draft Rates" : "Create Rate Set"}</h2>
            <p className="mt-1 text-sm text-slate-500">Enter rate details and save as a draft before activation.</p>
          </div>
          <div className="flex items-center gap-3">
            {form.id && <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">Draft #{form.id}</span>}
            <button type="button" disabled={saving} onClick={() => setFormOpen(false)} aria-label="Close rate set form" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"><FiX size={18} /></button>
          </div>
        </div>

        <div className="space-y-7 overflow-y-auto p-5 sm:p-7">
          <section>
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-sm font-black text-[#006b62]">01</span>
              <div><h3 className="font-bold text-slate-900">Schedule & charges</h3><p className="text-xs text-slate-500">Choose when this rate takes effect and set default jewellery charges.</p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <label className="text-xs font-bold text-slate-600">Rate Date<input className={inputClassName} type="date" required value={form.rate_date} onChange={(event) => setField("rate_date", event.target.value)} /></label>
              <label className="text-xs font-bold text-slate-600">Effective From<input className={inputClassName} type="datetime-local" required value={form.effective_from} onChange={(event) => setField("effective_from", event.target.value)} /></label>
              <label className="text-xs font-bold text-slate-600">Making Charge Type<CustomSelect className={inputClassName} value={form.making_charge_type} onChange={(event) => setField("making_charge_type", event.target.value)}><option>Percentage</option><option>Fixed Amount</option></CustomSelect></label>
              <label className="text-xs font-bold text-slate-600">Default Making Charge ({form.making_charge_type === "Percentage" ? "%" : "₹"})<input className={inputClassName} type="number" min="0" step="0.01" required value={form.making_charge_value} onChange={(event) => setField("making_charge_value", event.target.value)} placeholder="0.00" /></label>
              <label className="text-xs font-bold text-slate-600">Wastage Percentage<input className={inputClassName} type="number" min="0" max="100" step="0.01" required value={form.wastage_percentage} onChange={(event) => setField("wastage_percentage", event.target.value)} placeholder="0.00" /></label>
            </div>
          </section>

          <section className="border-t border-slate-100 pt-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-sm font-black text-amber-700">02</span>
              <div><h3 className="font-bold text-slate-900">Metal & diamond prices</h3><p className="text-xs text-slate-500">Enter prices in separate sections for each metal.</p></div>
            </div>
            <div className="space-y-6">
              {RATE_METALS.map((metal) => (
                <div key={metal} className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
                  <h4 className="mb-3 text-sm font-bold text-slate-800">{metal}</h4>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {RATE_FIELDS.filter((field) => field.metal === metal).map(({ key, label, unit }) => (
                      <label key={key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs font-bold text-slate-700 transition focus-within:border-[#008577] focus-within:bg-emerald-50/30">
                        <span className="flex items-center justify-between gap-2"><span>{label}</span><span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">₹ / {unit}</span></span>
                        <div className="relative mt-2">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₹</span>
                          <input className="block w-full rounded-lg border border-slate-200 bg-white py-3 pl-8 pr-3 text-sm font-bold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#008577] focus:ring-4 focus:ring-emerald-100" type="number" min="0.01" step="0.01" required value={form.rates[key]} onChange={(event) => setRate(key, event.target.value)} placeholder="Enter price" />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-slate-100 pt-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sm font-black text-sky-700">03</span>
              <div><h3 className="font-bold text-slate-900">Audit & activation</h3><p className="text-xs text-slate-500">Record why the rate set is changing for a clear audit trail.</p></div>
            </div>
            <label className="block text-xs font-bold text-slate-600">
              Reason for change
              <CustomSelect
                className={inputClassName}
                required
                value={reasonOption}
                onChange={(event) => {
                  const option = event.target.value;
                  setReasonOption(option);
                  setField("reason", option === "Other" ? "" : option);
                }}
              >
                <option value="">Select a reason</option>
                <option value="Daily market price update">Daily market price update</option>
                <option value="Market price correction">Market price correction</option>
                <option value="Other">Other</option>
              </CustomSelect>
            </label>
            {reasonOption === "Other" && (
              <label className="mt-4 block text-xs font-bold text-slate-600">
                Enter reason
                <input
                  className={inputClassName}
                  maxLength="500"
                  required
                  value={form.reason}
                  onChange={(event) => setField("reason", event.target.value)}
                  placeholder="Enter the reason for this rate change"
                />
              </label>
            )}
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">
              Review pending work before activation. The system cannot identify open transactions automatically. Previously saved product and loan valuations are not recalculated.
            </p>
          </section>
        </div>

        <div className="flex shrink-0 flex-col gap-4 border-t border-slate-100 bg-slate-50/95 px-5 py-5 sm:px-7">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
            <span>Rate status: <strong className="text-slate-700">{form.id ? form.status : "Unsaved"}</strong></span>
            {form.id && <span>Created at: <strong>{form.created_at ? new Date(form.created_at).toLocaleString() : "Unavailable"}</strong></span>}
            {form.id && <span>Created by: <strong>{form.created_by_name || form.created_by || "Unknown"}{form.created_by_name && form.created_by ? ` (${form.created_by})` : ""}</strong></span>}
            {form.id && <span>Last updated: <strong>{new Date(form.updated_at || form.expected_updated_at).toLocaleString()}</strong></span>}
            {form.id && <span>Updated by: <strong>{form.updated_by_name || form.updated_by || "Unknown"}{form.updated_by_name && form.updated_by ? ` (${form.updated_by})` : ""}</strong></span>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => setFormOpen(false)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#006B62] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#00564f] disabled:cursor-not-allowed disabled:opacity-50"><FiSave />{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </form>
      </div>}

      {historyOpen && <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#008577]">Audit log</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">Rate Sets & Change History</h2></div>
        {historyLoading ? <p className="text-sm text-slate-500">Loading rate history...</p> : <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-[#003B3B] text-xs uppercase tracking-wide text-white"><tr><th className="px-4 py-4">Rate date</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Effective from</th><th className="px-4 py-4">Created by (user_id)</th><th className="px-4 py-4">Created at</th><th className="px-4 py-4">Updated by (user_id)</th><th className="px-4 py-4">Last updated</th><th className="px-4 py-4">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{visibleBatches.map((batch) => <tr key={batch.batch_id} className="transition hover:bg-emerald-50/40">
                  <td className="px-4 py-3 font-semibold text-slate-800">{formatRateDate(batch.rate_date)}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${batch.status === "Active" ? "bg-emerald-50 text-emerald-700" : batch.status === "Draft" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{batch.status}</span></td><td className="px-4 py-3 text-slate-600">{new Date(batch.effective_from).toLocaleString()}</td><td className="px-4 py-3 text-slate-600">{batch.created_by_name || batch.created_by || "Unknown"}{batch.created_by_name && batch.created_by && <span className="block text-[10px] text-slate-400">{batch.created_by}</span>}</td><td className="px-4 py-3 text-slate-600">{batch.created_at ? new Date(batch.created_at).toLocaleString() : "—"}</td><td className="px-4 py-3 text-slate-600">{batch.updated_by_name || batch.updated_by || "Unknown"}{batch.updated_by_name && batch.updated_by && <span className="block text-[10px] text-slate-400">{batch.updated_by}</span>}</td><td className="px-4 py-3 text-slate-600">{new Date(batch.updated_at).toLocaleString()}</td><td className="px-4 py-3"><div className="flex items-center gap-1">{batch.status === "Draft" || batch.status === "Active" ? <button type="button" onClick={() => handleEditRateBatch(batch)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-bold text-[#008577] transition hover:bg-emerald-50"><FiEdit2 />{batch.status === "Draft" ? "Edit" : "Edit rates"}</button> : <span className="text-slate-400">—</span>}{batch.status === "Draft" && <button type="button" disabled={deletingBatchId !== null} onClick={() => handleDeleteDraft(batch)} aria-label={`Delete draft rate set for ${formatRateDate(batch.rate_date)}`} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-wait disabled:opacity-50"><FiTrash2 />{deletingBatchId === batch.id ? "Deleting..." : "Delete"}</button>}</div></td>
                </tr>)}</tbody>
              </table>
              {!batches.length && <p className="px-4 py-6 text-center text-sm text-slate-500">No rate sets found.</p>}
            </div>
            <TablePagination page={visibleBatchPage} pageSize={HISTORY_PAGE_SIZE} total={batches.length} onPageChange={setBatchPage} />
          </div>
          <div>
            <h3 className="mb-3 font-bold text-slate-700">Changes</h3>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-xs">
                  <thead className="bg-slate-100 uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-4">Timestamp</th><th className="px-4 py-4">Metal / grade / unit</th><th className="px-4 py-4">Previous</th><th className="px-4 py-4">New</th><th className="px-4 py-4">Action</th><th className="px-4 py-4">By / reason</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{visibleHistory.map((item) => <tr key={item.id} className="transition hover:bg-slate-50"><td className="px-4 py-3 whitespace-nowrap text-slate-600">{new Date(item.changed_at).toLocaleString()}</td><td className="px-4 py-3 font-semibold text-slate-700">{item.metal_type} {item.purity} <span className="font-normal text-slate-500">/ {item.rate_unit === "carat" ? "ct" : "g"}</span></td><td className="px-4 py-3">{item.previous_rate == null ? "—" : currency(item.previous_rate)}</td><td className="px-4 py-3 font-semibold">{item.new_rate == null ? "—" : currency(item.new_rate)}</td><td className="px-4 py-3">{item.action}</td><td className="max-w-sm px-4 py-3 text-slate-600">{item.updated_by_name || item.changed_by || "Unknown"}{item.updated_by_name && item.changed_by && <span className="block text-[10px] text-slate-400">{item.changed_by}</span>} · {item.reason}</td></tr>)}</tbody>
                </table>
                {!history.length && <p className="px-4 py-6 text-center text-sm text-slate-500">No rate changes have been recorded.</p>}
              </div>
              <TablePagination page={visibleChangePage} pageSize={HISTORY_PAGE_SIZE} total={history.length} onPageChange={setChangePage} />
            </div>
          </div>
        </>}
      </section>}
    </main>
  );
}

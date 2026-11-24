import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Plus, RefreshCw, Search, Wallet, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api";
import DateRangeFilter from "../Components/DateRangeFilter";
import { formatCurrency } from "../../utils/currency";

const TRANSACTION_TYPES = [
  ["FUND_ADDED", "Fund Added"],
  ["CREDIT", "Credit"],
  ["DEBIT", "Debit"]
];
const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Other"];
const today = () => new Date().toLocaleDateString("en-CA");
const emptyEntry = () => ({
  transaction_type: "FUND_ADDED",
  transaction_date: `${today()}T12:00`,
  amount: "",
  payment_method: "Cash",
  description: "",
  related_reference: ""
});
const money = (value) => formatCurrency(Number(value || 0));
const displayDate = (value) => value ? new Date(value).toLocaleString() : "—";
const typeLabel = (value) => TRANSACTION_TYPES.find(([type]) => type === value)?.[1] || value;

function FundManagement() {
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [dateRange, setDateRange] = useState({ preset: "all", startDate: "", endDate: "" });
  const [filters, setFilters] = useState({ transaction_type: "ALL", search: "" });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [entry, setEntry] = useState(emptyEntry);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setLoadError("");
    try {
      const params = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        page,
        page_size: 20,
        transaction_type: filters.transaction_type,
        search: filters.search
      };
      const [summaryResponse, transactionResponse] = await Promise.all([
        api.get("/funds/summary", { params: dateRange }),
        api.get("/funds/transactions", { params })
      ]);
      if (!Array.isArray(transactionResponse.data.transactions)) {
        throw new Error("The server returned an invalid fund transaction list.");
      }
      setSummary(summaryResponse.data);
      setTransactions(transactionResponse.data.transactions);
      setTotal(Number(transactionResponse.data.total) || 0);
    } catch (error) {
      const message = error.response?.data?.message || error.message || "Fund data could not be loaded.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [dateRange, filters.search, filters.transaction_type, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pageCount = Math.max(1, Math.ceil(total / 20));
  const statCards = useMemo(() => [
    { label: "Opening Balance", value: summary?.opening_balance, detail: "Opening ledger balance", icon: Wallet, color: "emerald" },
    { label: "Fund Added", value: summary?.fund_added, detail: "Funds added to ledger", icon: Plus, color: "amber" },
    { label: "Total Credits", value: summary?.total_credit, detail: "Credit transactions", icon: ArrowDownLeft, color: "sky" },
    { label: "Total Debits", value: summary?.total_debit, detail: "Debit transactions", icon: ArrowUpRight, color: "rose" },
    { label: "Available Balance", value: summary?.current_balance, detail: "Current ledger balance", icon: Wallet, color: "teal" }
  ], [summary]);

  const openForm = () => {
    setEntry(emptyEntry());
    setShowForm(true);
  };

  const saveEntry = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/funds/transactions", {
        ...entry,
        amount: Number(entry.amount),
        idempotency_key: crypto.randomUUID()
      });
      toast.success("Fund entry recorded.");
      setShowForm(false);
      await fetchData(true);
    } catch (error) {
      toast.error(error.response?.data?.message || "The fund entry could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <main className="space-y-6">
      <header className="relative flex flex-col gap-5 overflow-hidden rounded-3xl bg-gradient-to-r from-[#003B3B] via-[#00594f] to-[#087568] px-5 py-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Finance · Ledger</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Fund Management</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">Review fund entries and balances recorded for your admin account.</p>
        </div>
        <button onClick={openForm} className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-[#00594f] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-emerald-50 sm:self-center">
          <Plus size={16} /> Add Fund Entry
        </button>
      </header>

      {loadError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {loadError}
          <button onClick={() => fetchData()} className="ml-2 underline">Retry</button>
        </div>
      )}

      <section aria-label="Fund summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {statCards.map(({ label, value, detail, icon: Icon, color }) => (
          <article
            key={label}
            className={`relative flex min-h-44 min-w-0 items-center gap-3 overflow-hidden rounded-2xl border-y border-r border-l-4 p-4 shadow-[0_3px_12px_rgba(30,41,59,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-md ${
              color === "emerald" ? "border-l-emerald-500 border-y-emerald-900/20 border-r-emerald-900/20 bg-[#123f35]" :
              color === "amber" ? "border-l-amber-500 border-y-amber-900/20 border-r-amber-900/20 bg-[#40351c]" :
              color === "sky" ? "border-l-sky-500 border-y-sky-900/20 border-r-sky-900/20 bg-[#173750]" :
              color === "rose" ? "border-l-rose-500 border-y-rose-900/20 border-r-rose-900/20 bg-[#4a2a22]" :
              "border-l-teal-500 border-y-teal-900/20 border-r-teal-900/20 bg-[#123d3b]"
            }`}
          >
            <span className={`z-10 grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl text-white shadow-md ${
              color === "emerald" ? "bg-emerald-700" :
              color === "amber" ? "bg-amber-500" :
              color === "sky" ? "bg-cyan-700" :
              color === "rose" ? "bg-rose-700" : "bg-teal-700"
            }`}><Icon size={21} /></span>
            <div className="relative z-10 min-w-0 self-center">
              <p className="truncate text-[11px] font-semibold text-slate-200">{label}</p>
              <p className="mt-1 truncate text-lg font-black leading-tight tracking-tight text-white">{loading && value == null ? "—" : money(value)}</p>
              <p className="mt-2 flex items-center gap-1 text-[11px] font-extrabold text-emerald-300">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                <span className="truncate">{detail}</span>
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-300">Based on fund ledger</p>
            </div>
            <span aria-hidden="true" className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border border-black/5 bg-white/65 text-slate-700"><ChevronRight size={12} /></span>
            <div aria-hidden="true" className={`absolute bottom-3 right-3 flex h-7 items-end gap-[3px] ${
              color === "emerald" ? "text-emerald-300" :
              color === "amber" ? "text-amber-300" :
              color === "sky" ? "text-sky-300" :
              color === "rose" ? "text-rose-300" : "text-teal-300"
            }`}>
              {[11, 17, 13, 23].map((height, index) => (
                <span key={index} className="w-[4px] rounded-t-sm bg-current" style={{ height: `${height}px` }} />
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeFilter onApply={(range) => { setDateRange(range); setPage(1); }} />
            <select
              value={filters.transaction_type}
              onChange={(event) => updateFilter("transaction_type", event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-[#008577] focus:ring-2 focus:ring-emerald-100"
              aria-label="Filter by transaction type"
            >
              <option value="ALL">All types</option>
              {TRANSACTION_TYPES.map(([type, label]) => <option key={type} value={type}>{label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <label className="flex min-w-48 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition focus-within:border-[#008577] focus-within:ring-2 focus-within:ring-emerald-100">
              <Search size={16} className="text-slate-400" />
              <input
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Search entries"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </label>
            <button type="button" onClick={() => fetchData()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-50">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[#064A41] text-xs uppercase tracking-wide text-white">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Payment Method</th>
                <th className="px-4 py-3">Admin Name</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="transition-colors hover:bg-emerald-50/40">
                  <td className="px-4 py-3 text-slate-600">{displayDate(transaction.transaction_date)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{typeLabel(transaction.transaction_type)}</td>
                  <td className={`px-4 py-3 font-bold ${transaction.transaction_type === "DEBIT" ? "text-rose-700" : "text-emerald-700"}`}>
                    {money(transaction.amount)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{transaction.payment_method}</td>
                  <td className="px-4 py-3 text-slate-600">{transaction.admin_name}</td>
                  <td className="max-w-sm px-4 py-3 text-slate-600">{transaction.description || "—"}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{money(transaction.running_balance)}</td>
                </tr>
              ))}
              {!loading && transactions.length === 0 && (
                <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-500">No fund entries found for this admin.</td></tr>
              )}
              {loading && transactions.length === 0 && (
                <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-500">Loading fund entries…</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span>{total} entries</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-40">Previous</button>
            <span>Page {page} of {pageCount}</span>
            <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-40">Next</button>
          </div>
        </footer>
      </section>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
          <form onSubmit={saveEntry} className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-black text-slate-800">Add Fund Entry</h2>
                <p className="text-xs text-slate-500">The entry will be attached to your admin account.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </header>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-600">
                Transaction Type
                <select required value={entry.transaction_type} onChange={(event) => setEntry({ ...entry, transaction_type: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal">
                  {TRANSACTION_TYPES.map(([type, label]) => <option key={type} value={type}>{label}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600">
                Transaction Date
                <input required type="datetime-local" value={entry.transaction_date} onChange={(event) => setEntry({ ...entry, transaction_date: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" />
              </label>
              <label className="text-xs font-bold text-slate-600">
                Amount
                <input required type="number" min="0.01" step="0.01" value={entry.amount} onChange={(event) => setEntry({ ...entry, amount: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" />
              </label>
              <label className="text-xs font-bold text-slate-600">
                Payment Method
                <select required value={entry.payment_method} onChange={(event) => setEntry({ ...entry, payment_method: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal">
                  {PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600 sm:col-span-2">
                Description
                <textarea required maxLength={2000} rows="3" value={entry.description} onChange={(event) => setEntry({ ...entry, description: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" />
              </label>
              <label className="text-xs font-bold text-slate-600 sm:col-span-2">
                Related Reference (optional)
                <input maxLength={100} value={entry.related_reference} onChange={(event) => setEntry({ ...entry, related_reference: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" />
              </label>
            </div>
            <footer className="flex justify-end gap-2 border-t border-slate-100 p-5">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
              <button disabled={saving} className="rounded-lg bg-[#00695C] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">
                {saving ? "Saving…" : "Save Entry"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </main>
  );
}

export default FundManagement;

import CustomSelect from "../../Components/CustomSelect.jsx";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertCircle, FiCheck, FiCheckCircle, FiChevronLeft, FiChevronRight, FiEdit2, FiEye, FiGrid, FiLayers, FiList, FiPauseCircle, FiPlus, FiPrinter, FiSearch, FiTrash2 } from "react-icons/fi";
import { toast } from "react-hot-toast";
import api from "../../api";
import { printLoanAgreement } from "./loanPrint";
import DateRangeFilter from "../Components/DateRangeFilter";
import { isLoanReviewDue } from "./loanPolicy";
import { formatCurrency } from "../../utils/currency";
import useAdminCachedList, { invalidateAdminListCache } from "../useAdminCachedList";

const rateText = (value) => {
  if (value == null || value === "") return "—";
  const rate = Number(value);
  return Number.isFinite(rate) ? rate.toFixed(2) : "—";
};
const dateText = (value) => {
  if (!value) return "—";
  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}/.test(text)
    ? new Date(`${text.slice(0, 10)}T00:00:00`)
    : new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleDateString("en-IN");
};

function overdueDays(loan, today) {
  const [year, month, day] = String(loan.maturity_date || "").slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return 0;
  const gracePeriod = Math.max(0, Number(loan.grace_period_days) || 0);
  const dueDate = new Date(Date.UTC(year, month - 1, day + gracePeriod));
  return Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));
}

function isOverdueActiveLoan(loan, today) {
  return ["active", "suspended"].includes(String(loan.loan_status || "").toLowerCase())
    && loan.release_status !== "Released"
    && Number(loan.outstanding_principal ?? loan.principal_amount) > 0
    && overdueDays(loan, today) > 0;
}

function displayStatus(loan) {
  if (loan.release_status === "Released") return "Completed";
  if (loan.release_status === "Pending Release"
    && Number(loan.outstanding_principal ?? loan.principal_amount) === 0) return "Awaiting Gold Release";
  return loan.loan_status || "Unknown";
}

export default function AllLoans() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [viewMode, setViewMode] = useState("table");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  const [dateRange, setDateRange] = useState({ preset: "all", startDate: "", endDate: "" });
  const listCacheKey = `admin:loans:${dateRange.startDate}:${dateRange.endDate}`;
  const {
    data: loans,
    setData: setLoans,
    loading,
    refreshing,
    error,
    refresh: loadLoans
  } = useAdminCachedList(listCacheKey, async () => {
      const { data } = await api.get("/loans", {
        params: { startDate: dateRange.startDate, endDate: dateRange.endDate }
      });
      if (!Array.isArray(data)) throw new Error("The server returned an invalid loan list.");
      return data;
  }, []);

  useEffect(() => {
    if (error) {
      console.error("Failed to load loans:", error);
      toast.error(error.response?.data?.message || error.message || "Could not load loans.");
    }
  }, [error]);

  const handleDeleteLoan = async (loan) => {
    if (refreshing) return;
    if (!window.confirm(`Permanently delete loan ${loan.loan_number}? This action cannot be undone.`)) return;
    try {
      await api.delete(`/loans/${loan.id}`);
      invalidateAdminListCache("admin:loans");
      setLoans((currentLoans) => currentLoans.filter((item) => item.id !== loan.id));
      toast.success(`Loan ${loan.loan_number} deleted.`);
    } catch (error) {
      console.error("Failed to delete loan:", error);
      toast.error(error.response?.data?.message || "Could not delete loan.");
    }
  };

  useEffect(() => {
    const refreshLoans = () => loadLoans().catch((error) => {
      console.error("Failed to refresh loans:", error);
      toast.error(error.response?.data?.message || error.message || "Could not load loans.");
    });
    window.addEventListener("focus", refreshLoans);
    return () => window.removeEventListener("focus", refreshLoans);
  }, [loadLoans]);

  const loanCounts = loans.reduce((counts, loan) => {
    const status = String(loan.loan_status || "").trim().toLowerCase();
    const released = loan.release_status === "Released";
    const awaitingGoldRelease = loan.release_status === "Pending Release"
      && Number(loan.outstanding_principal ?? loan.principal_amount) === 0;
    if (status === "active" && !awaitingGoldRelease) counts.active += 1;
    if (status === "inactive") counts.inactive += 1;
    if (status === "completed" || released) counts.completed += 1;
    return counts;
  }, { active: 0, inactive: 0, completed: 0 });
  const overdueLoansCount = loans.filter((loan) => isOverdueActiveLoan(loan, todayUtc)).length;
  const reviewRequiredCount = loans.filter((loan) => isLoanReviewDue(loan, todayUtc)).length;
  const summaryCards = [
    { label: "Total Loans", value: loans.length, note: "All recorded loans", icon: FiLayers, card: "border-teal-100 border-t-teal-500 from-teal-50/80", iconClass: "bg-teal-600 shadow-teal-600/20", noteClass: "text-teal-700", dotClass: "bg-teal-600" },
    { label: "Active Loans", value: loanCounts.active, note: "Currently active", icon: FiCheckCircle, card: "border-emerald-100 border-t-emerald-500 from-emerald-50/80", iconClass: "bg-emerald-600 shadow-emerald-600/20", noteClass: "text-emerald-700", dotClass: "bg-emerald-600" },
    { label: "Inactive Loans", value: loanCounts.inactive, note: "Inactive accounts", icon: FiPauseCircle, card: "border-amber-100 border-t-amber-500 from-amber-50/80", iconClass: "bg-amber-500 shadow-amber-500/20", noteClass: "text-amber-700", dotClass: "bg-amber-600" },
    { label: "Completed Loans", value: loanCounts.completed, note: "Successfully completed", icon: FiCheck, card: "border-slate-200 border-t-slate-500 from-slate-100/80", iconClass: "bg-slate-600 shadow-slate-600/20", noteClass: "text-slate-600", dotClass: "bg-slate-500" },
    { label: "Overdue Loans", value: overdueLoansCount, note: "Past maturity date", icon: FiAlertCircle, card: "border-rose-100 border-t-rose-500 from-rose-50/80", iconClass: "bg-rose-600 shadow-rose-600/20", noteClass: "text-rose-700", dotClass: "bg-rose-600" }
  ];
  const query = searchTerm.trim().toLowerCase();
  const filteredLoans = loans.filter((loan) => {
    const matchesSearch = !query || [
      loan.loan_number, loan.customer_name, loan.customer_code, loan.customer_mobile
    ].some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = statusFilter === "All"
      || String(displayStatus(loan)).trim().toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filteredLoans.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedLoans = filteredLoans.slice((activePage - 1) * pageSize, activePage * pageSize);
  const getStatusStyle = (status) => {
    switch (String(status || "").trim().toLowerCase()) {
      case "active": return "bg-emerald-50 text-emerald-700";
      case "inactive": return "bg-amber-50 text-amber-700";
      case "suspended": return "bg-rose-50 text-rose-700";
      case "completed": return "bg-slate-100 text-slate-600";
      case "pending": return "bg-blue-50 text-blue-700";
      case "awaiting gold release": return "bg-amber-50 text-amber-800";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <main className="space-y-5 text-slate-800">
      <section aria-label="All loans overview" className="relative overflow-hidden rounded-[24px] bg-gradient-to-r from-[#064A41] via-[#08695B] to-[#087E6F] px-6 py-7 text-white shadow-[0_16px_40px_rgba(0,59,59,0.18)] sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-1 -top-12 h-48 w-48 rounded-full border border-white/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-100">Loan Management · Portfolio Overview</p>
            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">All Loans</h1>
            <p className="mt-2 text-sm text-emerald-50/90 sm:text-base">Track customer loans, outstanding balances, repayment status, and maturity.</p>
          </div>
          <Link to="/admin/loans/createloan" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-[#064A41] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-white/30">
            <FiPlus size={17} />
            Create New Loan
          </Link>
        </div>
      </section>

      <section aria-label="Loan summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map(({ label, value, note, icon: Icon, card, iconClass, noteClass, dotClass }) => (
          <article key={label} className={`relative flex min-h-[142px] items-center justify-between overflow-hidden rounded-2xl border border-t-4 bg-gradient-to-br to-white px-5 py-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg ${card}`}>
            <div className="min-w-0">
              <p className="truncate text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{loading ? "—" : value.toLocaleString()}</p>
              <p className={`mt-3 inline-flex items-center gap-2 text-[11px] font-bold ${noteClass}`}><span className={`h-2 w-2 rounded-full ${dotClass}`} />{note}</p>
            </div>
            <span className={`ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${iconClass}`}><Icon size={22} aria-hidden="true" /></span>
          </article>
        ))}
      </section>

      {!loading && (overdueLoansCount > 0 || reviewRequiredCount > 0) && (
        <section role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FiAlertCircle className="mt-0.5 shrink-0 text-rose-600" size={20} aria-hidden="true" />
            <div>
              {overdueLoansCount > 0 && <><p className="font-bold">{overdueLoansCount} {overdueLoansCount === 1 ? "loan is" : "loans are"} overdue</p><p className="mt-0.5 text-sm text-rose-700">Maturity date and grace period have passed for active loans with an outstanding balance.</p></>}
              {reviewRequiredCount > 0 && <p className="mt-1 text-sm font-semibold text-rose-800">{reviewRequiredCount} {reviewRequiredCount === 1 ? "account has" : "accounts have"} reached the 15-month review point. Authorized manual review is required; collateral is not automatically seized or forfeited.</p>}
            </div>
          </div>
          <Link to="/admin/loans/overdueloans" className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg bg-rose-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-rose-800 sm:self-auto">
            View overdue loans
          </Link>
        </section>
      )}

      <section aria-label="Loan list controls" className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
       
        <label className="relative min-w-0 sm:w-1/3 sm:min-w-[280px] sm:flex-none">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <span className="sr-only">Search loans</span>
          <input type="search" placeholder="Search loans by number, customer..." value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setCurrentPage(1); }}
            className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 py-3 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-[#008577] focus:bg-white focus:ring-4 focus:ring-emerald-700/10" />
        </label>

        
        <div className="flex flex-wrap items-center justify-between gap-2 sm:ml-auto sm:justify-start sm:gap-3">
          <DateRangeFilter onApply={(range) => { setCurrentPage(1); setDateRange(range); }} controlClassName="min-h-12 rounded-xl border-slate-200 px-4 shadow-sm" />
          <CustomSelect aria-label="Filter loans by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }}
            className="min-h-12 min-w-[150px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm outline-none transition hover:border-slate-300 focus:border-[#008577] focus:ring-4 focus:ring-emerald-700/10">
            <option value="All">All</option>
            {["Active", "Suspended", "Awaiting Gold Release", "Inactive", "Completed", "Pending"].map((status) => <option key={status} value={status}>{status}</option>)}
          </CustomSelect>
          <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1">
            <button type="button" onClick={() => setViewMode("table")} aria-label="List view" aria-pressed={viewMode === "table"} className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition-all ${viewMode === "table" ? "bg-[#064A41] text-white shadow-sm" : "text-slate-400 hover:text-slate-700"}`}><FiList size={17} /></button>
            <button type="button" onClick={() => setViewMode("grid")} aria-label="Card view" aria-pressed={viewMode === "grid"} className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition-all ${viewMode === "grid" ? "bg-[#064A41] text-white shadow-sm" : "text-slate-400 hover:text-slate-700"}`}><FiGrid size={17} /></button>
          </div>
        </div>
         

      </section>

     
      {viewMode === "table" ? (
        <section aria-label="Loans in table view" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-separate border-spacing-0 text-left">
              <thead><tr className="bg-gradient-to-r from-[#064A41] to-[#087568] text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-50/90">
                {["S No", "Loan Number", "Customer", "Outstanding Balance", "Interest", "Maturity", "Status", "Actions"].map((title) => <th key={title} scope="col" className="whitespace-nowrap px-4 py-4 first:pl-5 last:pr-5">{title}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100/80">
                {loading ? <tr><td colSpan="8" className="px-4 py-16 text-center text-sm font-medium text-slate-400">Loading loans...</td></tr>
                  : filteredLoans.length === 0 ? <tr><td colSpan="8" className="px-4 py-16 text-center text-sm font-medium text-slate-400">{loans.length === 0 ? "No loans created yet." : "No loans match your search or status filter."}</td></tr>
                    : paginatedLoans.map((loan, index) => (
                      <tr key={loan.id} className="text-sm transition-colors odd:bg-white even:bg-emerald-50/35 hover:bg-emerald-50/80">
                        <td className="whitespace-nowrap px-4 py-4 pl-5 text-xs font-medium tabular-nums text-slate-400">{(activePage - 1) * pageSize + index + 1}</td>
                        <td className="whitespace-nowrap px-4 py-4 font-bold text-[#064A41]">{loan.loan_number}</td>
                        <td className="px-4 py-4"><div className="flex min-w-[145px] items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold uppercase text-[#087263] ring-1 ring-inset ring-emerald-800/5">{String(loan.customer_name || "?").trim().charAt(0)}</span><span className="min-w-0"><span className="block truncate font-semibold text-slate-800">{loan.customer_name || "—"}</span><span className="mt-0.5 block text-xs text-slate-400">{loan.customer_code || "—"}</span></span></div></td>
                        <td className="whitespace-nowrap px-4 py-4 font-bold tabular-nums text-slate-800" title={`Original loan amount: ${formatCurrency(loan.principal_amount)}`}>{formatCurrency(loan.outstanding_principal ?? loan.principal_amount)}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-600"><span className="font-semibold text-slate-800">{rateText(loan.interest_rate)}%</span></td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <span className={isOverdueActiveLoan(loan, todayUtc) ? "font-bold text-rose-700" : "text-slate-600"}>{dateText(loan.maturity_date)}</span>
                          {isOverdueActiveLoan(loan, todayUtc) && <span className="ml-2 inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">Overdue</span>}
                          {isLoanReviewDue(loan, todayUtc) && <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800" title="15 months since loan date; authorized manual review required">Review</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold ${getStatusStyle(displayStatus(loan))}`}><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{displayStatus(loan)}</span></td>
                        <td className="whitespace-nowrap px-4 py-4 pr-5">
                          <div className="flex items-center gap-1">
                            <Link to={`/admin/loans/details/${loan.id}`} aria-label={`View loan ${loan.loan_number}`} title="View loan" className="rounded-lg p-2 text-slate-400 transition hover:bg-teal-50 hover:text-[#008577] focus:outline-none focus:ring-2 focus:ring-teal-600/30"><FiEye size={16} /></Link>
                            {Number(loan.outstanding_principal ?? loan.principal_amount) > 0 && loan.loan_status !== "Completed" && loan.release_status !== "Released" && <Link to={`/admin/loans/edit/${loan.id}`} aria-label={`Edit loan ${loan.loan_number}`} title="Edit loan" className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600/30"><FiEdit2 size={16} /></Link>}
                            {loan.release_status === "Pending Release" && Number(loan.outstanding_principal ?? loan.principal_amount) === 0 && <Link to={`/admin/loans/completeloan/${loan.id}`} aria-label={`Complete loan ${loan.loan_number}`} title="Complete Loan" className="rounded-lg p-2 text-amber-600 transition hover:bg-amber-50 hover:text-amber-800"><FiCheckCircle size={16} /></Link>}
                            <button type="button" disabled={refreshing} onClick={() => printLoanAgreement(loan.id)} aria-label={`Print or download loan ${loan.loan_number}`} title="Print / Download PDF" className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50"><FiPrinter size={16} /></button>
                            <button type="button" disabled={refreshing} onClick={() => handleDeleteLoan(loan)} aria-label={`Delete loan ${loan.loan_number}`} title="Delete loan" className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-600/30 disabled:cursor-not-allowed disabled:opacity-50"><FiTrash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        loading ? <section className="rounded-2xl border border-slate-200 bg-white px-4 py-16 text-center text-sm font-medium text-slate-400">Loading loans...</section>
          : filteredLoans.length === 0 ? <section className="rounded-2xl border border-slate-200 bg-white px-4 py-16 text-center text-sm font-medium text-slate-400">{loans.length === 0 ? "No loans created yet." : "No loans match your search or status filter."}</section>
            : <section aria-label="Loans in card view" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedLoans.map((loan) => (
                <article key={loan.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/[0.06]">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Loan Number</p><h2 className="mt-1 font-extrabold text-[#064A41]">{loan.loan_number}</h2></div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold ${getStatusStyle(displayStatus(loan))}`}><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{displayStatus(loan)}</span>
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold uppercase text-[#087263]">{String(loan.customer_name || "?").trim().charAt(0)}</span><div className="min-w-0"><p className="truncate font-semibold text-slate-800">{loan.customer_name || "—"}</p><p className="mt-0.5 text-xs text-slate-400">{loan.customer_code || "—"}</p></div></div>
                    <p className="mt-2 text-xs text-slate-500">{loan.customer_mobile || "Mobile number unavailable"}</p>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-xs font-medium text-slate-400">Outstanding Balance</dt><dd className="mt-1 font-bold text-[#064A41]">{formatCurrency(loan.outstanding_principal ?? loan.principal_amount)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Maturity</dt><dd className={`mt-1 font-semibold ${isOverdueActiveLoan(loan, todayUtc) ? "text-rose-700" : "text-slate-700"}`}>{dateText(loan.maturity_date)}{isOverdueActiveLoan(loan, todayUtc) && <span className="ml-2 text-[10px] font-bold uppercase text-rose-700">Overdue</span>}{isLoanReviewDue(loan, todayUtc) && <span className="ml-2 text-[10px] font-bold uppercase text-amber-800">Review</span>}</dd></div>
                      <div><dt className="text-xs font-medium text-slate-400">Interest</dt><dd className="mt-1 font-semibold text-slate-700">{rateText(loan.interest_rate)}%</dd></div>
                    </dl>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <Link to={`/admin/loans/details/${loan.id}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#008577] hover:underline"><FiEye /> View details</Link>
                      <div className="flex items-center gap-1">
                        <button type="button" disabled={refreshing} onClick={() => printLoanAgreement(loan.id)} aria-label={`Print or download loan ${loan.loan_number}`} title="Print / Download PDF" className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><FiPrinter size={16} /></button>
                        {loan.release_status === "Pending Release" && Number(loan.outstanding_principal ?? loan.principal_amount) === 0 && <Link to={`/admin/loans/completeloan/${loan.id}`} aria-label={`Complete loan ${loan.loan_number}`} title="Complete Loan" className="rounded-lg p-2 text-amber-600 transition hover:bg-amber-50 hover:text-amber-800"><FiCheckCircle size={16} /></Link>}
                        {Number(loan.outstanding_principal ?? loan.principal_amount) > 0 && loan.loan_status !== "Completed" && loan.release_status !== "Released" && <Link to={`/admin/loans/edit/${loan.id}`} aria-label={`Edit loan ${loan.loan_number}`} title="Edit loan" className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-700"><FiEdit2 size={16} /></Link>}
                        <button type="button" onClick={() => handleDeleteLoan(loan)} aria-label={`Delete loan ${loan.loan_number}`} title="Delete loan" className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"><FiTrash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </section>
      )}
      {filteredLoans.length > pageSize && (
        <nav aria-label="Loan list pagination" className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-800">{(activePage - 1) * pageSize + 1}–{Math.min(activePage * pageSize, filteredLoans.length)}</span>
            {" "}of <span className="font-semibold text-slate-800">{filteredLoans.length}</span> loans
          </p>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={activePage === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FiChevronLeft size={16} /> Previous
            </button>
            <span className="px-2 text-sm font-semibold text-slate-600">Page {activePage} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={activePage === totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <FiChevronRight size={16} />
            </button>
          </div>
        </nav>
      )}
    </main>
  );
}

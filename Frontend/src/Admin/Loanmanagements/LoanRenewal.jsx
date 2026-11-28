import CustomSelect from "../../Components/CustomSelect.jsx";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FiAlertCircle, FiArrowLeft, FiCalendar, FiCheckCircle, FiChevronRight, FiEye, FiGrid, FiLayers, FiList, FiPlus, FiRefreshCw, FiSearch, FiShield, FiX } from "react-icons/fi";
import { toast } from "react-hot-toast";
import api, { getPrivateFile } from "../../api";
import { isLoanReviewDue, loanReviewDate } from "./loanPolicy";
import { formatCurrency as money } from "../../utils/currency";
import DateRangeFilter from "../Components/DateRangeFilter";

function dateText(value) {
  if (!value) return "—";
  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}/.test(text)
    ? new Date(`${text.slice(0, 10)}T00:00:00`)
    : new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleDateString("en-IN");
}

function rateText(value) {
  const rate = Number(value);
  return Number.isFinite(rate) ? `${rate.toFixed(2)}%` : "—";
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function Info({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value || "—"}</dd>
    </div>
  );
}

export function LoanPaymentModal({ loan: loanRow, onClose, onLoanUpdated }) {
  const [data, setData] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/loans/${loanRow.id}/renewal`).then((renewalResponse) => {
      if (!active) return;
      setData(renewalResponse.data);
      setLoadError("");
    }).catch((error) => {
      console.error("Failed to load loan payment details:", error);
      if (!active) return;
      const message = error.response?.data?.message || error.message || "Could not load payment and renewal details.";
      setLoadError(message);
      toast.error(message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loanRow.id]);

  const loan = data?.loan;
  const preview = data?.preview;
  const amount = Number(paymentAmount);
  const principalReduction = preview && Number.isFinite(amount)
    ? Math.max(0, Math.min(preview.current_principal, amount - preview.accrued_interest))
    : 0;
  const canPay = Boolean(
    loan
    && preview
    && loan.loan_status === "Active"
    && preview.current_principal > 0
    && Number.isFinite(amount)
    && amount > 0
    && amount + 0.001 >= preview.minimum_payment
    && amount <= preview.total_due + 0.001
  );

  const submitPayment = async (event) => {
    event.preventDefault();
    if (!canPay || saving) return;
    setSaving(true);
    try {
      const { data: updatedData } = await api.post(`/loans/${loanRow.id}/renewal`, {
        payment_amount: amount,
        payment_method: paymentMethod,
        reference_number: referenceNumber.trim(),
        idempotency_key: crypto.randomUUID()
      });
      setData(updatedData);
      setPaymentAmount("");
      setReferenceNumber("");
      onLoanUpdated(updatedData.loan);
      toast.success(updatedData.preview.current_principal === 0
        ? "Loan paid in full. Complete and record the gold release."
        : `Payment recorded. Loan renewed through ${dateText(updatedData.loan.maturity_date)}.`);
    } catch (error) {
      console.error("Failed to record loan payment:", error);
      toast.error(error.response?.data?.message || "Could not record this payment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="loan-payment-title" className="my-auto max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-[24px] border border-white/60 bg-white shadow-[0_28px_90px_rgba(2,20,20,0.35)]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-gradient-to-r from-[#064A41] to-[#087568] px-5 py-4 text-white sm:px-7">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-100">Payment &amp; Renewal</p>
            <h2 id="loan-payment-title" className="mt-1 truncate text-base font-extrabold sm:text-lg">{loanRow.loan_number} <span className="text-emerald-100/70">·</span> {loanRow.customer_name || "Customer"}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close payment details" className="shrink-0 rounded-xl p-2.5 text-white/80 transition hover:bg-white/15 hover:text-white disabled:opacity-50"><FiX size={20} /></button>
        </div>

        {loading
          ? <div className="p-12 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#087263]"><FiRefreshCw className="animate-spin" size={20} /></span><p className="mt-4 text-sm font-semibold text-slate-600">Loading payment details...</p></div>
          : loadError || !loan || !preview
            ? <div className="p-6 sm:p-8"><div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{loadError || "Payment details are unavailable."}</div></div>
            : <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1.05fr_0.95fr]">
              <section aria-label="Loan payment summary" className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-[#087263]"><FiCalendar size={20} /></span>
                    <div className="min-w-0"><h3 className="font-extrabold text-slate-800">Loan summary</h3><p className="mt-0.5 text-xs text-slate-500">Renewal date: {dateText(preview.renewal_date)}</p></div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${loan.loan_status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{loan.loan_status}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Current principal</p>
                    <p className="mt-1.5 text-lg font-extrabold tabular-nums text-[#064A41]">{money(preview.current_principal)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Maturity date</p>
                    <p className="mt-1.5 text-sm font-bold tabular-nums text-slate-800">{dateText(loan.maturity_date)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Amount breakdown</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between gap-3 text-slate-600"><span>Regular interest accrued</span><strong className="text-slate-800">{money(preview.regular_interest)}</strong></div>
                    <div className="flex justify-between gap-3 text-slate-600"><span>Overdue interest / late fee</span><strong className="text-rose-700">{money(preview.late_payment_fee)}</strong></div>
                    <div className="flex justify-between gap-3 text-xs text-slate-500"><span>Saved late-payment rate</span><strong>{rateText(loan.late_payment_interest_rate)}</strong></div>
                    <div className="flex justify-between gap-3 border-t border-slate-100 pt-3 text-slate-600"><span>Total interest and late fee</span><strong className="text-slate-800">{money(preview.accrued_interest)}</strong></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#064A41] px-4 py-3 text-white">
                    <span className="text-sm font-bold">Total due</span>
                    <strong className="text-lg font-black tabular-nums">{money(preview.total_due)}</strong>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Overdue extra interest uses the loan&apos;s saved late-payment rate. Total due is principal plus accrued interest and overdue charges; processing and other charges are not included.</p>
                </div>
              </section>

              {preview.current_principal > 0 ? (
                <form onSubmit={submitPayment} className="space-y-4 rounded-2xl border border-slate-200 bg-gradient-to-b from-[#F5FAF8] to-white p-4 sm:p-5">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">Record a payment</h3>
                    <p className="mt-1 text-xs text-slate-500">Enter the amount received and payment details.</p>
                  </div>
                  <label className="block text-sm font-bold text-slate-700">Payable amount
                    <span className="mt-1.5 flex min-h-14 items-center rounded-xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-[#008577] focus-within:ring-4 focus-within:ring-emerald-700/10">
                      <span className="mr-2 text-lg font-bold text-[#087263]">₹</span>
                      <input type="number" inputMode="decimal" min="0.01" max={preview.total_due} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} disabled={loan.loan_status !== "Active" || saving} placeholder="Enter amount received" className="w-full border-0 bg-transparent text-base font-extrabold tabular-nums text-slate-800 outline-none placeholder:text-sm placeholder:font-medium placeholder:text-slate-400" />
                    </span>
                    <span className="mt-1.5 block text-[11px] font-medium text-slate-500">Minimum payment: {money(preview.minimum_payment)} <span className="px-1 text-slate-300">·</span> Maximum: {money(preview.total_due)}</span>
                  </label>
                  <label className="block text-sm font-bold text-slate-700">Payment method
                    <CustomSelect value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} disabled={saving} className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-[#008577] focus:ring-4 focus:ring-emerald-700/10">
                      {["Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Other"].map((method) => <option key={method} value={method}>{method}</option>)}
                    </CustomSelect>
                  </label>
                  <label className="block text-sm font-bold text-slate-700">Reference number <span className="font-normal text-slate-400">(optional)</span>
                    <input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} maxLength={100} disabled={saving} placeholder="Enter transaction or receipt reference" className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#008577] focus:ring-4 focus:ring-emerald-700/10" />
                  </label>
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">Any amount above the minimum interest payment reduces the principal. Remaining balance earns interest at the saved rate for the next 11 months.</div>
                  {paymentAmount && Number.isFinite(amount) && amount > 0 && <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs">
                    <p className="mb-1 font-extrabold uppercase tracking-wide text-emerald-800">Payment allocation preview</p>
                    <p className="flex justify-between gap-2 text-slate-600"><span>Interest covered</span><strong>{money(Math.min(amount, preview.accrued_interest))}</strong></p>
                    <p className="flex justify-between gap-2 text-slate-600"><span>Principal reduction</span><strong>{money(principalReduction)}</strong></p>
                    <p className="flex justify-between gap-2 border-t border-emerald-200 pt-2 font-extrabold text-[#064A41]"><span>Principal after payment</span><strong>{money(preview.current_principal - principalReduction)}</strong></p>
                  </div>}
                  <button type="submit" disabled={!canPay || saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#064A41] to-[#087568] px-4 py-3 text-sm font-extrabold text-white shadow-md shadow-emerald-950/15 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50">
                    {saving ? "Saving payment..." : <><FiRefreshCw /> Record Payment &amp; Renew</>}
                  </button>
                  {loan.loan_status !== "Active" && <p className="text-center text-xs font-semibold text-slate-500">This loan is not active and cannot be renewed.</p>}
                </form>
              ) : <section className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><FiCheckCircle size={23} /></span>
                <p className="mt-3 font-extrabold text-emerald-900">This loan is paid in full</p>
                <p className="mt-1 text-xs text-emerald-800/80">Continue to record the pledged gold release.</p>
                <Link to={`/admin/loans/goldrelease/${loan.id}`} onClick={onClose} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#064A41] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#087263]"><FiCheckCircle /> Continue to Gold Release</Link>
              </section>}
            </div>}
      </section>
    </div>
  );
}

export default function LoanRenewal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loans, setLoans] = useState([]);
  const [renewalData, setRenewalData] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [viewMode, setViewMode] = useState("table");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [goldImage, setGoldImage] = useState("");
  const [noticeMethod, setNoticeMethod] = useState("sms");
  const [customerMessage, setCustomerMessage] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewActionNotes, setReviewActionNotes] = useState("");
  const [dateRange, setDateRange] = useState({ preset: "all", startDate: "", endDate: "" });
  const [paymentLoan, setPaymentLoan] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const request = id
      ? api.get(`/loans/${id}/renewal`).then(({ data }) => {
        if (active) setRenewalData(data);
      })
      : api.get("/loans", {
        params: { startDate: dateRange.startDate, endDate: dateRange.endDate }
      }).then(({ data }) => {
        if (!Array.isArray(data)) throw new Error("The server returned an invalid loan list.");
        if (active) {
          setLoans(data.filter((loan) =>
            ["Active", "Suspended"].includes(loan.loan_status)
            && loan.release_status !== "Released"
            && Number(loan.outstanding_principal ?? loan.principal_amount) > 0
          ));
        }
      });
    request.catch((error) => {
      console.error("Failed to load loan renewal data:", error);
      if (active) toast.error(error.response?.data?.message || error.message || "Could not load loan renewal data.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id, dateRange.startDate, dateRange.endDate]);

  const loan = renewalData?.loan;
  useEffect(() => {
    if (!loan) return;
    setCustomerMessage(
      `Your loan ${loan.loan_number} has reached its 15-month review date. Please contact Sri Golds to discuss payment or renewal options. Any further action will follow your loan agreement and applicable process.`
    );
  }, [loan?.id, loan?.loan_number]);
  useEffect(() => {
    if (!loan?.gold_image_url) {
      setGoldImage("");
      return undefined;
    }
    let active = true;
    let objectUrl = "";
    getPrivateFile(loan.gold_image_url, { responseType: "blob" })
      .then(({ data }) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(data);
        setGoldImage(objectUrl);
      })
      .catch((error) => {
        console.error("Failed to load pledged gold image:", error);
        if (active) toast.error(error.response?.data?.message || "Could not load pledged gold image.");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [loan?.gold_image_url]);

  const filteredLoans = loans.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      item.loan_number, item.customer_name, item.customer_code, item.customer_mobile
    ].some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = statusFilter === "All"
      || String(item.loan_status || "").toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });
  const todayKey = localDateKey(new Date());
  const renewalSummary = [
    { label: "Total Loans", value: loans.length, note: "Eligible renewal accounts", icon: FiLayers, card: "border-emerald-100 from-emerald-50/70 before:bg-emerald-500", iconClass: "bg-emerald-500 shadow-emerald-500/20", noteClass: "text-emerald-700", dotClass: "bg-emerald-500" },
    { label: "Maturing Today", value: loans.filter((item) => String(item.maturity_date || "").slice(0, 10) === todayKey).length, note: "Loans due today", icon: FiCalendar, card: "border-sky-100 from-sky-50/70 before:bg-sky-500", iconClass: "bg-sky-500 shadow-sky-500/20", noteClass: "text-sky-700", dotClass: "bg-sky-500" },
    { label: "Past Maturity", value: loans.filter((item) => {
      const maturityDate = String(item.maturity_date || "").slice(0, 10);
      return Boolean(maturityDate) && maturityDate < todayKey;
    }).length, note: "Require customer follow-up", icon: FiAlertCircle, card: "border-amber-100 from-amber-50/70 before:bg-amber-500", iconClass: "bg-amber-500 shadow-amber-500/20", noteClass: "text-amber-700", dotClass: "bg-amber-500" },
    { label: "15-Month Reviews", value: loans.filter((item) => isLoanReviewDue(item)).length, note: "Authorized manual review only", icon: FiShield, card: "border-orange-100 from-orange-50/70 before:bg-orange-500", iconClass: "bg-orange-500 shadow-orange-500/20", noteClass: "text-orange-700", dotClass: "bg-orange-500" }
  ];

  const amount = Number(paymentAmount);
  const preview = renewalData?.preview;
  const principalReduction = Number.isFinite(amount) && preview
    ? Math.max(0, Math.min(preview.current_principal, amount - preview.accrued_interest))
    : 0;
  const canRenew = Boolean(
    loan
    && preview
    && preview.current_principal > 0
    && loan.loan_status === "Active"
    && Number.isFinite(amount)
    && amount > 0
    && amount + 0.001 >= preview.minimum_payment
    && amount <= preview.total_due + 0.001
  );

  const handleRenewal = async (event) => {
    event.preventDefault();
    if (!canRenew || saving) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/loans/${id}/renewal`, {
        payment_amount: amount,
        payment_method: paymentMethod,
        reference_number: referenceNumber.trim(),
        idempotency_key: crypto.randomUUID()
      });
      setRenewalData(data);
      setPaymentAmount("");
      setReferenceNumber("");
      if (data.preview.current_principal === 0) {
        toast.success("Loan paid in full. Complete and record the gold release.");
        navigate(`/admin/loans/completeloan/${id}`);
      } else {
        toast.success(`Payment recorded. Loan renewed through ${dateText(data.loan.maturity_date)}.`);
      }
    } catch (error) {
      console.error("Failed to renew loan:", error);
      toast.error(error.response?.data?.message || "Could not renew this loan.");
    } finally {
      setSaving(false);
    }
  };

  const handleReviewAction = async (action) => {
    if (!manualReviewDue || savingReview) return;
    if (action === "suspend" && !window.confirm("Suspend renewal for this loan? A customer notice must already be recorded. This does not transfer ownership of or authorize taking the pledged gold.")) return;
    if (action === "reinstate" && !window.confirm("Reinstate renewal access for this loan?")) return;
    setSavingReview(true);
    try {
      const payload = action === "notice_sent"
        ? { action, notice_method: noticeMethod, customer_message: customerMessage, notes: reviewNotes }
        : { action, notes: reviewActionNotes };
      const { data } = await api.post(`/loans/${id}/review-action`, payload);
      setRenewalData((current) => ({ ...current, loan: data.loan, reviewActions: data.reviewActions }));
      setReviewNotes("");
      setReviewActionNotes("");
      toast.success(action === "notice_sent"
        ? "Customer notice recorded. The app does not send SMS or WhatsApp automatically."
        : action === "suspend" ? "Renewal suspended. No collateral action was taken." : "Renewal access reinstated.");
    } catch (error) {
      console.error("Failed to update loan review:", error);
      toast.error(error.response?.data?.message || "Could not update the loan review.");
    } finally {
      setSavingReview(false);
    }
  };

  if (!id) {
    return (
      <main className="space-y-5 p-2">
        <section aria-label="Loan renewal overview" className="relative overflow-hidden rounded-[24px] bg-gradient-to-r from-[#064A41] via-[#08695B] to-[#087E6F] px-6 py-7 text-white shadow-[0_16px_40px_rgba(0,59,59,0.18)] sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-1 -top-12 h-48 w-48 rounded-full border border-white/10" />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-100">Loan Management · Renewal Tracking</p>
              <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Loan Renewal Overview</h1>
              <p className="mt-2 text-sm text-emerald-50/90 sm:text-base">Review maturing accounts, record payments, and manage eligible loan renewals.</p>
            </div>
            <Link to="/admin/loans/createloan" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-[#064A41] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-white/30">
              <FiPlus size={17} />
              Create New Loan
            </Link>
          </div>
        </section>
        <section aria-label="Loan renewal summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {renewalSummary.map(({ label, value, note, icon: Icon, card, iconClass, noteClass, dotClass }) => (
            <article key={label} className={`relative flex min-h-[168px] items-center justify-between overflow-hidden rounded-2xl border bg-gradient-to-br via-white to-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] before:absolute before:left-0 before:top-0 before:h-1 before:w-full ${card}`}>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{label}</p>
                <p className="mt-3 text-3xl font-black tabular-nums tracking-tight text-slate-950">{loading ? "—" : value}</p>
                <p className={`mt-2 flex items-center gap-2 text-xs font-bold ${noteClass}`}><span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />{note}</p>
              </div>
              <span className={`ml-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${iconClass}`}><Icon size={22} /></span>
            </article>
          ))}
        </section>
        <section aria-label="Loan renewal filters" className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <label className="relative min-w-0 sm:w-1/3 sm:min-w-[280px] sm:flex-none">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <span className="sr-only">Search loans</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search loans by number, customer..."
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm font-medium text-slate-700 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-[#008577] focus:ring-4 focus:ring-emerald-700/10" />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:ml-auto sm:justify-start sm:gap-3">
            <DateRangeFilter onApply={(range) => { setLoading(true); setDateRange(range); }} />
            <CustomSelect aria-label="Filter loans by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}
              className="min-w-[142px] rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-600 outline-none transition hover:border-slate-300 focus:border-[#008577] focus:ring-4 focus:ring-emerald-700/10">
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
            </CustomSelect>
            <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1">
              <button type="button" onClick={() => setViewMode("table")} aria-label="List view" aria-pressed={viewMode === "table"} className={`rounded-lg p-2.5 transition-all ${viewMode === "table" ? "bg-[#064A41] text-white shadow-sm" : "text-slate-400 hover:text-slate-700"}`}><FiList size={17} /></button>
              <button type="button" onClick={() => setViewMode("card")} aria-label="Card view" aria-pressed={viewMode === "card"} className={`rounded-lg p-2.5 transition-all ${viewMode === "card" ? "bg-[#064A41] text-white shadow-sm" : "text-slate-400 hover:text-slate-700"}`}><FiGrid size={17} /></button>
            </div>
          </div>
        </section>
        {viewMode === "table" ? <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.055)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-separate border-spacing-0 text-left">
              <thead><tr className="bg-gradient-to-r from-[#003B3B] to-[#075B50] text-[10px] font-extrabold uppercase tracking-[0.1em] text-white">
                {["Loan Number", "Customer", "Mobile", "Principal", "Balance", "Interest", "Maturity", "Actions"].map((label) =>
                  <th key={label} className="whitespace-nowrap px-4 py-4 first:pl-5">{label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-emerald-100/80">
                {loading
                  ? <tr><td colSpan="8" className="px-4 py-16 text-center text-sm font-medium text-slate-400">Loading loans...</td></tr>
                  : filteredLoans.length === 0
                    ? <tr><td colSpan="8" className="px-4 py-14">
                      <div className="mx-auto flex max-w-md flex-col items-center text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#087263] ring-1 ring-emerald-100"><FiCalendar size={22} /></span>
                        <p className="mt-3 text-sm font-bold text-slate-700">{loans.length ? "No loans match your filters" : "No loans ready for renewal"}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{loans.length ? "Try another search term or adjust the status filter." : "Eligible active loans will appear here when available."}</p>
                      </div>
                    </td></tr>
                    : filteredLoans.map((item) => (
                      <tr key={item.id} className={`bg-[#F3FBF8] text-sm transition-colors ${["Active", "Suspended"].includes(item.loan_status) ? "cursor-pointer hover:bg-[#EAF7F2]" : "opacity-60"}`}
                        onClick={() => ["Active", "Suspended"].includes(item.loan_status) && navigate(Number(item.outstanding_principal ?? item.principal_amount) === 0 ? `/admin/loans/completeloan/${item.id}` : `/admin/loans/loanreniwel/${item.id}`)}>
                        <td className="whitespace-nowrap px-4 py-4 pl-5 font-bold text-[#064A41]">{item.loan_number}</td>
                        <td className="px-4 py-4"><span className="block font-semibold text-slate-800">{item.customer_name || "—"}</span><span className="text-xs text-slate-500">{item.customer_code || "—"}</span></td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-600">{item.customer_mobile || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-4 tabular-nums text-slate-600">{money(item.principal_amount)}</td>
                        <td className="whitespace-nowrap px-4 py-4 font-bold tabular-nums text-slate-800">{money(item.outstanding_principal ?? item.principal_amount)}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-600">{rateText(item.interest_rate)} / {String(item.interest_frequency || "").replaceAll("_", " ")}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-600">{dateText(item.maturity_date)}</td>
                        <td className="whitespace-nowrap px-4 py-4 pr-5">
                          {item.loan_status === "Active" && Number(item.outstanding_principal ?? item.principal_amount) === 0
                            ? <Link to={`/admin/loans/completeloan/${item.id}`} onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Complete loan <FiChevronRight /></Link>
                            : item.loan_status === "Active"
                              ? <div className="flex items-center gap-2">
                                <button type="button" onClick={(event) => { event.stopPropagation(); setPaymentLoan(item); }} className="inline-flex items-center gap-1 rounded-lg bg-[#064A41] px-3 py-2 text-xs font-bold text-white hover:bg-[#087263]">Pay</button>
                                <Link to={`/admin/loans/loanreniwel/${item.id}`} onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">Renew <FiEye /></Link>
                              </div>
                            : item.loan_status === "Suspended"
                              ? <Link to={`/admin/loans/loanreniwel/${item.id}`} onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Review <FiChevronRight /></Link>
                            : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{item.loan_status}</span>}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {!loading && <div className="border-t border-slate-100 bg-white px-5 py-3.5 text-xs font-medium text-slate-500">
            Showing <span className="font-bold text-slate-700">{filteredLoans.length}</span> renewal {filteredLoans.length === 1 ? "loan" : "loans"}
          </div>}
        </section> : loading
          ? <section className="rounded-2xl border border-slate-200 bg-white px-4 py-14 text-center text-sm text-slate-400">Loading loans...</section>
          : filteredLoans.length === 0
            ? <section className="rounded-2xl border border-slate-200 bg-white px-4 py-14 text-center text-sm text-slate-400">{loans.length ? "No loans match your filters." : "No active loans are available for renewal."}</section>
            : <section aria-label="Loans for renewal in card view" className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredLoans.map((item) => (
                <article key={item.id} className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Loan Number</p>
                      <h2 className="mt-1 break-words font-bold text-[#064A41]">{item.loan_number}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{item.customer_name || "—"}</p>
                      <p className="text-xs text-slate-500">{item.customer_mobile || "Mobile unavailable"}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${item.loan_status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{item.loan_status}</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                    <Info label="Principal" value={money(item.principal_amount)} />
                    <Info label="Balance" value={money(item.outstanding_principal ?? item.principal_amount)} />
                    <Info label="Interest" value={`${rateText(item.interest_rate)} / ${String(item.interest_frequency || "").replaceAll("_", " ")}`} />
                    <Info label="Maturity" value={dateText(item.maturity_date)} />
                  </dl>
                  <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
                    {item.loan_status === "Active" && Number(item.outstanding_principal ?? item.principal_amount) === 0
                      ? <Link to={`/admin/loans/completeloan/${item.id}`} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Complete loan <FiChevronRight /></Link>
                      : item.loan_status === "Active"
                        ? <Link to={`/admin/loans/loanreniwel/${item.id}`} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">Renew <FiEye /></Link>
                        : <Link to={`/admin/loans/loanreniwel/${item.id}`} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Review <FiChevronRight /></Link>}
                  </div>
                </article>
              ))}
            </section>}
        {paymentLoan && <LoanPaymentModal
          loan={paymentLoan}
          onClose={() => setPaymentLoan(null)}
          onLoanUpdated={(updatedLoan) => setLoans((current) => current.map((item) => item.id === updatedLoan.id ? { ...item, ...updatedLoan } : item))}
        />}
      </main>
    );
  }

  if (loading) return <main className="p-6 text-sm text-slate-500">Loading renewal details...</main>;
  if (!renewalData || !loan) {
    return <main className="space-y-3 p-6"><p className="text-sm text-slate-600">Loan renewal details could not be loaded.</p><Link to="/admin/loans/loanreniwel" className="inline-flex items-center gap-2 text-sm font-semibold text-[#008577]"><FiArrowLeft /> Loan Renewal</Link></main>;
  }

  const address = [loan.customer_address, loan.customer_city, loan.customer_district, loan.customer_state, loan.customer_pincode].filter(Boolean).join(", ");
  const unit = loan.rate_unit === "carat" ? "ct" : "g";
  const active = loan.loan_status === "Active";
  const manualReviewDue = isLoanReviewDue(loan);

  return (
    <main className="mx-auto max-w-[1500px] space-y-5 p-4 sm:p-6">
      <header className="space-y-4 rounded-2xl bg-gradient-to-br from-[#064A41] to-[#087568] p-5 text-white shadow-lg sm:p-6">
        <Link to="/admin/loans/loanreniwel" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/20"><FiArrowLeft /> All loans for renewal</Link>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Loan Renewal</p><h1 className="mt-1 text-2xl font-extrabold">{loan.loan_number}</h1><p className="mt-1 text-sm text-white/75">{loan.customer_name} · {loan.customer_mobile || "No mobile"}</p></div>
          <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${active ? "bg-emerald-300/20 text-emerald-50" : "bg-white/15 text-white"}`}>{loan.loan_status}</span>
        </div>
      </header>
      {manualReviewDue && <section role="alert" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><FiCalendar className="mt-0.5 shrink-0" /><div><p className="font-bold">15-month account review required</p><p className="mt-1 text-sm">This unpaid loan has passed its maturity and reached {dateText(loanReviewDate(loan))}. Refer it for authorized manual review. This flag does not authorize automatic collateral seizure or forfeiture.</p></div></section>}
      {manualReviewDue && (
        <section className="space-y-4 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-amber-50 p-2.5 text-amber-800"><FiShield size={20} /></span>
            <div>
              <h2 className="font-bold text-slate-900">Customer notice and renewal suspension</h2>
              <p className="mt-1 text-sm text-slate-600">Send the notice using the selected channel, then record that it was sent. Renewal suspension requires a saved notice and staff confirmation. This system does not send messages automatically or decide ownership/return of pledged gold.</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <form onSubmit={(event) => { event.preventDefault(); handleReviewAction("notice_sent"); }} className="space-y-3 rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-800">Record customer notice</h3>
              <label className="block text-xs font-semibold text-slate-600">Notice channel
                <CustomSelect value={noticeMethod} onChange={(event) => setNoticeMethod(event.target.value)} disabled={savingReview} className="mt-1 block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                  <option value="sms">SMS (send outside this app)</option>
                  <option value="whatsapp">WhatsApp (send outside this app)</option>
                  <option value="call">Phone call</option>
                  <option value="letter">Letter</option>
                  <option value="in_person">In person</option>
                  <option value="other">Other</option>
                </CustomSelect>
              </label>
              <label className="block text-xs font-semibold text-slate-600">Customer message
                <textarea required maxLength={4000} rows={3} value={customerMessage} onChange={(event) => setCustomerMessage(event.target.value)} disabled={savingReview} className="mt-1 block w-full rounded-lg border border-slate-200 p-3 text-sm font-normal text-slate-800" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">Internal contact notes
                <textarea required maxLength={2000} rows={2} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} disabled={savingReview} placeholder="Record who was contacted and any response" className="mt-1 block w-full rounded-lg border border-slate-200 p-3 text-sm font-normal text-slate-800" />
              </label>
              <button type="submit" disabled={savingReview || !customerMessage.trim() || !reviewNotes.trim()} className="min-h-10 rounded-lg bg-[#064A41] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingReview ? "Saving..." : "Confirm notice sent & save record"}</button>
            </form>

            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-800">Renewal status</h3>
              {loan.loan_status === "Suspended" ? (
                <>
                  <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">Renewal is suspended. No collateral action has been taken.</p>
                  <label className="block text-xs font-semibold text-slate-600">Reinstatement notes
                    <textarea maxLength={2000} rows={2} value={reviewActionNotes} onChange={(event) => setReviewActionNotes(event.target.value)} disabled={savingReview} placeholder="Reason for reinstating renewal access" className="mt-1 block w-full rounded-lg border border-slate-200 p-3 text-sm font-normal text-slate-800" />
                  </label>
                  <button type="button" onClick={() => handleReviewAction("reinstate")} disabled={savingReview || !reviewActionNotes.trim()} className="min-h-10 rounded-lg border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800 disabled:opacity-50">{savingReview ? "Saving..." : "Reinstate renewal"}</button>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600">{renewalData.reviewActions?.some((item) => item.action_type === "notice_sent") ? "A customer notice is recorded. An administrator may now suspend renewal if required by the approved policy." : "Record a customer notice before suspending renewal."}</p>
                  <label className="block text-xs font-semibold text-slate-600">Suspension notes
                    <textarea maxLength={2000} rows={2} value={reviewActionNotes} onChange={(event) => setReviewActionNotes(event.target.value)} disabled={savingReview} placeholder="Reason for suspending renewal access" className="mt-1 block w-full rounded-lg border border-slate-200 p-3 text-sm font-normal text-slate-800" />
                  </label>
                  <button type="button" onClick={() => handleReviewAction("suspend")} disabled={savingReview || !renewalData.reviewActions?.some((item) => item.action_type === "notice_sent") || !reviewActionNotes.trim()} className="min-h-10 rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingReview ? "Saving..." : "Suspend renewal"}</button>
                </>
              )}
            </div>
          </div>

          {renewalData.reviewActions?.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Review action history</h3>
              <ul className="space-y-2">
                {renewalData.reviewActions.map((item) => (
                  <li key={item.id} className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                    <p className="font-bold">{item.action_type.replaceAll("_", " ")} · {dateText(item.created_at)}{item.notice_method ? ` · ${item.notice_method}` : ""}</p>
                    {item.customer_message && <p className="mt-1 whitespace-pre-wrap">{item.customer_message}</p>}
                    <p className="mt-1 whitespace-pre-wrap text-slate-500">{item.notes}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-bold text-slate-800">Customer and pledged item</h2>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Customer ID" value={loan.customer_code || loan.customer_id} />
              <Info label="Customer name" value={loan.customer_name} />
              <Info label="Mobile" value={loan.customer_mobile} />
              <Info label="Alternate mobile" value={loan.customer_alternate_mobile} />
              <Info label="Email" value={loan.customer_email} />
              <Info label="Date of birth" value={dateText(loan.customer_date_of_birth)} />
              <Info label="Gender" value={loan.customer_gender} />
              <Info label="Occupation" value={loan.customer_occupation} />
              <Info label="KYC status" value={loan.customer_kyc_status} />
              <div className="sm:col-span-2 lg:col-span-3"><Info label="Address" value={address} /></div>
              <Info label="Guarantor" value={loan.guarantor_name} />
              <Info label="Guarantor mobile" value={loan.guarantor_mobile} />
              <Info label="Guarantor email" value={loan.guarantor_email} />
              <Info label="Guarantor relationship" value={loan.guarantor_relationship} />
              <div className="sm:col-span-2 lg:col-span-3"><Info label="Guarantor address" value={loan.guarantor_address} /></div>
              <Info label="Pledge number" value={loan.gold_pledge_number} />
              <Info label="Jewellery" value={`${loan.jewellery_type} · ${loan.metal_type || "Gold"}`} />
              <Info label="Purity" value={loan.gold_purity} />
              <Info label="Gross weight" value={`${loan.gross_weight} ${unit}`} />
              <Info label="Stone weight" value={`${loan.stone_weight || 0} ${unit}`} />
              <Info label="Net weight" value={`${loan.net_gold_weight} ${unit}`} />
              <Info label="Gold valuation" value={money(loan.gold_valuation)} />
              {goldImage && <div className="sm:col-span-2 lg:col-span-3"><dt className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pledged gold image</dt><img src={goldImage} alt={`Pledged ${loan.jewellery_type}`} className="max-h-56 rounded-xl border border-slate-200 object-contain" /></div>}
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-bold text-slate-800">Saved loan terms</h2>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Original loan amount" value={money(loan.principal_amount)} />
              <Info label="Current principal balance" value={money(preview.current_principal)} />
              <Info label="Interest type" value={String(loan.interest_type || "").replaceAll("_", " ")} />
              <Info label="Interest rate" value={`${rateText(loan.interest_rate)} per ${String(loan.interest_frequency || "").replaceAll("_", " ")}`} />
              <Info label="Interest period starts" value={dateText(preview.period_start_date)} />
              <Info label="Loan date" value={dateText(loan.loan_date)} />
              <Info label="15-month manual review date" value={dateText(loanReviewDate(loan))} />
              <Info label="Current maturity" value={dateText(loan.maturity_date)} />
              <Info label="Renewal date" value={dateText(preview.renewal_date)} />
              <Info label="Compounding frequency" value={loan.compounding_frequency} />
              <Info label="Payment frequency" value={loan.payment_frequency} />
              <Info label="Custom interest period" value={loan.custom_period_days == null ? "—" : `${loan.custom_period_days} days`} />
              <Info label="Grace period" value={`${loan.grace_period_days || 0} days`} />
              <Info label="Interest-free period" value={`${loan.interest_free_days || 0} days`} />
              <Info label={`Late payment rate (${String(loan.interest_frequency || "monthly").replaceAll("_", " ")} period)`} value={loan.late_payment_interest_rate == null ? "Not set" : rateText(loan.late_payment_interest_rate)} />
              <Info label="Fixed interest amount" value={loan.fixed_interest_amount == null ? "—" : money(loan.fixed_interest_amount)} />
              <Info label="Minimum interest" value={loan.minimum_interest_amount == null ? "—" : money(loan.minimum_interest_amount)} />
              <Info label="Maximum interest" value={loan.maximum_interest_amount == null ? "—" : money(loan.maximum_interest_amount)} />
              <Info label="Next maturity after renewal" value={dateText(preview.next_maturity_date)} />
              <Info label="Processing fee" value={money(loan.processing_fee)} />
              <Info label="Other charges" value={money(loan.other_charges)} />
              <Info label="Notes" value={loan.notes} />
            </dl>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm xl:sticky xl:top-5">
            <div className="mb-4 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-[#008577]"><FiCalendar /></span><div><h2 className="font-bold text-slate-800">Payment and renewal</h2><p className="text-xs text-slate-500">Renewal date: {dateText(preview.renewal_date)}</p></div></div>
            <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between gap-3 text-slate-600"><span>Current principal</span><strong className="text-slate-800">{money(preview.current_principal)}</strong></div>
              <div className="flex justify-between gap-3 text-slate-600"><span>Regular interest accrued</span><strong className="text-slate-800">{money(preview.regular_interest)}</strong></div>
              <div className="flex justify-between gap-3 text-slate-600"><span>Late payment fee</span><strong className="text-rose-700">{money(preview.late_payment_fee)}</strong></div>
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-slate-600"><span>Total interest and late fee</span><strong className="text-slate-800">{money(preview.accrued_interest)}</strong></div>
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-bold text-slate-800"><span>Total due</span><span>{money(preview.total_due)}</span></div>
              <p className="pt-1 text-[11px] leading-relaxed text-slate-500">Total due is current principal plus accrued interest. Processing and other charges are not included.</p>
            </div>
            <form onSubmit={handleRenewal} className="mt-4 space-y-3">
              {preview.current_principal <= 0 ? (
                <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-900">This loan is paid in full. The loan remains open until its pledged gold is handed back and recorded.</p>
                  <Link to={`/admin/loans/goldrelease/${id}`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#064A41] px-4 py-3 text-sm font-bold text-white hover:bg-[#087263]"><FiCheckCircle /> Continue to Gold Release</Link>
                </div>
              ) : (
                <>
              <label className="block text-sm font-semibold text-slate-700">Payable amount
                <span className="mt-1.5 flex min-h-12 items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#008577] focus-within:ring-4 focus-within:ring-emerald-700/10">
                  <span className="mr-2 text-slate-400">₹</span>
                  <input type="number" inputMode="decimal" min="0.01" max={preview.total_due} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} disabled={!active || saving}
                    placeholder="Enter amount received" className="w-full border-0 bg-transparent text-sm font-bold text-slate-800 outline-none" />
                </span>
              </label>
              <label className="block text-sm font-semibold text-slate-700">Payment method
                <CustomSelect value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} disabled={saving}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-[#008577]">
                  {["Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Other"].map((method) => <option key={method} value={method}>{method}</option>)}
                </CustomSelect>
              </label>
              <label className="block text-sm font-semibold text-slate-700">Reference number <span className="font-normal text-slate-400">(optional)</span>
                <input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} maxLength={100} disabled={saving}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-700 outline-none focus:border-[#008577]" />
              </label>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                Minimum interest payment: <strong>{money(preview.minimum_payment)}</strong>. Any extra payment reduces the principal; remaining balance earns interest at the saved rate for the next 11 months.
              </div>
              {paymentAmount && Number.isFinite(amount) && amount > 0 && (
                <div className="space-y-1 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs">
                  <p className="flex justify-between gap-2 text-slate-600"><span>Interest covered</span><strong>{money(Math.min(amount, preview.accrued_interest))}</strong></p>
                  <p className="flex justify-between gap-2 text-slate-600"><span>Principal reduction</span><strong>{money(principalReduction)}</strong></p>
                  <p className="flex justify-between gap-2 font-bold text-[#064A41]"><span>Principal after payment</span><strong>{money(preview.current_principal - principalReduction)}</strong></p>
                </div>
              )}
              <button type="submit" disabled={!canRenew || saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#064A41] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#087263] disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? "Saving payment..." : <><FiRefreshCw /> {preview.current_principal <= 0 ? "Renew Loan" : "Record Payment & Renew"}</>}
              </button>
              {!active && <p className="text-center text-xs font-semibold text-slate-500">This loan is not active and cannot be renewed.</p>}
              {active && amount > preview.total_due && <p className="text-xs text-rose-600">Payment cannot exceed the total due.</p>}
              {active && paymentAmount && amount + 0.001 < preview.minimum_payment && <p className="text-xs text-rose-600">Payment must cover the accrued interest before the loan can renew.</p>}
                </>
              )}
            </form>
          </section>

        </aside>
      </div>
    </main>
  );
}

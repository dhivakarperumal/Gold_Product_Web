import CustomSelect from "../../Components/CustomSelect.jsx";
import { useState, useEffect, useCallback, useId } from "react";
import {
  Wallet,
  DollarSign,
  Clock,
  XCircle,
  RotateCcw,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  CheckCircle,
  Ban,
  ArrowUpDown,
  Calendar,
  CreditCard,
  Building,
  User,
  Phone,
  Mail,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
  Layers
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../api";
import { formatCurrency } from "../../utils/currency";

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1
});

const formatCompactNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? compactNumberFormatter.format(number) : "—";
};

const formatCompactCurrency = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? compactCurrencyFormatter.format(number) : "—";
};

const paymentCardThemes = {
  forest: {
    card: "border-emerald-100 border-t-4 border-t-emerald-500 bg-gradient-to-br from-white via-white to-emerald-50",
    icon: "bg-emerald-700 text-white shadow-emerald-900/15",
    detail: "text-emerald-700",
    dot: "bg-emerald-500",
    glow: "bg-emerald-300/35"
  },
  gold: {
    card: "border-amber-100 border-t-4 border-t-amber-500 bg-gradient-to-br from-white via-white to-amber-50",
    icon: "bg-amber-500 text-white shadow-amber-900/15",
    detail: "text-amber-700",
    dot: "bg-amber-500",
    glow: "bg-amber-300/35"
  },
  blue: {
    card: "border-sky-100 border-t-4 border-t-sky-500 bg-gradient-to-br from-white via-white to-sky-50",
    icon: "bg-sky-700 text-white shadow-sky-900/15",
    detail: "text-sky-700",
    dot: "bg-sky-500",
    glow: "bg-sky-300/35"
  },
  rust: {
    card: "border-rose-100 border-t-4 border-t-rose-500 bg-gradient-to-br from-white via-white to-rose-50",
    icon: "bg-rose-600 text-white shadow-rose-900/15",
    detail: "text-rose-700",
    dot: "bg-rose-500",
    glow: "bg-rose-300/35"
  },
  slate: {
    card: "border-cyan-100 border-t-4 border-t-cyan-500 bg-gradient-to-br from-white via-white to-cyan-50",
    icon: "bg-cyan-700 text-white shadow-cyan-900/15",
    detail: "text-cyan-700",
    dot: "bg-cyan-500",
    glow: "bg-cyan-300/35"
  }
};

function PaymentOverviewCard({ label, value, fullValue, note, icon: Icon, loading, theme }) {
  const colors = paymentCardThemes[theme] || paymentCardThemes.forest;

  return (
    <article className={`group relative isolate flex min-h-36 min-w-0 items-center justify-between gap-3 overflow-hidden rounded-2xl border p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl sm:p-5 ${colors.card}`}>
      <span aria-hidden="true" className={`absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl transition duration-300 group-hover:scale-125 ${colors.glow}`} />
      <div className="relative min-w-0">
        <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">{label}</p>
        {loading
          ? <div className="mt-2 h-8 w-28 animate-pulse rounded-lg bg-slate-200/80" />
          : <p title={fullValue || String(value)} aria-label={`${label}: ${fullValue || value}`} className="mt-2 truncate text-2xl font-black leading-none tracking-tight text-slate-900 sm:text-3xl">{value}</p>}
        <p className={`mt-3 flex items-start gap-1.5 text-[10px] font-bold leading-4 sm:text-[11px] ${colors.detail}`}>
          {loading
            ? <span className="mt-1 h-3 w-24 animate-pulse rounded bg-slate-200/80" />
            : (
              <>
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${colors.dot}`} />
                <span className="min-w-0">{note}</span>
              </>
            )}
        </p>
      </div>
      <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-lg sm:h-12 sm:w-12 ${colors.icon}`}>
        <Icon size={22} strokeWidth={2} />
      </span>
    </article>
  );
}

function PaymentDetailSection({ title, icon: Icon, children }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
          <Icon className="h-4 w-4" />
        </span>
        <h4 className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-700">{title}</h4>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function PaymentDetailField({ label, value, mono = false, accent = false, className = "" }) {
  return (
    <div className={`min-w-0 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 ${className}`}>
      <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className={`mt-1 break-words text-xs font-bold ${mono ? "font-mono" : ""} ${accent ? "text-emerald-800" : "text-slate-800"}`}>
        {value ?? "—"}
      </p>
    </div>
  );
}

export default function PaymentManagement() {
  // Data states
  const [overview, setOverview] = useState({
    totalPayments: 0,
    totalAmountCollected: 0,
    pendingPaymentsCount: 0,
    pendingPaymentsAmount: 0,
    failedPaymentsCount: 0,
    failedPaymentsAmount: 0,
    refundedPaymentsCount: 0,
    refundedPaymentsAmount: 0,
    cancelledPaymentsCount: 0,
    cancelledPaymentsAmount: 0
  });
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [plans, setPlans] = useState([]);

  // Filter & Search states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("DESC");
  const [page, setPage] = useState(1);
  const paymentDateInputId = useId();

  // Loading states
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingList, setLoadingList] = useState(true);

  // Modals state
  const [selectedPayment, setSelectedPayment] = useState(null); // for View Details modal
  const [detailLoading, setDetailLoading] = useState(false);
  const [fullDetail, setFullDetail] = useState(null);

  const [approveTarget, setApproveTarget] = useState(null); // payment to approve
  const [approveForm, setApproveForm] = useState({ transactionId: "", paymentMethod: "Bank Transfer", paymentReference: "", notes: "" });
  const [approving, setApproving] = useState(false);

  const [rejectTarget, setRejectTarget] = useState(null); // payment to reject
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const [refundTarget, setRefundTarget] = useState(null); // payment to refund
  const [refundForm, setRefundForm] = useState({ refundAmount: "", reason: "" });
  const [refunding, setRefunding] = useState(false);

  // Copy helper
  const [copiedId, setCopiedId] = useState(null);
  const copyText = (text, id) => {
    if (!text || text === "PENDING") return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Fetch Overview Cards
  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await api.get("/super-admin/payments/overview");
      setOverview(res.data.data || {});
    } catch (err) {
      console.error("Failed to load payment overview:", err);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  // Fetch Plans for Filter Dropdown
  const loadPlans = useCallback(async () => {
    try {
      const res = await api.get("/super-admin/subscription-plans", { params: { pageSize: 50 } });
      setPlans(res.data.plans || []);
    } catch (err) {
      console.error("Failed to load plans:", err);
    }
  }, []);

  // Fetch Payments List
  const loadPayments = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = {
        page,
        limit: 10,
        search,
        status: statusFilter !== "all" ? statusFilter : undefined,
        planId: planFilter !== "all" ? planFilter : undefined,
        paymentMethod: methodFilter !== "all" ? methodFilter : undefined,
        paymentDate: dateFilter || undefined,
        sortBy,
        sortOrder
      };
      const res = await api.get("/super-admin/payments", { params });
      setPayments(res.data.data?.items || []);
      setPagination(res.data.data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      console.error("Failed to load payments:", err);
      toast.error(err.response?.data?.message || "Failed to load payments");
    } finally {
      setLoadingList(false);
    }
  }, [page, search, statusFilter, planFilter, methodFilter, dateFilter, sortBy, sortOrder]);

  useEffect(() => {
    loadOverview();
    loadPlans();
  }, [loadOverview, loadPlans]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Open View Details Modal
  const handleViewDetails = async (payment) => {
    setSelectedPayment(payment);
    setDetailLoading(true);
    try {
      const res = await api.get(`/super-admin/payments/${payment.id}`);
      setFullDetail(res.data.data);
    } catch (err) {
      toast.error("Could not fetch payment details");
      setSelectedPayment(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Open Approve Modal
  const openApproveModal = (payment) => {
    setApproveTarget(payment);
    setApproveForm({
      transactionId: payment.transactionId !== "PENDING" ? payment.transactionId : "",
      paymentMethod: payment.paymentMethod !== "N/A" ? payment.paymentMethod : "Bank Transfer",
      paymentReference: payment.paymentReference !== "—" ? payment.paymentReference : "",
      notes: "Payment verified and approved by Super Admin"
    });
  };

  // Submit Approval
  const handleApproveSubmit = async (e) => {
    e.preventDefault();
    if (!approveTarget) return;
    setApproving(true);
    try {
      const res = await api.post(`/super-admin/payments/${approveTarget.id}/approve`, approveForm);
      toast.success(res.data.message || "Payment approved and subscription activated!");
      setApproveTarget(null);
      loadOverview();
      loadPayments();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve payment");
    } finally {
      setApproving(false);
    }
  };

  // Open Reject Modal
  const openRejectModal = (payment) => {
    setRejectTarget(payment);
    setRejectionReason("");
  };

  // Submit Rejection
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      toast.error("Please enter a rejection reason");
      return;
    }
    setRejecting(true);
    try {
      const res = await api.post(`/super-admin/payments/${rejectTarget.id}/reject`, {
        rejectionReason: rejectionReason.trim()
      });
      toast.success(res.data.message || "Payment has been rejected");
      setRejectTarget(null);
      loadOverview();
      loadPayments();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject payment");
    } finally {
      setRejecting(false);
    }
  };

  // Open Refund Modal
  const openRefundModal = (payment) => {
    setRefundTarget(payment);
    const maxRefundable = payment.amount - (payment.refundAmount || 0);
    setRefundForm({
      refundAmount: maxRefundable > 0 ? String(maxRefundable) : "",
      reason: ""
    });
  };

  // Submit Refund
  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!refundForm.refundAmount || Number(refundForm.refundAmount) <= 0) {
      toast.error("Enter a valid refund amount");
      return;
    }
    if (!refundForm.reason.trim()) {
      toast.error("Please provide a reason for the refund");
      return;
    }
    setRefunding(true);
    try {
      const res = await api.post(`/super-admin/payments/${refundTarget.id}/refund`, {
        refundAmount: Number(refundForm.refundAmount),
        reason: refundForm.reason.trim()
      });
      toast.success(res.data.message || "Refund processed successfully!");
      setRefundTarget(null);
      loadOverview();
      loadPayments();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to process refund");
    } finally {
      setRefunding(false);
    }
  };

  // Format Helpers
  const formatDate = (val) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  const formatDateTime = (val) => {
    if (!val) return "—";
    return new Date(val).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Status Badge Component
  const renderStatusBadge = (status) => {
    switch (status) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Paid
          </span>
        );
      case "pending":
      case "unpaid":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-800 border border-rose-200">
            <XCircle className="h-3 w-3" /> Failed
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-800 border border-purple-200">
            <RotateCcw className="h-3 w-3" /> Refunded
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 border border-slate-300">
            <Ban className="h-3 w-3" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-[#07564B] via-[#086257] to-[#0A7465] px-5 py-5 text-white shadow-lg shadow-emerald-950/10 sm:px-7 sm:py-6">
        <span aria-hidden="true" className="absolute -right-10 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <span aria-hidden="true" className="absolute bottom-[-5rem] right-1/3 h-40 w-40 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-amber-200 shadow-inner">
              <Wallet className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-100/80">Super Admin | Finance</p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">
                Payment Management
              </h1>
              <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-emerald-50/80 sm:text-sm">
                Review, approve, reject, and manage Gold Shop subscription payments and refunds
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              loadOverview();
              loadPayments();
              toast.success("Payments refreshed");
            }}
            className="self-start inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-white/20 active:scale-95 sm:self-auto"
          >
            <RefreshCw className="h-4 w-4 text-amber-200" />
            <span>Refresh List</span>
          </button>
        </div>
      </div>

      {/* ── 1. PAYMENT OVERVIEW CARDS ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <PaymentOverviewCard
          label="Total Payments"
          value={formatCompactNumber(overview.totalPayments)}
          fullValue={Number(overview.totalPayments).toLocaleString("en-IN")}
          note="All logged transactions"
          icon={CreditCard}
          loading={loadingOverview}
          theme="forest"
        />
        <PaymentOverviewCard
          label="Amount Collected"
          value={formatCompactCurrency(overview.totalAmountCollected)}
          fullValue={formatCurrency(overview.totalAmountCollected)}
          note="Net successful payments"
          icon={DollarSign}
          loading={loadingOverview}
          theme="gold"
        />
        <PaymentOverviewCard
          label="Pending Payments"
          value={formatCompactNumber(overview.pendingPaymentsCount)}
          fullValue={overview.pendingPaymentsCount.toLocaleString("en-IN")}
          note={`${formatCurrency(overview.pendingPaymentsAmount)} due`}
          icon={Clock}
          loading={loadingOverview}
          theme="blue"
        />
        <PaymentOverviewCard
          label="Failed Payments"
          value={formatCompactNumber(overview.failedPaymentsCount)}
          fullValue={overview.failedPaymentsCount.toLocaleString("en-IN")}
          note={formatCurrency(overview.failedPaymentsAmount)}
          icon={XCircle}
          loading={loadingOverview}
          theme="rust"
        />
        <PaymentOverviewCard
          label="Refunded Payments"
          value={formatCompactNumber(overview.refundedPaymentsCount)}
          fullValue={overview.refundedPaymentsCount.toLocaleString("en-IN")}
          note={`${formatCurrency(overview.refundedPaymentsAmount)} refunded`}
          icon={RotateCcw}
          loading={loadingOverview}
          theme="slate"
        />
      </div>

      {/* ── 5. SEARCH & FILTERS BAR ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
          <Filter className="h-3.5 w-3.5 text-emerald-700" />
          <span>Find a transaction</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {/* Search by Shop Name / Txn ID */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search shop, owner, txn ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-800 transition focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/10"
            />
          </div>

          {/* Filter by Payment Status */}
          <div>
            <CustomSelect
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by payment status"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs font-semibold text-slate-700 transition focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/10"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
              <option value="cancelled">Cancelled</option>
            </CustomSelect>
          </div>

          {/* Filter by Subscription Plan */}
          <div>
            <CustomSelect
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by subscription plan"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs font-semibold text-slate-700 transition focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/10"
            >
              <option value="all">All Subscription Plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.plan_name}
                </option>
              ))}
            </CustomSelect>
          </div>

          {/* Filter by Payment Method */}
          <div>
            <CustomSelect
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by payment method"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs font-semibold text-slate-700 transition focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/10"
            >
              <option value="all">All Payment Methods</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash">Cash</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
              <option value="Payment Gateway">Payment Gateway</option>
            </CustomSelect>
          </div>

          {/* Filter by Payment Date */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id={paymentDateInputId}
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-2 text-xs font-medium text-slate-700 transition focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/10"
              />
            </div>
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter("")}
                className="rounded-lg p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                title="Clear date"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. PAYMENT LIST TABLE ──────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lg shadow-slate-900/[0.04]">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-800 shadow-sm">
              <CreditCard className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900 sm:text-base">Payment transactions</h2>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">Review payment details and manage transaction actions</p>
            </div>
          </div>
          {pagination && (
            <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-1.5 text-[11px] font-extrabold text-emerald-800 sm:self-auto">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {pagination.total || 0} records
            </span>
          )}
        </div>
        <div className="overflow-x-auto overscroll-x-contain bg-slate-50/60 px-3 pb-2 sm:px-4">
          <table className="w-full min-w-[1120px] border-separate border-spacing-x-0 border-spacing-y-2 text-left text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-[#064E3B] via-[#08796B] to-[#0D776D] font-extrabold uppercase tracking-[0.08em] text-white shadow-sm">
                <th className="whitespace-nowrap rounded-l-xl px-4 py-3.5 text-[10px]">Shop ID</th>
                <th className="whitespace-nowrap px-4 py-3.5 text-[10px]">Gold Shop</th>
                <th className="whitespace-nowrap px-4 py-3.5 text-[10px]">Transaction</th>
                <th className="whitespace-nowrap px-4 py-3.5 text-[10px]">Subscription plan</th>
                <th className="whitespace-nowrap px-4 py-3.5 text-right text-[10px]">Amount</th>
                <th className="whitespace-nowrap px-4 py-3.5 text-[10px]">Payment date</th>
                <th className="whitespace-nowrap px-4 py-3.5 text-center text-[10px]">Status</th>
                <th className="whitespace-nowrap rounded-r-xl px-4 py-3.5 text-center text-[10px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-1 py-1">
                      <div className="h-[58px] animate-pulse rounded-xl border border-slate-100 bg-white">
                        <div className="flex h-full items-center gap-4 px-5">
                          <span className="h-6 w-20 rounded-lg bg-slate-100" />
                          <span className="h-6 w-36 rounded-lg bg-slate-100" />
                          <span className="h-6 w-28 rounded-lg bg-slate-100" />
                          <span className="h-6 w-24 rounded-lg bg-slate-100" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm">
                      <Wallet className="h-7 w-7 stroke-[1.5]" />
                    </span>
                    <p className="text-sm font-extrabold text-slate-700">No payment records found</p>
                    <p className="mt-1 text-xs font-medium text-slate-400">Try modifying your search or filters</p>
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="group">
                    <td className="whitespace-nowrap rounded-l-xl border-y border-l border-slate-100 bg-white px-4 py-4 transition-colors group-hover:bg-emerald-50/60">
                      <span className="inline-flex rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 font-mono text-[10px] font-black tracking-wide text-emerald-800">
                        {p.shopCode}
                      </span>
                    </td>

                    <td className="border-y border-slate-100 bg-white px-4 py-4 transition-colors group-hover:bg-emerald-50/60">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-600 text-white shadow-sm shadow-emerald-900/15">
                          <Building className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="max-w-[190px] truncate text-xs font-extrabold text-slate-900">{p.shopName}</p>
                          <p className="mt-1 max-w-[190px] truncate text-[10px] font-medium text-slate-500">{p.email || "Email not provided"}</p>
                        </div>
                      </div>
                    </td>

                    <td className="border-y border-slate-100 bg-white px-4 py-4 transition-colors group-hover:bg-emerald-50/60">
                      <div className="flex max-w-[205px] items-center gap-1.5">
                        <span className={`min-w-0 truncate rounded-lg border px-2.5 py-1.5 font-mono text-[10px] font-bold ${p.transactionId === "PENDING" ? "border-amber-100 bg-amber-50 text-amber-800" : "border-slate-100 bg-slate-50 text-slate-700"}`}>
                          {p.transactionId}
                        </span>
                        {p.transactionId !== "PENDING" && (
                          <button
                            type="button"
                            onClick={() => copyText(p.transactionId, p.id)}
                            aria-label={`Copy transaction ID ${p.transactionId}`}
                            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-emerald-700"
                            title="Copy Transaction ID"
                          >
                            {copiedId === p.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="border-y border-slate-100 bg-white px-4 py-4 transition-colors group-hover:bg-emerald-50/60">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                          <Layers className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <p className="text-xs font-extrabold text-slate-800">{p.planName}</p>
                          <p className="mt-1 whitespace-nowrap text-[10px] font-medium text-slate-500">
                            Starts {formatDate(p.subscriptionStartDate)}
                          </p>
                          <p className="whitespace-nowrap text-[10px] font-medium text-slate-500">
                            Expires {formatDate(p.subscriptionEndDate)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="border-y border-slate-100 bg-white px-4 py-4 text-right font-sans transition-colors group-hover:bg-emerald-50/60">
                      <p className="whitespace-nowrap text-sm font-black tracking-tight text-slate-900">{formatCurrency(p.amount)}</p>
                      {p.refundAmount > 0 && (
                        <span className="mt-1 inline-flex whitespace-nowrap rounded-md bg-purple-50 px-2 py-1 text-[10px] font-bold text-purple-700">
                          Refunded {formatCurrency(p.refundAmount)}
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap border-y border-slate-100 bg-white px-4 py-4 transition-colors group-hover:bg-emerald-50/60">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {formatDate(p.paymentDate)}
                      </div>
                    </td>

                    <td className="border-y border-slate-100 bg-white px-4 py-4 text-center transition-colors group-hover:bg-emerald-50/60">
                      {renderStatusBadge(p.paymentStatus)}
                    </td>

                    <td className="whitespace-nowrap rounded-r-xl border-y border-r border-slate-100 bg-white px-4 py-4 text-center transition-colors group-hover:bg-emerald-50/60">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleViewDetails(p)}
                          aria-label={`View payment details for ${p.shopName}`}
                          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                          title="View Payment Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {p.paymentStatus === "pending" && (
                          <button
                            type="button"
                            onClick={() => openApproveModal(p)}
                            aria-label={`Approve payment for ${p.shopName}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-700 px-2.5 py-2 text-[10px] font-extrabold text-white shadow-sm transition hover:bg-emerald-800"
                            title="Approve Payment"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                        )}

                        {p.paymentStatus === "pending" && (
                          <button
                            type="button"
                            onClick={() => openRejectModal(p)}
                            aria-label={`Reject payment for ${p.shopName}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[10px] font-extrabold text-rose-700 shadow-sm transition hover:bg-rose-100"
                            title="Reject Payment"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        )}

                        {p.paymentStatus === "paid" && (
                          <button
                            type="button"
                            onClick={() => openRefundModal(p)}
                            aria-label={`Refund payment for ${p.shopName}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-2 text-[10px] font-extrabold text-purple-700 shadow-sm transition hover:bg-purple-100"
                            title="Process Refund"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Refund</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span className="font-medium">
              Showing page {pagination.page || 1} of {pagination.totalPages || 1} ({pagination.total || 0} total payments)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 4A. VIEW PAYMENT DETAILS MODAL ──────────────────────────────────── */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/65 p-3 backdrop-blur-md sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-details-title"
            className="my-auto flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-slate-50 shadow-2xl shadow-slate-950/30"
          >
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-800 to-teal-600 text-white shadow-md shadow-emerald-900/20">
                  <CreditCard className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">Transaction record</p>
                  <h3 id="payment-details-title" className="mt-0.5 text-base font-black tracking-tight text-slate-900 sm:text-lg">
                    Payment Details
                  </h3>
                  <p className="mt-1 truncate font-mono text-[10px] font-medium text-slate-500 sm:text-[11px]">
                    ID: {selectedPayment.paymentId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                aria-label="Close payment details"
                className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-400 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 space-y-4 overflow-y-auto p-4 sm:p-6">
              {detailLoading ? (
                <div className="space-y-4">
                  <div className="h-28 animate-pulse rounded-2xl bg-gradient-to-r from-emerald-100 via-emerald-50 to-teal-100" />
                  {[...Array(3)].map((_, index) => (
                    <div key={index} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="h-14 animate-pulse rounded-xl bg-slate-50" />
                        <div className="h-14 animate-pulse rounded-xl bg-slate-50" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                fullDetail && (
                  <div className="space-y-4">
                    <section className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 p-5 text-white shadow-lg shadow-emerald-950/15 sm:flex-row sm:items-center sm:px-6">
                      <span aria-hidden="true" className="absolute -right-8 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
                      <div className="relative">
                        <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-emerald-100/75">Payment status</p>
                        <div className="mt-2">{renderStatusBadge(fullDetail.paymentStatus)}</div>
                        {fullDetail.refundAmount > 0 && (
                          <p className="mt-2 text-[10px] font-bold text-purple-100">
                            Refunded {formatCurrency(fullDetail.refundAmount)}
                          </p>
                        )}
                      </div>
                      <div className="relative sm:text-right">
                        <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-emerald-100/75">Payment amount</p>
                        <p className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                          {formatCurrency(fullDetail.amount)}
                        </p>
                      </div>
                    </section>

                    <PaymentDetailSection title="Transaction information" icon={CreditCard}>
                      <PaymentDetailField label="Transaction ID" value={fullDetail.transactionId} mono />
                      <PaymentDetailField label="Invoice number" value={fullDetail.invoiceNumber} mono accent />
                      <PaymentDetailField label="Payment method" value={fullDetail.paymentMethod} />
                      <PaymentDetailField label="Payment reference" value={fullDetail.paymentReference} mono />
                      <PaymentDetailField label="Payment date" value={formatDateTime(fullDetail.paymentDate)} />
                      <PaymentDetailField label="Recorded at" value={formatDateTime(fullDetail.createdAt)} />
                      {fullDetail.notes && (
                        <PaymentDetailField label="Notes / audit" value={fullDetail.notes} className="sm:col-span-2" />
                      )}
                      {fullDetail.rejectionReason && (
                        <PaymentDetailField
                          label="Rejection reason"
                          value={fullDetail.rejectionReason}
                          className="border-rose-100 bg-rose-50/70 sm:col-span-2"
                        />
                      )}
                    </PaymentDetailSection>

                    <PaymentDetailSection title="Shop information" icon={Building}>
                      <PaymentDetailField label="Shop name" value={fullDetail.shop.name} />
                      <PaymentDetailField label="Shop ID" value={fullDetail.shop.code} mono accent />
                      <PaymentDetailField label="Owner name" value={fullDetail.shop.owner} />
                      <PaymentDetailField label="Contact number" value={fullDetail.shop.mobile} />
                      {fullDetail.shop.email && (
                        <PaymentDetailField label="Email" value={fullDetail.shop.email} />
                      )}
                      {fullDetail.shop.gst && (
                        <PaymentDetailField label="GST" value={fullDetail.shop.gst} mono />
                      )}
                    </PaymentDetailSection>

                    <PaymentDetailSection title="Subscription details" icon={Layers}>
                      <PaymentDetailField label="Plan name" value={fullDetail.subscription.planName} />
                      <PaymentDetailField label="Billing cycle" value={fullDetail.subscription.duration} />
                      <PaymentDetailField label="Subscription status" value={fullDetail.subscription.status} accent />
                      <PaymentDetailField
                        label="Subscription period"
                        value={`${formatDate(fullDetail.subscription.startDate)} to ${formatDate(fullDetail.subscription.endDate)}`}
                      />
                    </PaymentDetailSection>
                  </div>
                )
              )}
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-3.5 sm:px-6">
              <p className="text-[10px] font-medium text-slate-400">Payment information is read-only</p>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="rounded-xl bg-emerald-800 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-900"
              >
                Close details
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ── 4B. APPROVE PAYMENT DIALOG ───────────────────────────────────────── */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <h3 className="text-base font-bold text-slate-900">Approve Payment</h3>
              </div>
              <button
                type="button"
                onClick={() => setApproveTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Approving this payment will update the status to <strong>Paid</strong> and automatically activate the linked <strong>{approveTarget.planName}</strong> subscription for <strong>{approveTarget.shopName}</strong>.
            </p>

            <form onSubmit={handleApproveSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Payment Amount</label>
                <input
                  type="text"
                  readOnly
                  value={formatCurrency(approveTarget.amount)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold font-sans text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Transaction ID</label>
                <input
                  type="text"
                  placeholder="Enter Bank / Gateway Transaction ID"
                  value={approveForm.transactionId}
                  onChange={(e) => setApproveForm({ ...approveForm, transactionId: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-[#07564B] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Payment Method</label>
                <CustomSelect
                  value={approveForm.paymentMethod}
                  onChange={(e) => setApproveForm({ ...approveForm, paymentMethod: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-[#07564B] focus:outline-none"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="Payment Gateway">Payment Gateway</option>
                </CustomSelect>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reference / UTR Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. UTR12345678"
                  value={approveForm.paymentReference}
                  onChange={(e) => setApproveForm({ ...approveForm, paymentReference: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-[#07564B] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setApproveTarget(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approving}
                  className="rounded-xl bg-[#07564B] px-5 py-2 font-bold text-white shadow-sm hover:bg-[#06473E] disabled:opacity-50"
                >
                  {approving ? "Approving..." : "Confirm & Approve"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 4C. REJECT PAYMENT DIALOG ────────────────────────────────────────── */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                  <Ban className="h-5 w-5" />
                </span>
                <h3 className="text-base font-bold text-slate-900">Reject Payment</h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Rejecting this payment will cancel transaction <strong>{rejectTarget.transactionId}</strong> for <strong>{rejectTarget.shopName}</strong> ({formatCurrency(rejectTarget.amount)}). A rejection reason is required for audit.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why this payment is being rejected (e.g. invalid UTR, payment not credited, incorrect amount)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejecting}
                  className="rounded-xl bg-rose-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                >
                  {rejecting ? "Rejecting..." : "Reject Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 4D. REFUND PAYMENT DIALOG ────────────────────────────────────────── */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                  <RotateCcw className="h-5 w-5" />
                </span>
                <h3 className="text-base font-bold text-slate-900">Process Refund</h3>
              </div>
              <button
                type="button"
                onClick={() => setRefundTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl bg-purple-50/60 p-3 text-xs text-purple-900 border border-purple-100 flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-purple-700">Total Paid</span>
                <p className="font-bold font-sans text-sm">{formatCurrency(refundTarget.amount)}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-purple-700">Already Refunded</span>
                <p className="font-bold font-sans text-sm">{formatCurrency(refundTarget.refundAmount || 0)}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-purple-700">Max Refundable</span>
                <p className="font-bold font-sans text-sm text-emerald-800">
                  {formatCurrency(refundTarget.amount - (refundTarget.refundAmount || 0))}
                </p>
              </div>
            </div>

            <form onSubmit={handleRefundSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Refund Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={refundTarget.amount - (refundTarget.refundAmount || 0)}
                  required
                  placeholder="Enter refund amount"
                  value={refundForm.refundAmount}
                  onChange={(e) => setRefundForm({ ...refundForm, refundAmount: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 font-bold focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Refund Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide reason for issuing refund..."
                  value={refundForm.reason}
                  onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRefundTarget(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refunding}
                  className="rounded-xl bg-purple-700 px-5 py-2 font-bold text-white shadow-sm hover:bg-purple-800 disabled:opacity-50"
                >
                  {refunding ? "Processing..." : "Process Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

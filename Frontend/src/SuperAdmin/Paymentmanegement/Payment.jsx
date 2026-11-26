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

const paymentCardThemes = {
  forest: {
    card: "border-[#2F6B59] border-l-emerald-400 bg-[#123B32]",
    icon: "bg-[#08745D] text-white",
    label: "text-emerald-50/90",
    detail: "text-emerald-300",
    bars: "bg-emerald-300"
  },
  gold: {
    card: "border-[#8A702E] border-l-amber-400 bg-[#443719]",
    icon: "bg-[#C58B11] text-white",
    label: "text-amber-50/90",
    detail: "text-amber-300",
    bars: "bg-amber-300"
  },
  blue: {
    card: "border-[#3B7897] border-l-sky-400 bg-[#17364D]",
    icon: "bg-[#007A61] text-white",
    label: "text-sky-50/90",
    detail: "text-sky-300",
    bars: "bg-sky-300"
  },
  rust: {
    card: "border-[#905342] border-l-orange-300 bg-[#4A2B25]",
    icon: "bg-[#C58B11] text-white",
    label: "text-orange-50/90",
    detail: "text-orange-200",
    bars: "bg-orange-200"
  },
  slate: {
    card: "border-[#526D76] border-l-cyan-300 bg-[#29363B]",
    icon: "bg-[#008B99] text-white",
    label: "text-cyan-50/90",
    detail: "text-cyan-200",
    bars: "bg-cyan-200"
  }
};

function PaymentOverviewCard({ label, value, note, icon: Icon, loading, theme }) {
  const colors = paymentCardThemes[theme] || paymentCardThemes.forest;

  return (
    <article className={`relative flex min-h-[176px] min-w-0 items-center gap-4 overflow-hidden rounded-xl border border-l-4 p-4 shadow-md transition-shadow hover:shadow-lg sm:p-5 ${colors.card}`}>
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl shadow-inner ${colors.icon}`}>
        <Icon size={25} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1 pb-1">
        <p className={`truncate text-sm font-semibold ${colors.label}`}>{label}</p>
        {loading
          ? <div className="mt-2 h-8 w-28 animate-pulse rounded bg-white/15" />
          : <p className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-[28px]">{value}</p>}
        <div className={`mt-2 flex min-h-5 items-center gap-1.5 text-xs ${colors.detail}`}>
          {loading
            ? <div className="h-3 w-24 animate-pulse rounded bg-white/15" />
            : (
              <>
                <span className={`h-2 w-2 rounded-full ${colors.bars}`} />
                <span className="font-semibold">{note}</span>
              </>
            )}
        </div>
      </div>
      <div aria-hidden="true" className={`absolute bottom-3 right-3 flex h-8 items-end gap-1 opacity-90 ${colors.detail}`}>
        <span className="h-3 w-1.5 rounded-t-sm bg-current" />
        <span className="h-5 w-1.5 rounded-t-sm bg-current" />
        <span className="h-4 w-1.5 rounded-t-sm bg-current" />
        <span className="h-7 w-1.5 rounded-t-sm bg-current" />
      </div>
    </article>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#07564B] to-[#0A6F62] text-white shadow-md shadow-emerald-950/20">
            <Wallet className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Payment Management
            </h1>
            <p className="text-xs text-slate-500 font-medium">
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
          className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
          <span>Refresh List</span>
        </button>
      </div>

      {/* ── 1. PAYMENT OVERVIEW CARDS ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <PaymentOverviewCard
          label="Total Payments"
          value={overview.totalPayments.toLocaleString("en-IN")}
          note="All logged transactions"
          icon={CreditCard}
          loading={loadingOverview}
          theme="forest"
        />
        <PaymentOverviewCard
          label="Amount Collected"
          value={formatCurrency(overview.totalAmountCollected)}
          note="Net successful payments"
          icon={DollarSign}
          loading={loadingOverview}
          theme="gold"
        />
        <PaymentOverviewCard
          label="Pending Payments"
          value={overview.pendingPaymentsCount}
          note={`${formatCurrency(overview.pendingPaymentsAmount)} due`}
          icon={Clock}
          loading={loadingOverview}
          theme="blue"
        />
        <PaymentOverviewCard
          label="Failed Payments"
          value={overview.failedPaymentsCount}
          note={formatCurrency(overview.failedPaymentsAmount)}
          icon={XCircle}
          loading={loadingOverview}
          theme="rust"
        />
        <PaymentOverviewCard
          label="Refunded Payments"
          value={overview.refundedPaymentsCount}
          note={`${formatCurrency(overview.refundedPaymentsAmount)} refunded`}
          icon={RotateCcw}
          loading={loadingOverview}
          theme="slate"
        />
      </div>

      {/* ── 5. SEARCH & FILTERS BAR ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-[#07564B] focus:outline-none focus:ring-1 focus:ring-[#07564B]"
            />
          </div>

          {/* Filter by Payment Status */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by payment status"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#07564B] focus:outline-none"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Filter by Subscription Plan */}
          <div>
            <select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by subscription plan"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#07564B] focus:outline-none"
            >
              <option value="all">All Subscription Plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.plan_name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Payment Method */}
          <div>
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by payment method"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#07564B] focus:outline-none"
            >
              <option value="all">All Payment Methods</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash">Cash</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
              <option value="Payment Gateway">Payment Gateway</option>
            </select>
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-2 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:border-[#07564B] focus:outline-none"
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
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-[#07564B] via-[#064A41] to-[#043D37] text-emerald-50 font-bold border-b border-white/10 uppercase tracking-wider">
                <th className="px-4 py-4">S ID</th>
                <th className="px-4 py-4">Shop Name</th>
                <th className="px-4 py-4">Transaction ID</th>
                <th className="px-4 py-4">Plan</th>
                <th className="px-4 py-4 text-right">Amount</th>
                <th className="px-4 py-4">Payment Date</th>
                <th className="px-4 py-4 text-center">Payment Status</th>
                <th className="px-4 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingList ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="py-4 px-4">
                      <div className="h-4 bg-slate-100 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Wallet className="h-10 w-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                    <p className="text-sm font-semibold text-slate-600">No payment records found</p>
                    <p className="text-xs text-slate-400 mt-1">Try modifying search filters</p>
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Shop ID */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        {p.shopCode}
                      </span>
                    </td>

                    {/* Shop Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{p.shopName}</div>
                      <div className="mt-0.5 text-[10px] font-medium text-slate-400">{p.email || "Email not provided"}</div>
                    </td>

                    {/* Transaction ID */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-slate-800">
                          {p.transactionId}
                        </span>
                        {p.transactionId !== "PENDING" && (
                          <button
                            type="button"
                            onClick={() => copyText(p.transactionId, p.id)}
                            className="text-slate-400 hover:text-slate-700 transition"
                            title="Copy Transaction ID"
                          >
                            {copiedId === p.id ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Subscription Plan */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{p.planName}</div>
                      <div className="mt-0.5 text-[10px] font-medium text-slate-500">
                        Start Date: {formatDate(p.subscriptionStartDate)}
                      </div>
                      <div className="text-[10px] font-medium text-slate-500">
                        Expiry: {formatDate(p.subscriptionEndDate)}
                      </div>
                    </td>

                    {/* Payment Amount */}
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 font-sans text-sm">
                      {formatCurrency(p.amount)}
                      {p.refundAmount > 0 && (
                        <div className="text-[10px] text-purple-600 font-medium font-sans">
                          Refunded: {formatCurrency(p.refundAmount)}
                        </div>
                      )}
                    </td>

                    {/* Payment Date */}
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {formatDate(p.paymentDate)}
                    </td>

                    {/* Payment Status */}
                    <td className="py-3.5 px-4 text-center">
                      {renderStatusBadge(p.paymentStatus)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* View Details */}
                        <button
                          type="button"
                          onClick={() => handleViewDetails(p)}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs"
                          title="View Payment Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {/* Approve Button (if pending) */}
                        {p.paymentStatus === "pending" && (
                          <button
                            type="button"
                            onClick={() => openApproveModal(p)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition shadow-xs"
                            title="Approve Payment"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                        )}

                        {/* Reject Button (if pending) */}
                        {p.paymentStatus === "pending" && (
                          <button
                            type="button"
                            onClick={() => openRejectModal(p)}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition shadow-xs"
                            title="Reject Payment"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        )}

                        {/* Refund Button (if paid) */}
                        {p.paymentStatus === "paid" && (
                          <button
                            type="button"
                            onClick={() => openRefundModal(p)}
                            className="inline-flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200 px-2 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100 transition shadow-xs"
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
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing page {pagination.page || 1} of {pagination.totalPages || 1} ({pagination.total || 0} total payments)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 4A. VIEW PAYMENT DETAILS MODAL ──────────────────────────────────── */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-100 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#07564B]" />
                  Payment Details
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  ID: {selectedPayment.paymentId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="py-12 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#07564B] border-t-transparent mx-auto" />
                <p className="text-xs text-slate-500 mt-2">Loading details...</p>
              </div>
            ) : (
              fullDetail && (
                <div className="space-y-5 text-xs">
                  {/* Status & Amount Banner */}
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                      <div className="mt-1">{renderStatusBadge(fullDetail.paymentStatus)}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Amount</span>
                      <p className="text-xl font-black text-slate-900 font-sans mt-0.5">
                        {formatCurrency(fullDetail.amount)}
                      </p>
                      {fullDetail.refundAmount > 0 && (
                        <p className="text-[11px] text-purple-700 font-bold font-sans">
                          Refunded: {formatCurrency(fullDetail.refundAmount)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Transaction Information */}
                  <div className="rounded-2xl border border-slate-100 p-4 space-y-2">
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                      Transaction Information
                    </h4>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <span className="text-slate-400">Transaction ID:</span>
                        <p className="font-mono font-bold text-slate-800">{fullDetail.transactionId}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Invoice Number:</span>
                        <p className="font-mono font-bold text-emerald-800">{fullDetail.invoiceNumber}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Payment Method:</span>
                        <p className="font-semibold text-slate-800">{fullDetail.paymentMethod}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Payment Reference:</span>
                        <p className="font-medium text-slate-800">{fullDetail.paymentReference}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Payment Date:</span>
                        <p className="font-medium text-slate-800">{formatDateTime(fullDetail.paymentDate)}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Recorded At:</span>
                        <p className="font-medium text-slate-800">{formatDateTime(fullDetail.createdAt)}</p>
                      </div>
                    </div>
                    {fullDetail.notes && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-slate-400">Notes / Audit:</span>
                        <p className="text-slate-700 italic mt-0.5">{fullDetail.notes}</p>
                      </div>
                    )}
                    {fullDetail.rejectionReason && (
                      <div className="pt-2 border-t border-rose-100 text-rose-800">
                        <span className="font-bold">Rejection Reason:</span>
                        <p className="mt-0.5">{fullDetail.rejectionReason}</p>
                      </div>
                    )}
                  </div>

                  {/* Shop Details */}
                  <div className="rounded-2xl border border-slate-100 p-4 space-y-2">
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                      Shop Information
                    </h4>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <span className="text-slate-400">Shop Name:</span>
                        <p className="font-bold text-slate-900">{fullDetail.shop.name}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Shop ID:</span>
                        <p className="font-mono font-bold text-emerald-800">{fullDetail.shop.code}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Owner Name:</span>
                        <p className="font-semibold text-slate-800">{fullDetail.shop.owner}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Contact Number:</span>
                        <p className="font-medium text-slate-800">{fullDetail.shop.mobile}</p>
                      </div>
                      {fullDetail.shop.email && (
                        <div>
                          <span className="text-slate-400">Email:</span>
                          <p className="font-medium text-slate-800">{fullDetail.shop.email}</p>
                        </div>
                      )}
                      {fullDetail.shop.gst && (
                        <div>
                          <span className="text-slate-400">GST:</span>
                          <p className="font-mono text-slate-800">{fullDetail.shop.gst}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Subscription Details */}
                  <div className="rounded-2xl border border-slate-100 p-4 space-y-2">
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                      Subscription Details
                    </h4>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <span className="text-slate-400">Plan Name:</span>
                        <p className="font-bold text-slate-900">{fullDetail.subscription.planName}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Billing Cycle:</span>
                        <p className="capitalize font-semibold text-slate-800">{fullDetail.subscription.duration}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Subscription Status:</span>
                        <p className="capitalize font-bold text-emerald-700">{fullDetail.subscription.status}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Period:</span>
                        <p className="font-medium text-slate-800">
                          {formatDate(fullDetail.subscription.startDate)} to {formatDate(fullDetail.subscription.endDate)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
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
                <select
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
                </select>
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

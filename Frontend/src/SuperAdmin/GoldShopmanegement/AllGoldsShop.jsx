import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Eye,
  LoaderCircle,
  LayoutGrid,
  List,
  MapPin,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Store,
  Trash2,
  X
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import AddGoldShop from "./AddGoldShop";

const PAGE_SIZE = 10;

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const STATUS_STYLES = {
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  active: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  inactive: "bg-stone-100 text-stone-700 ring-stone-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  rejected: "bg-rose-50 text-rose-800 ring-rose-200",
  suspended: "bg-rose-50 text-rose-800 ring-rose-200",
  expired: "bg-orange-50 text-orange-800 ring-orange-200",
  paid: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  unpaid: "bg-rose-50 text-rose-800 ring-rose-200"
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const hasCurrentSubscription = (shop) => shop.subscription_is_current === true
  || Number(shop.subscription_is_current) === 1;
const approvalStatus = (shop) => shop.approval_status || (shop.approved_at ? "approved" : "pending");
const accountPlanTypeLabel = (shop) => shop.account_plan_type === "expired"
  ? "Trial expired"
  : shop.account_plan_type || "—";

const formatAmount = (value) =>
  Number.isFinite(Number(value)) ? `₹${Number(value).toLocaleString("en-IN")}` : "—";

function StatusBadge({ value }) {
  const status = String(value || "pending").toLowerCase();
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ring-inset ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
      {status}
    </span>
  );
}

function StatCard({ label, value, note, icon: Icon, theme }) {
  const themes = {
    emerald: {
      card: "border-l-emerald-400 bg-[#123F37]",
      icon: "bg-emerald-700 text-white",
      note: "text-emerald-300",
      dot: "bg-emerald-300",
      bars: "bg-emerald-300"
    },
    amber: {
      card: "border-l-amber-400 bg-[#3D321B]",
      icon: "bg-amber-500 text-white",
      note: "text-amber-300",
      dot: "bg-amber-300",
      bars: "bg-amber-300"
    },
    sky: {
      card: "border-l-sky-400 bg-[#173B56]",
      icon: "bg-[#00796B] text-white",
      note: "text-sky-300",
      dot: "bg-sky-300",
      bars: "bg-sky-300"
    },
    rose: {
      card: "border-l-orange-400 bg-[#4A2A24]",
      icon: "bg-amber-500 text-white",
      note: "text-orange-200",
      dot: "bg-orange-300",
      bars: "bg-orange-300"
    }
  };
  const colors = themes[theme];

  return (
    <article className={`relative isolate flex min-h-36 items-center gap-4 overflow-hidden rounded-2xl border border-white/10 border-l-4 p-5 text-white shadow-md transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${colors.card}`}>
      <ChevronRightIcon />
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-md ${colors.icon}`}>
        <Icon size={23} />
      </span>
      <div className="min-w-0 pb-1">
        <p className="truncate text-xs font-semibold text-white/90">{label}</p>
        <p className="mt-1 text-2xl font-black leading-none tracking-tight">{Number(value || 0).toLocaleString("en-IN")}</p>
        <p className={`mt-3 flex items-center gap-1.5 truncate text-[11px] font-bold ${colors.note}`}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} />
          {note}
        </p>
      </div>
      <div aria-hidden="true" className={`absolute bottom-3 right-3 flex h-7 items-end gap-1 opacity-90 ${colors.bars}`}>
        <span className="h-3 w-1 rounded-t-sm bg-current" />
        <span className="h-5 w-1 rounded-t-sm bg-current" />
        <span className="h-4 w-1 rounded-t-sm bg-current" />
        <span className="h-7 w-1 rounded-t-sm bg-current" />
      </div>
    </article>
  );
}

function ChevronRightIcon() {
  return (
    <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/70 text-slate-600">
      <ChevronRight size={15} />
    </span>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-[115] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
      <section role="dialog" aria-modal="true" aria-label={title} className={`my-auto w-full ${wide ? "max-w-5xl" : "max-w-2xl"} overflow-hidden rounded-3xl bg-[#fbfaf7] shadow-2xl`}>
        <header className="flex items-center justify-between gap-4 border-b border-amber-100 bg-[#17241f] px-5 py-4 text-white">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function ShopDetails({ shop, loading, onConfirmPayment }) {
  if (loading) {
    return <div className="flex min-h-48 items-center justify-center text-stone-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading shop details…</div>;
  }
  if (!shop) return <p className="p-6 text-sm text-stone-600">Shop details could not be loaded.</p>;

  const detailFields = [
    ["Shop code", shop.shop_code],
    ["Owner", shop.owner_name],
    ["Mobile", shop.mobile],
    ["Email", shop.email],
    ["GST number", shop.gst_number],
    ["Address", shop.address],
    ["City / State", [shop.city, shop.state].filter(Boolean).join(", ")],
    ["Pincode", shop.pincode],
    ["Maximum branches", shop.max_branches],
    ["Maximum staff", shop.max_staff],
    ["Created by", shop.created_by_name],
    ["Updated by", shop.updated_by_name],
    ["Created at", formatDate(shop.created_at)],
    ["Updated at", formatDate(shop.updated_at)]
  ];

  return (
    <div className="max-h-[75vh] space-y-5 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div>
          <h3 className="text-lg font-bold text-stone-900">{shop.shop_name}</h3>
          <p className="mt-1 text-xs text-stone-600">Shop UUID: {shop.shop_uuid}</p>
        </div>
        <StatusBadge value={approvalStatus(shop)} />
      </div>

      <section>
        <h3 className="mb-3 font-bold text-stone-800">Shop information</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          {detailFields.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-stone-200 bg-white p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</dt>
              <dd className="mt-1 break-words text-sm font-medium text-stone-800">{value || "—"}</dd>
            </div>
          ))}
          <div className="rounded-xl border border-stone-200 bg-white p-3 sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Admin notes</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-stone-800">{shop.notes || "—"}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="mb-3 font-bold text-stone-800">Current subscription</h3>
        {shop.current_subscription_id ? (
          <div className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-3">
            <div><p className="text-xs text-stone-500">Plan</p><p className="mt-1 font-semibold">{shop.plan_name}</p></div>
            <div><p className="text-xs text-stone-500">Account type</p><p className="mt-1 font-semibold capitalize">{accountPlanTypeLabel(shop)}</p></div>
            <div><p className="text-xs text-stone-500">Duration / amount</p><p className="mt-1 font-semibold capitalize">{shop.duration} · {formatAmount(shop.subscription_amount)}</p></div>
            <div><p className="text-xs text-stone-500">Period</p><p className="mt-1 font-semibold">{formatDate(shop.account_start_date)} – {formatDate(shop.account_end_date)}</p></div>
            <div><p className="text-xs text-stone-500">Subscription status</p><div className="mt-1"><StatusBadge value={shop.subscription_status} /></div></div>
            <div><p className="text-xs text-stone-500">Payment status</p><div className="mt-1"><StatusBadge value={shop.payment_status} /></div></div>
          </div>
        ) : <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-500">No subscription history.</p>}
      </section>

      <section>
        <h3 className="mb-3 font-bold text-stone-800">Subscription renewal history</h3>
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="p-3">Plan</th><th className="p-3">Duration</th><th className="p-3">Amount</th><th className="p-3">Period</th><th className="p-3">Payment</th><th className="p-3">Status</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {(shop.subscriptions || []).map((item) => (
                <tr key={item.id}>
                  <td className="p-3 font-semibold">{item.plan_name}</td>
                  <td className="p-3 capitalize">{item.duration}</td>
                  <td className="p-3">{formatAmount(item.amount)}</td>
                  <td className="p-3">{formatDate(item.start_date)} – {formatDate(item.end_date)}</td>
                  <td className="p-3"><StatusBadge value={item.payment_status} /></td>
                  <td className="p-3"><StatusBadge value={item.subscription_status} /></td>
                </tr>
              ))}
              {!shop.subscriptions?.length && <tr><td className="p-4 text-stone-500" colSpan="6">No renewals recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-bold text-stone-800">Payment history</h3>
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="p-3">Transaction</th><th className="p-3">Amount</th><th className="p-3">Method</th><th className="p-3">Status</th><th className="p-3">Date</th><th className="p-3">Action</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {(shop.payments || []).map((payment) => (
                <tr key={payment.id}>
                  <td className="p-3">{payment.transaction_id || "Awaiting confirmation"}</td>
                  <td className="p-3">{formatAmount(payment.amount)}</td>
                  <td className="p-3">{payment.payment_method || "—"}</td>
                  <td className="p-3"><StatusBadge value={payment.payment_status} /></td>
                  <td className="p-3">{formatDate(payment.payment_date || payment.created_at)}</td>
                  <td className="p-3">
                    {Number(payment.subscription_id) === Number(shop.current_subscription_id) && payment.payment_status !== "paid"
                      ? <button type="button" onClick={() => onConfirmPayment(payment)} className="whitespace-nowrap rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100">Confirm received</button>
                      : "—"}
                  </td>
                </tr>
              ))}
              {!shop.payments?.length && <tr><td className="p-4 text-stone-500" colSpan="6">No payments recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-bold text-stone-800">Activity history</h3>
        <ol className="space-y-2">
          {(shop.activity || []).map((event) => (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-3 text-sm">
              <span className="font-medium text-stone-700">{event.action.replaceAll(".", " ")}</span>
              <span className="text-xs text-stone-500">{event.actor_name || "System"} · {formatDate(event.created_at)}</span>
            </li>
          ))}
          {!shop.activity?.length && <li className="rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-500">No activity yet.</li>}
        </ol>
      </section>
    </div>
  );
}

export default function AllGoldsShop() {
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState(null);
  const [selectedShop, setSelectedShop] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [viewMode, setViewMode] = useState("table");
  const [pendingApproval, setPendingApproval] = useState(null);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [rejectingShopId, setRejectingShopId] = useState(null);
  const [approvalCredentials, setApprovalCredentials] = useState(null);
  const [paymentToConfirm, setPaymentToConfirm] = useState(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ transactionId: "", paymentMethod: "upi" });
  const [subscriptionForm, setSubscriptionForm] = useState(() => ({ planId: "", duration: "monthly", startDate: today() }));

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    api.get("/super-admin/subscription-plans", { signal: controller.signal })
      .then(({ data }) => {
        if (!Array.isArray(data?.plans)) throw new TypeError("Subscription plans response is invalid");
        setPlans(data.plans);
        setSubscriptionForm((current) => ({ ...current, planId: current.planId || String(data.plans[0]?.id || "") }));
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("Failed to load subscription plans:", error);
          toast.error(error.response?.data?.message || "Could not load subscription plans.");
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api.get("/super-admin/gold-shops", {
      params: {
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        status: statusFilter,
        ...(planFilter !== "all" ? { planId: planFilter } : {})
      },
      signal: controller.signal
    })
      .then(({ data }) => {
        if (!Array.isArray(data?.shops) || !data?.pagination || !data?.summary) {
          throw new TypeError("Gold shop list response is invalid");
        }
        setShops(data.shops);
        setPagination(data.pagination);
        setSummary(data.summary);
        setLoadError("");
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("Failed to load gold shops:", error);
          setLoadError(error.response?.data?.message || "Could not load gold shops.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedSearch, page, planFilter, statusFilter]);

  useEffect(() => {
    if (modal !== "details" || !selectedShop?.id) return undefined;
    const controller = new AbortController();
    api.get(`/super-admin/gold-shops/${selectedShop.id}`, { signal: controller.signal })
      .then(({ data }) => setSelectedShop(data.shop))
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("Failed to load gold shop details:", error);
          toast.error(error.response?.data?.message || "Could not load shop details.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [modal, selectedShop?.id]);

  const planOptions = useMemo(() => plans.map((plan) => ({
    ...plan,
    displayName: `${plan.plan_name} · ${formatAmount(plan.monthly_price)}/mo`
  })), [plans]);

  const refreshList = () => {
    setLoading(true);
    if (page !== 1) {
      setPage(1);
      return;
    }
    if (page === 1) {
      api.get("/super-admin/gold-shops", {
        params: {
          page: 1,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
          status: statusFilter,
          ...(planFilter !== "all" ? { planId: planFilter } : {})
        }
      }).then(({ data }) => {
        setShops(data.shops || []);
        setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 });
        setSummary(data.summary || {});
      }).catch((error) => {
        console.error("Failed to refresh gold shops:", error);
        toast.error(error.response?.data?.message || "Could not refresh gold shops.");
      }).finally(() => setLoading(false));
    }
  };

  const saveShop = async (payload, addAnother = false) => {
    setSubmitting(true);
    try {
      const { subscription, credentials, documents, ...shop } = payload;
      const formData = new FormData();
      formData.append("payload", JSON.stringify({
        ...shop,
        ...(credentials ? { credentials } : {}),
        ...(subscription ? { subscription } : {})
      }));
      if (documents?.profilePhoto) formData.append("profilePhoto", documents.profilePhoto);
      const response = modal === "edit"
        ? await api.put(`/super-admin/gold-shops/${selectedShop.id}`, formData)
        : await api.post("/super-admin/gold-shops", formData);
      toast.success(response.data?.message || (modal === "edit" ? "Shop updated." : "Gold shop created."));
      if (addAnother) {
        setFormKey((key) => key + 1);
      } else {
        setModal(null);
      }
      refreshList();
    } catch (error) {
      console.error("Failed to save gold shop.", { status: error.response?.status });
      toast.error(error.response?.data?.message || "Could not save this gold shop.");
    } finally {
      setSubmitting(false);
    }
  };

  const openDetails = (shop) => {
    navigate(`/superadmin/goldshop/${shop.id}`);
  };

  const openPaymentConfirmation = (payment) => {
    setPaymentForm({ transactionId: "", paymentMethod: "upi" });
    setPaymentToConfirm(payment);
  };

  const confirmSubscriptionPayment = async (event) => {
    event.preventDefault();
    if (!selectedShop || !paymentToConfirm || paymentSubmitting) return;
    setPaymentSubmitting(true);
    try {
      const { data } = await api.post(
        `/super-admin/gold-shops/${selectedShop.id}/payments/${paymentToConfirm.id}/confirm`,
        paymentForm
      );
      if (!data?.shop) throw new TypeError("Payment confirmation response is invalid");
      setSelectedShop(data.shop);
      setPaymentToConfirm(null);
      toast.success(data.message || "Subscription payment confirmed.");
      refreshList();
    } catch (error) {
      console.error("Failed to confirm subscription payment:", error);
      toast.error(error.response?.data?.message || "Could not confirm this subscription payment.");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const openEdit = (shop) => {
    setSelectedShop(shop);
    setModal("edit");
  };

  const changeStatus = async (shop) => {
    const nextStatus = shop.status === "active" ? "suspended" : "active";
    const action = nextStatus === "active" ? "activate" : "suspend";
    if (!window.confirm(`Are you sure you want to ${action} ${shop.shop_name}?`)) return;
    try {
      const { data } = await api.patch(`/super-admin/gold-shops/${shop.id}/status`, { status: nextStatus });
      toast.success(data.message || `Shop ${action}d.`);
      refreshList();
    } catch (error) {
      console.error(`Failed to ${action} gold shop:`, error);
      toast.error(error.response?.data?.message || `Could not ${action} this shop.`);
    }
  };

  const approveShop = (shop) => {
    setPendingApproval(shop);
  };

  const confirmApproveShop = async () => {
    if (!pendingApproval || approvalSubmitting) return;
    setApprovalSubmitting(true);
    try {
      const { data } = await api.post(`/super-admin/gold-shops/${pendingApproval.id}/approve`);
      setApprovalCredentials({
        identifier: data.credentials?.identifier || data.shop?.owner_email || pendingApproval.email || "",
        username: data.shop?.owner_username || "",
        userId: data.shop?.owner_user_uuid || "",
        name: data.shop?.owner_name || pendingApproval.owner_name || "",
        mobile: data.shop?.mobile || pendingApproval.mobile || "",
        temporaryPassword: data.credentials?.temporaryPassword || ""
      });
      setPendingApproval(null);
      toast.success(data.message || "Gold shop approved.");
      refreshList();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not approve this gold shop.");
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const rejectShop = async (shop) => {
    if (!window.confirm(`Reject ${shop.shop_name}? Its pending login credentials will be removed.`)) return;
    setRejectingShopId(shop.id);
    try {
      const { data } = await api.post(`/super-admin/gold-shops/${shop.id}/reject`);
      toast.success(data.message || "Gold shop rejected.");
      refreshList();
    } catch (error) {
      console.error("Failed to reject gold shop:", error);
      toast.error(error.response?.data?.message || "Could not reject this gold shop.");
    } finally {
      setRejectingShopId(null);
    }
  };

  const archiveShop = async (shop) => {
    if (!window.confirm(`Archive ${shop.shop_name}? Its record and history will be retained.`)) return;
    try {
      const { data } = await api.delete(`/super-admin/gold-shops/${shop.id}`);
      toast.success(data.message || "Gold shop archived.");
      refreshList();
    } catch (error) {
      console.error("Failed to archive gold shop:", error);
      toast.error(error.response?.data?.message || "Could not archive this shop.");
    }
  };

  const submitSubscription = async (event) => {
    event.preventDefault();
    if (!selectedShop) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/super-admin/gold-shops/${selectedShop.id}/subscription`, {
        planId: Number(subscriptionForm.planId),
        duration: subscriptionForm.duration,
        startDate: subscriptionForm.startDate
      });
      toast.success(data.message || "Subscription added.");
      setModal(null);
      refreshList();
    } catch (error) {
      console.error("Failed to update shop subscription:", error);
      toast.error(error.response?.data?.message || "Could not update subscription.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPlan = plans.find((plan) => String(plan.id) === String(subscriptionForm.planId));
  const subscriptionPrice = selectedPlan ? Number(selectedPlan[`${subscriptionForm.duration}_price`]) : 0;

  return (
    <main className="space-y-3 pb-5">
      <section aria-label="Gold shop summary" className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Shops" value={summary.total_shops} note="All registered gold shops" icon={Store} theme="emerald" />
        <StatCard label="Pending" value={summary.pending_shops} note="Awaiting activation" icon={Clock3} theme="amber" />
        <StatCard label="Active" value={summary.active_shops} note="Active subscriptions" icon={CheckCircle2} theme="sky" />
        <StatCard label="Expired" value={summary.expired_subscriptions} note="Expired subscriptions" icon={ShieldAlert} theme="rose" />
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1 lg:max-w-sm">
            <span className="sr-only">Search gold shops</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }} className="min-h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-[#008577]" placeholder="Search by name, code, owner or mobile..." />
          </label>
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <select value={statusFilter} onChange={(event) => { setLoading(true); setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter by operational shop status" className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#008577]">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
            <select value={planFilter} onChange={(event) => { setLoading(true); setPlanFilter(event.target.value); setPage(1); }} aria-label="Filter by subscription plan" className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#008577]">
              <option value="all">All plans</option>
              {planOptions.map((plan) => <option key={plan.id} value={plan.id}>{plan.displayName}</option>)}
            </select>
            <div className="flex overflow-hidden rounded-lg border border-slate-200">
              <button type="button" title="Table view" aria-label="Table view" onClick={() => setViewMode("table")} className={`inline-flex h-9 w-9 items-center justify-center ${viewMode === "table" ? "bg-slate-100 text-[#00796B]" : "text-slate-400"}`}><List size={16} /></button>
              <button type="button" title="Grid view" aria-label="Grid view" onClick={() => setViewMode("grid")} className={`inline-flex h-9 w-9 items-center justify-center ${viewMode === "grid" ? "bg-slate-100 text-[#00796B]" : "text-slate-400"}`}><LayoutGrid size={16} /></button>
            </div>
            <button type="button" onClick={() => { setSelectedShop(null); setModal("create"); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#00796B] px-3 py-2 text-xs font-bold text-white">
              <Plus size={15} /> Add Gold Shop
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-5" aria-label="Loading shops" role="status">
            {[1, 2, 3].map((row) => <div key={row} className="h-12 animate-pulse rounded-xl bg-stone-100" />)}
          </div>
        ) : loadError ? (
          <div role="alert" className="p-8 text-center text-sm text-rose-700">{loadError}</div>
        ) : !shops.length ? (
          <div className="min-h-36 p-10 text-center">
            <p className="text-sm text-slate-500">No gold shops found. Add one to get started.</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {shops.map((shop) => {
              const isPendingApproval = approvalStatus(shop) === "pending";
              const canActivate = Boolean(shop.approved_at)
                && shop.subscription_status !== "expired"
                && hasCurrentSubscription(shop);
              const action = shop.status === "active" ? "Suspend Shop" : "Activate Shop";
              return (
              <article key={shop.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#00796B]">{shop.shop_code}</p>
                    <h3 className="mt-1 font-bold text-slate-900">{shop.shop_name}</h3>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge value={approvalStatus(shop)} />
                    <p className="mt-1 text-[11px] capitalize text-slate-500">Shop {shop.status}</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="col-span-2"><dt className="text-slate-400">Owner</dt><dd className="mt-1 font-semibold text-slate-700">{shop.owner_name || "—"} </dd></div>
                  <div className="col-span-2"><dt className="text-slate-400">Mobile</dt><dd className="mt-1 font-semibold text-slate-700"></dd></div>
                  <div><dt className="text-slate-400">City</dt><dd className="mt-1 font-semibold text-slate-700">{shop.city || "—"}</dd></div>
                  <div><dt className="text-slate-400">Plan</dt><dd className="mt-1 font-semibold text-slate-700">{shop.plan_name || "No plan"}</dd></div>
                  <div><dt className="text-slate-400">Account type</dt><dd className="mt-1 font-semibold capitalize text-slate-700">{accountPlanTypeLabel(shop)}</dd></div>
                  <div className="col-span-2"><dt className="text-slate-400">Start</dt><dd className="mt-1 font-semibold text-slate-700">{formatDate(shop.account_start_date)}</dd></div>
                  <div className="col-span-2"><dt className="text-slate-400">Expiry</dt><dd className="mt-1 font-semibold text-slate-700">{formatDate(shop.account_end_date)}</dd></div>
                  <div><dt className="text-slate-400">Payment</dt><dd className="mt-1"><StatusBadge value={shop.payment_status || "unpaid"} /></dd></div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  {isPendingApproval && (
                    <>
                      <button
                        type="button"
                        disabled={approvalSubmitting || rejectingShopId !== null}
                        onClick={() => approveShop(shop)}
                        title="Approve and create login"
                        className="whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-50"
                      >
                        {approvalSubmitting && pendingApproval?.id === shop.id ? "Approving…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={approvalSubmitting || rejectingShopId !== null}
                        onClick={() => rejectShop(shop)}
                        title="Reject this shop"
                        className="whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:cursor-wait disabled:opacity-50"
                      >
                        {rejectingShopId === shop.id ? "Rejecting…" : "Reject"}
                      </button>
                    </>
                  )}
                  <div className="flex items-center gap-1">
                  <button type="button" onClick={() => openDetails(shop)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" title="View details and confirm payment"><Eye size={16} /></button>
                  <button type="button" onClick={() => openEdit(shop)} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50" title="Edit shop"><Pencil size={16} /></button>
                  <button type="button" onClick={() => { setSelectedShop(shop); setModal("subscription"); }} className="rounded-lg p-2 text-amber-800 hover:bg-amber-50" title="Change subscription"><CreditCard size={16} /></button>
                  <button type="button" title={canActivate || shop.status === "active" ? action : "Approval and a current paid subscription are required"} aria-label={`${action}: ${shop.shop_name}`} disabled={shop.status !== "active" && !canActivate} onClick={() => changeStatus(shop)} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-35"><CheckCircle2 size={16} /></button>
                  <button type="button" onClick={() => archiveShop(shop)} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50" title="Archive shop"><Trash2 size={16} /></button>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1220px] table-auto overflow-hidden rounded-t-2xl text-left text-sm">
              <thead className="bg-[#075C51] text-[11px] font-bold uppercase tracking-wide text-white">
                <tr>
                  <th className="w-16 whitespace-nowrap rounded-tl-2xl px-4 py-4">S No</th><th className="px-4 py-4">Shop ID</th><th className="px-4 py-4">Shop name</th><th className="px-4 py-4">Owner</th><th className="px-4 py-4">Plan</th><th className="px-4 py-4">Payment</th><th className="px-4 py-4">Approval status</th><th className="px-4 py-4">Review</th><th className="rounded-tr-2xl px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {shops.map((shop, index) => {
                  const hasPaidCurrentSubscription = String(shop.payment_status).toLowerCase() === "paid"
                    && shop.subscription_status !== "expired"
                    && hasCurrentSubscription(shop);
                  const isPendingApproval = approvalStatus(shop) === "pending";
                  const canActivate = Boolean(shop.approved_at) && hasPaidCurrentSubscription;
                  const action = shop.status === "active" ? "Suspend Shop" : "Activate Shop";
                  return (
                    <tr key={shop.id} className="transition hover:bg-amber-50/30">
                      <td className="px-4 py-4">{(page - 1) * PAGE_SIZE + index + 1}</td>
                      <td className="whitespace-nowrap px-4 py-4 font-mono text-xs font-bold text-amber-800">{shop.shop_code}</td>
                      <td className="px-4 py-4"><p className="font-semibold text-stone-800">{shop.shop_name}</p><p className="mt-0.5 text-xs text-stone-500">{shop.email || "No email"}</p></td>
                      <td className="px-4 py-4"><p className="whitespace-nowrap font-medium text-stone-800">{shop.owner_name || "—"}</p><p className="mt-0.5 whitespace-nowrap text-xs text-stone-500">{shop.mobile || "—"}</p></td>
                      <td className="px-4 py-4"><p className="whitespace-nowrap font-medium text-stone-800">{shop.plan_name || "No plan"}</p><p className="mt-0.5 whitespace-nowrap text-xs text-stone-500">Start Date: {formatDate(shop.account_start_date)}</p><p className="whitespace-nowrap text-xs text-stone-500">Expiry: {formatDate(shop.account_end_date)}</p></td>
                      <td className="px-4 py-4"><StatusBadge value={shop.payment_status || "unpaid"} /></td>
                      <td className="px-4 py-4"><StatusBadge value={approvalStatus(shop)} /></td>
                      <td className="px-4 py-4">
                        {isPendingApproval ? (
                          <div className="flex items-center gap-2">
                            <button type="button" disabled={approvalSubmitting || rejectingShopId !== null} aria-label={`Approve ${shop.shop_name}`} onClick={() => approveShop(shop)} className="whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-50">
                              {approvalSubmitting && pendingApproval?.id === shop.id ? "Approving…" : "Approve"}
                            </button>
                            <button type="button" title={`Reject ${shop.shop_name}`} disabled={approvalSubmitting || rejectingShopId !== null} aria-label={`Reject ${shop.shop_name}`} onClick={() => rejectShop(shop)} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 disabled:cursor-wait disabled:opacity-50">
                              <X size={16} aria-hidden="true" />
                            </button>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <button type="button" title="View details and confirm payment" aria-label={`View details and confirm payment for ${shop.shop_name}`} onClick={() => openDetails(shop)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Eye size={16} /></button>
                          <button type="button" title="Edit shop" aria-label={`Edit ${shop.shop_name}`} onClick={() => openEdit(shop)} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><Pencil size={16} /></button>
                          <button type="button" title="Change subscription" aria-label={`Change subscription for ${shop.shop_name}`} onClick={() => { setSelectedShop(shop); setModal("subscription"); }} className="rounded-lg p-2 text-amber-800 hover:bg-amber-50"><CreditCard size={16} /></button>
                          <button type="button" title={canActivate || shop.status === "active" ? action : "Approval and a current paid subscription are required"} aria-label={`${action}: ${shop.shop_name}`} disabled={shop.status !== "active" && !canActivate} onClick={() => changeStatus(shop)} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-35"><CheckCircle2 size={16} /></button>
                          <button type="button" title="Archive shop" aria-label={`Archive ${shop.shop_name}`} onClick={() => archiveShop(shop)} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-5">
          <p className="text-xs text-slate-500">
            Showing {shops.length ? 1 : 0} to {shops.length} of {Number(pagination.total || 0)} gold shops
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => Math.max(current - 1, 1)); }} className="rounded-lg border border-stone-200 p-2 text-stone-600 hover:bg-stone-50 disabled:opacity-40"><ChevronLeft size={17} /></button>
            <button type="button" disabled={page >= (pagination.totalPages || 1) || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); }} className="rounded-lg border border-stone-200 p-2 text-stone-600 hover:bg-stone-50 disabled:opacity-40"><ChevronRight size={17} /></button>
          </div>
        </footer>
      </section>

      {modal === "create" && (
        <AddGoldShop key={formKey} mode="create" plans={plans} submitting={submitting} onCancel={() => setModal(null)} onSubmit={saveShop} />
      )}
      {modal === "edit" && (
        <AddGoldShop mode="edit" initialShop={selectedShop} plans={plans} submitting={submitting} onCancel={() => setModal(null)} onSubmit={saveShop} />
      )}
      {modal === "details" && (
        <Modal title="Gold shop details" onClose={() => setModal(null)} wide>
          <ShopDetails shop={selectedShop} loading={detailLoading} onConfirmPayment={openPaymentConfirmation} />
        </Modal>
      )}
      {paymentToConfirm && selectedShop && (
        <Modal
          title="Confirm subscription payment"
          onClose={() => {
            if (!paymentSubmitting) setPaymentToConfirm(null);
          }}
        >
          <form onSubmit={confirmSubscriptionPayment} className="space-y-4 p-5">
            <p className="text-sm text-slate-600">Confirm only after you have verified that the payment was received. This marks the current subscription as paid and records your reference.</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-xs font-semibold text-slate-500">Amount received</p>
              <p className="mt-1 font-bold text-slate-800">{formatAmount(paymentToConfirm.amount)}</p>
            </div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Transaction / reference ID
              <input
                autoFocus
                required
                maxLength={120}
                value={paymentForm.transactionId}
                onChange={(event) => setPaymentForm((current) => ({ ...current, transactionId: event.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm normal-case"
                placeholder="Enter bank, UPI, or receipt reference"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Payment method
              <select
                required
                value={paymentForm.paymentMethod}
                onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm normal-case"
              >
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" disabled={paymentSubmitting} onClick={() => setPaymentToConfirm(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={paymentSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-[#00796B] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">
                {paymentSubmitting && <LoaderCircle size={16} className="animate-spin" />}
                {paymentSubmitting ? "Confirming…" : "Confirm payment received"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {pendingApproval && (
        <Modal
          title="Verify shop approval"
          onClose={() => {
            if (!approvalSubmitting) setPendingApproval(null);
          }}
        >
          <div className="space-y-4 p-5">
            <p className="text-sm text-slate-600">Confirm the shop and owner details before approving. This creates the Shop Admin account; subscription activation continues through the existing payment workflow.</p>
            <dl className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-semibold text-slate-500">Shop name</dt><dd className="mt-1 font-semibold text-slate-800">{pendingApproval.shop_name || "—"}</dd></div>
              <div><dt className="text-xs font-semibold text-slate-500">Owner name</dt><dd className="mt-1 font-semibold text-slate-800">{pendingApproval.owner_name || "—"}</dd></div>
              <div><dt className="text-xs font-semibold text-slate-500">Email ID</dt><dd className="mt-1 break-all font-semibold text-slate-800">{pendingApproval.email || "—"}</dd></div>
              <div><dt className="text-xs font-semibold text-slate-500">Mobile</dt><dd className="mt-1 font-semibold text-slate-800">{pendingApproval.mobile || "—"}</dd></div>
            </dl>
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">The password set during registration will remain unchanged and will not be displayed.</p>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" disabled={approvalSubmitting} onClick={() => setPendingApproval(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="button" disabled={approvalSubmitting} onClick={confirmApproveShop} className="inline-flex items-center gap-2 rounded-xl bg-[#00796B] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">
                {approvalSubmitting && <LoaderCircle size={16} className="animate-spin" />}
                {approvalSubmitting ? "Approving…" : "Verify & Approve"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {approvalCredentials && (
        <Modal title="Shop Admin login approved" onClose={() => setApprovalCredentials(null)}>
          <div className="space-y-4 p-5">
            <p className="text-sm text-slate-600">
              {approvalCredentials.temporaryPassword
                ? "The account is active. Log in with the mobile number and temporary password below. Email or username can also be used; change the temporary password after login."
                : "The account is active. Log in with the mobile number and the password entered during registration. Email or username can also be used; the password cannot be viewed again because only its secure hash is stored."}
            </p>
            <div className="grid gap-3">
              {approvalCredentials.mobile && (
                <label className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                  Login ID (mobile number)
                  <input readOnly value={approvalCredentials.mobile} className="mt-1.5 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-800" />
                </label>
              )}
              <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-500">
                Email ID (also accepted)
                <input readOnly value={approvalCredentials.identifier} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
              </label>
              {approvalCredentials.username && (
                <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-500">
                  Username
                  <input readOnly value={approvalCredentials.username} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
                </label>
              )}
              {approvalCredentials.userId && (
                <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-500">
                  User ID
                  <input readOnly value={approvalCredentials.userId} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800" />
                </label>
              )}
              {approvalCredentials.name && (
                <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-500">
                  Name
                  <input readOnly value={approvalCredentials.name} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
                </label>
              )}
              {approvalCredentials.temporaryPassword && (
                <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-500">
                  Temporary password
                  <input readOnly value={approvalCredentials.temporaryPassword} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-800" />
                </label>
              )}
              {!approvalCredentials.temporaryPassword && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Use the password created in the Login Credential tab. It is not recoverable from the database.</p>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setApprovalCredentials(null)} className="rounded-xl bg-[#00796B] px-4 py-2.5 text-sm font-bold text-white">Done</button>
            </div>
          </div>
        </Modal>
      )}
      {modal === "subscription" && selectedShop && (
        <Modal title={`Change subscription · ${selectedShop.shop_name}`} onClose={() => setModal(null)}>
          <form onSubmit={submitSubscription} className="space-y-4 p-5">
            <p className="text-sm text-stone-600">A new subscription starts as pending. The server calculates the amount and expiry. After verifying receipt, confirm payment from the shop’s payment history using its transaction/reference ID.</p>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">
              Plan
              <select className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm normal-case" value={subscriptionForm.planId} onChange={(event) => setSubscriptionForm((current) => ({ ...current, planId: event.target.value }))} required>
                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.plan_name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">
              Duration
              <select className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm normal-case" value={subscriptionForm.duration} onChange={(event) => setSubscriptionForm((current) => ({ ...current, duration: event.target.value }))}>
                <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="half_yearly">Half-Yearly</option><option value="yearly">Yearly</option>
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">
              Start date
              <input type="date" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm normal-case" value={subscriptionForm.startDate} onChange={(event) => setSubscriptionForm((current) => ({ ...current, startDate: event.target.value }))} required />
            </label>
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">Price from plan</p>
              <p className="mt-1 text-lg font-bold text-amber-900">{formatAmount(subscriptionPrice)}</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-stone-200 pt-4">
              <button type="button" onClick={() => setModal(null)} className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold">Cancel</button>
              <button type="submit" disabled={submitting || !plans.length} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {submitting && <LoaderCircle size={16} className="animate-spin" />} Save Subscription
              </button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}
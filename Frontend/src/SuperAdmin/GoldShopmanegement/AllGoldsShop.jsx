import CustomSelect from "../../Components/CustomSelect.jsx";
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
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Store,
  Trash2,
  X
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import AddGoldShop from "./AddGoldShop";
import { formatCurrency } from "../../utils/currency";

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
  unpaid: "bg-rose-50 text-rose-800 ring-rose-200",
  failed: "bg-rose-50 text-rose-800 ring-rose-200"
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const getInitials = (value) =>
  String(value || "Shop")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const hasCurrentSubscription = (shop) => shop.subscription_is_current === true
  || Number(shop.subscription_is_current) === 1;
const approvalStatus = (shop) => shop.approval_status || (shop.approved_at ? "approved" : "pending");
const accountPlanTypeLabel = (shop) => shop.account_plan_type === "expired"
  ? "Trial expired"
  : shop.account_plan_type || "—";

const formatAmount = formatCurrency;

const paymentMethodValue = (value) => {
  const method = String(value || "").trim().toLowerCase();
  return method === "bank transfer" ? "bank_transfer" : method;
};

const isVerifiablePayment = (shop, payment) => Boolean(payment)
  && ["pending", "unpaid"].includes(String(payment.payment_status || "").toLowerCase())
  && ["pending", "unpaid"].includes(String(shop.payment_status || "").toLowerCase())
  && Number(payment.subscription_id) === Number(shop.current_subscription_id);

function StatusBadge({ value }) {
  const status = String(value || "pending").toLowerCase();
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ring-inset ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

function StatCard({ label, value, note, icon: Icon, theme }) {
  const themes = {
    emerald: {
      card: "border-emerald-100 border-t-4 border-t-emerald-500 bg-gradient-to-br from-white via-white to-emerald-50",
      icon: "bg-emerald-700 text-white shadow-emerald-900/15",
      note: "text-emerald-700",
      dot: "bg-emerald-500",
      glow: "bg-emerald-300/35"
    },
    amber: {
      card: "border-amber-100 border-t-4 border-t-amber-500 bg-gradient-to-br from-white via-white to-amber-50",
      icon: "bg-amber-500 text-white shadow-amber-900/15",
      note: "text-amber-700",
      dot: "bg-amber-500",
      glow: "bg-amber-300/35"
    },
    sky: {
      card: "border-sky-100 border-t-4 border-t-sky-500 bg-gradient-to-br from-white via-white to-sky-50",
      icon: "bg-sky-700 text-white shadow-sky-900/15",
      note: "text-sky-700",
      dot: "bg-sky-500",
      glow: "bg-sky-300/35"
    },
    rose: {
      card: "border-rose-100 border-t-4 border-t-rose-500 bg-gradient-to-br from-white via-white to-rose-50",
      icon: "bg-rose-600 text-white shadow-rose-900/15",
      note: "text-rose-700",
      dot: "bg-rose-500",
      glow: "bg-rose-300/35"
    }
  };
  const colors = themes[theme];

  return (
    <article className={`group relative isolate flex min-h-36 items-center justify-between gap-4 overflow-hidden rounded-2xl border p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl ${colors.card}`}>
      <span aria-hidden="true" className={`absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl transition duration-300 group-hover:scale-125 ${colors.glow}`} />
      <div className="relative min-w-0">
        <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-black leading-none tracking-tight text-slate-900">{Number(value || 0).toLocaleString("en-IN")}</p>
        <p className={`mt-3 flex items-center gap-1.5 truncate text-[11px] font-bold ${colors.note}`}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} />
          {note}
        </p>
      </div>
      <span className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg ${colors.icon}`}>
        <Icon size={22} strokeWidth={2} />
      </span>
    </article>
  );
}

function Modal({ title, onClose, children, footer, wide = false }) {
  return (
    <div className="fixed inset-0 z-[115] flex h-screen items-center justify-center overflow-hidden bg-slate-950/60 backdrop-blur-sm [height:100dvh]">
      <section role="dialog" aria-modal="true" aria-label={title} className={`flex h-[90vh] min-h-0 w-full ${wide ? "max-w-5xl" : "max-w-2xl"} flex-col overflow-hidden rounded-none bg-[#fbfaf7] shadow-2xl sm:rounded-3xl [height:90dvh]`}>
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-amber-100 bg-[#17241f] px-5 py-4 text-white">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
            <X size={19} />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div className="my-4 w-full">{children}</div>
        </div>
        {footer && (
          <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-[#fbfaf7] px-4 py-4 sm:px-5">
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
}

const shopInformationFields = (shop) => [
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

function ShopDetails({ shop, loading, onConfirmPayment }) {
  if (loading) {
    return <div className="flex min-h-48 items-center justify-center text-stone-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading shop details…</div>;
  }
  if (!shop) return <p className="p-6 text-sm text-stone-600">Shop details could not be loaded.</p>;

  const detailFields = shopInformationFields(shop);

  return (
    <div className="w-full space-y-5">
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
  const [approvalDetailLoadingShopId, setApprovalDetailLoadingShopId] = useState(null);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [rejectingShopId, setRejectingShopId] = useState(null);
  const [approvalCredentials, setApprovalCredentials] = useState(null);
  const [paymentVerification, setPaymentVerification] = useState(null);
  const [paymentDetailsLoadingShopId, setPaymentDetailsLoadingShopId] = useState(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ transactionId: "", paymentMethod: "", verificationRemarks: "" });
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
    setLoadError("");
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
        if (!Array.isArray(data?.shops) || !data?.pagination || !data?.summary) {
          throw new TypeError("Gold shop list response is invalid");
        }
        setShops(data.shops);
        setPagination(data.pagination);
        setSummary(data.summary);
      }).catch((error) => {
        console.error("Failed to refresh gold shops:", error);
        const message = error.response?.data?.message || "Could not refresh gold shops.";
        setLoadError(message);
        toast.error(message);
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

  const openPaymentConfirmation = () => {
    if (selectedShop) openShopPaymentConfirmation(selectedShop);
  };

  const openShopPaymentConfirmation = async (shopRow) => {
    setPaymentDetailsLoadingShopId(shopRow.id);
    try {
      const { data } = await api.get(`/super-admin/gold-shops/${shopRow.id}/payment`);
      const shop = data?.shop;
      if (!data || !shop || !Array.isArray(shop.payments)
        || !Object.prototype.hasOwnProperty.call(data, "payment")) {
        throw new TypeError("Gold shop payment details response is invalid");
      }
      const payment = data.payment;
      setPaymentVerification({ shop, payment });
      setPaymentForm({
        transactionId: payment?.transaction_id || "",
        paymentMethod: paymentMethodValue(payment?.payment_method) || "upi",
        verificationRemarks: ""
      });
    } catch (error) {
      console.error("Failed to load gold shop payment details:", error);
      toast.error(error.response?.data?.message || "Could not load this shop's payment details.");
    } finally {
      setPaymentDetailsLoadingShopId(null);
    }
  };

  const confirmSubscriptionPayment = async (event) => {
    event.preventDefault();
    if (!paymentVerification?.shop || !paymentVerification.payment || paymentSubmitting) return;
    const { shop, payment } = paymentVerification;
    if (!isVerifiablePayment(shop, payment)) return;
    if (!window.confirm(`Confirm the ${formatAmount(payment.amount)} payment for ${shop.shop_name}? Only continue after independently verifying the transaction.`)) return;
    setPaymentSubmitting(true);
    try {
      const { data } = await api.put(
        `/super-admin/gold-shops/${shop.id}/payment/verify`,
        paymentForm
      );
      if (!data?.shop) throw new TypeError("Payment confirmation response is invalid");
      setSelectedShop(data.shop);
      setPaymentVerification(null);
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

  const approveShop = async (shop) => {
    setApprovalDetailLoadingShopId(shop.id);
    try {
      const { data } = await api.get(`/super-admin/gold-shops/${shop.id}`);
      if (!data?.shop) throw new TypeError("Gold shop details response is invalid");
      setPendingApproval(data.shop);
    } catch (error) {
      console.error("Failed to load gold shop details for approval:", error);
      toast.error(error.response?.data?.message || "Could not load all shop details for approval.");
    } finally {
      setApprovalDetailLoadingShopId(null);
    }
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
  const hasFilters = Boolean(search.trim()) || statusFilter !== "all" || planFilter !== "all";
  const firstVisibleShop = shops.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastVisibleShop = shops.length ? firstVisibleShop + shops.length - 1 : 0;

  return (
    <main className="space-y-5 pb-6">
      <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-[#063B35] via-[#075F54] to-[#0D776D] p-5 text-white shadow-[0_18px_38px_rgba(4,78,67,0.2)] sm:p-6">
        <div aria-hidden="true" className="absolute -right-12 -top-24 h-64 w-64 rounded-full border border-white/10 bg-white/5" />
        <div aria-hidden="true" className="absolute -right-2 -top-14 h-44 w-44 rounded-full border border-amber-200/20 bg-amber-300/10 blur-sm" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-amber-200 shadow-inner">
              <Store size={23} />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Super Admin · Control Center</p>
              <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">Gold shop portfolio</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-emerald-50/80 sm:text-sm">Manage onboarding, approvals, subscriptions, and payment verification from one place.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-bold text-white/90 backdrop-blur">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              Shop operations
            </span>
            <button
              type="button"
              onClick={() => { setSelectedShop(null); setModal("create"); }}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-400 px-4 py-2.5 text-sm font-extrabold text-emerald-950 shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:from-amber-200 hover:to-yellow-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/40"
            >
              <Plus size={17} /> Add Gold Shop
            </button>
          </div>
        </div>
      </section>

      <section aria-label="Gold shop summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Shops" value={summary.total_shops} note="All registered gold shops" icon={Store} theme="emerald" />
        <StatCard label="Pending" value={summary.pending_shops} note="Awaiting activation" icon={Clock3} theme="amber" />
        <StatCard label="Active" value={summary.active_shops} note="Active subscriptions" icon={CheckCircle2} theme="sky" />
        <StatCard label="Expired" value={summary.expired_subscriptions} note="Expired subscriptions" icon={ShieldAlert} theme="rose" />
      </section>

      <section aria-label="Shop search and filters" className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search gold shops</span>
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700" />
            <input
              value={search}
              onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-3.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100/70"
              placeholder="Search by shop, code, owner, or mobile..."
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
            <span className="inline-flex items-center gap-1.5 pr-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              <SlidersHorizontal size={14} /> Filters
            </span>
            <CustomSelect value={statusFilter} onChange={(event) => { setLoading(true); setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter by operational shop status" className="min-h-10 min-w-[145px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition hover:border-emerald-300 focus:border-emerald-600">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </CustomSelect>
            <CustomSelect value={planFilter} onChange={(event) => { setLoading(true); setPlanFilter(event.target.value); setPage(1); }} aria-label="Filter by subscription plan" className="min-h-10 min-w-[145px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition hover:border-emerald-300 focus:border-emerald-600">
              <option value="all">All plans</option>
              {planOptions.map((plan) => <option key={plan.id} value={plan.id}>{plan.displayName}</option>)}
            </CustomSelect>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setPlanFilter("all");
                  setPage(1);
                  setLoading(true);
                }}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"
              >
                <RotateCcw size={14} /> Reset
              </button>
            )}
            <div className="ml-auto inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button type="button" title="Table view" aria-label="Table view" aria-pressed={viewMode === "table"} onClick={() => setViewMode("table")} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition ${viewMode === "table" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-400 hover:text-slate-700"}`}><List size={16} /></button>
              <button type="button" title="Grid view" aria-label="Grid view" aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition ${viewMode === "grid" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-400 hover:text-slate-700"}`}><LayoutGrid size={16} /></button>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.07)]">
        <header className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-sm font-extrabold tracking-tight text-slate-800">Shop directory</h2>
            <p className="mt-0.5 text-xs text-slate-500">Review each shop’s plan, payment, and approval status.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {Number(pagination.total || 0).toLocaleString("en-IN")} shops
          </span>
        </header>
        {loading ? (
          <div className="space-y-3 p-5" aria-label="Loading shops" role="status">
            {[1, 2, 3, 4].map((row) => <div key={row} className="h-14 animate-pulse rounded-xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100" />)}
          </div>
        ) : loadError ? (
          <div role="alert" className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><ShieldAlert size={22} /></span>
            <p className="max-w-md text-sm font-semibold text-rose-800">{loadError}</p>
            <button type="button" onClick={refreshList} className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50">Try again</button>
          </div>
        ) : !shops.length ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100"><Store size={25} /></span>
            <h3 className="mt-4 text-sm font-extrabold text-slate-800">{hasFilters ? "No shops match these filters" : "No gold shops yet"}</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{hasFilters ? "Try changing the search or filters to find the shop you’re looking for." : "Create the first shop to begin managing onboarding and subscriptions."}</p>
            {hasFilters ? (
              <button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); setPlanFilter("all"); setPage(1); setLoading(true); }} className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-800">
                <RotateCcw size={14} /> Clear filters
              </button>
            ) : (
              <button type="button" onClick={() => { setSelectedShop(null); setModal("create"); }} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700">
                <Plus size={15} /> Add Gold Shop
              </button>
            )}
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
              <article key={shop.id} className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-emerald-50/40 p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-600 text-xs font-black text-white shadow-md shadow-emerald-900/15">
                      {getInitials(shop.shop_name)}
                    </span>
                    <div className="min-w-0">
                      <p className="inline-flex rounded-md bg-amber-50 px-2 py-1 font-mono text-[10px] font-black tracking-wide text-amber-800">{shop.shop_code}</p>
                      <h3 className="mt-1 truncate font-bold text-slate-900">{shop.shop_name}</h3>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge value={approvalStatus(shop)} />
                    <p className="mt-1 text-[11px] capitalize text-slate-500">Shop {shop.status}</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="col-span-2 rounded-xl border border-slate-100 bg-white/80 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Owner</dt><dd className="mt-1 font-semibold text-slate-700">{shop.owner_name || "—"}</dd></div>
                  <div className="col-span-2 rounded-xl border border-slate-100 bg-white/80 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Mobile</dt><dd className="mt-1 font-semibold text-slate-700">{shop.mobile || "—"}</dd></div>
                  <div className="rounded-xl border border-slate-100 bg-white/80 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">City</dt><dd className="mt-1 truncate font-semibold text-slate-700">{shop.city || "—"}</dd></div>
                  <div className="rounded-xl border border-slate-100 bg-white/80 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Plan</dt><dd className="mt-1 truncate font-semibold text-slate-700">{shop.plan_name || "No plan"}</dd></div>
                  <div className="rounded-xl border border-slate-100 bg-white/80 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Account type</dt><dd className="mt-1 truncate font-semibold capitalize text-slate-700">{accountPlanTypeLabel(shop)}</dd></div>
                  <div className="rounded-xl border border-slate-100 bg-white/80 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Payment</dt><dd className="mt-1"><StatusBadge value={shop.payment_status || "unpaid"} /></dd></div>
                  <div className="rounded-xl border border-slate-100 bg-white/80 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Start</dt><dd className="mt-1 font-semibold text-slate-700">{formatDate(shop.account_start_date)}</dd></div>
                  <div className="rounded-xl border border-slate-100 bg-white/80 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Expiry</dt><dd className="mt-1 font-semibold text-slate-700">{formatDate(shop.account_end_date)}</dd></div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  {isPendingApproval && (
                    <>
                      <button
                        type="button"
                        disabled={approvalSubmitting || rejectingShopId !== null || approvalDetailLoadingShopId !== null}
                        onClick={() => approveShop(shop)}
                        title="Approve and create login"
                        className="whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-50"
                      >
                        {approvalDetailLoadingShopId === shop.id ? "Loading…" : approvalSubmitting && pendingApproval?.id === shop.id ? "Approving…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={approvalSubmitting || rejectingShopId !== null || approvalDetailLoadingShopId !== null}
                        onClick={() => rejectShop(shop)}
                        title="Reject this shop"
                        className="whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:cursor-wait disabled:opacity-50"
                      >
                        {rejectingShopId === shop.id ? "Rejecting…" : "Reject"}
                      </button>
                    </>
                  )}
                  <div className="flex items-center gap-1">
                  <button type="button" onClick={() => openDetails(shop)} className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100" title="View details and confirm payment" aria-label={`View details for ${shop.shop_name}`}><Eye size={16} /></button>
                  <button type="button" onClick={() => openEdit(shop)} className="rounded-lg p-2 text-blue-700 transition hover:bg-blue-50" title="Edit shop" aria-label={`Edit ${shop.shop_name}`}><Pencil size={16} /></button>
                  <button type="button" onClick={() => { setSelectedShop(shop); setModal("subscription"); }} className="rounded-lg p-2 text-amber-800 transition hover:bg-amber-50" title="Change subscription" aria-label={`Change subscription for ${shop.shop_name}`}><CreditCard size={16} /></button>
                  <button type="button" title={canActivate || shop.status === "active" ? action : "Approval and a current paid subscription are required"} aria-label={`${action}: ${shop.shop_name}`} disabled={shop.status !== "active" && !canActivate} onClick={() => changeStatus(shop)} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-35"><CheckCircle2 size={16} /></button>
                  <button type="button" onClick={() => archiveShop(shop)} className="rounded-lg p-2 text-rose-700 transition hover:bg-rose-50" title="Archive shop" aria-label={`Archive ${shop.shop_name}`}><Trash2 size={16} /></button>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[1220px] table-auto overflow-hidden rounded-t-2xl text-left text-sm">
              <thead className="bg-gradient-to-r from-[#064E3B] via-[#08796B] to-[#0D776D] text-[10px] font-extrabold uppercase tracking-[0.08em] text-white">
                <tr>
                  <th className="whitespace-nowrap rounded-tl-2xl px-4 py-4">Shop ID</th><th className="px-4 py-4">Shop name</th><th className="px-4 py-4">Owner</th><th className="px-4 py-4">Plan</th><th className="px-4 py-4">Payment confirmation</th><th className="px-4 py-4">Approval status</th><th className="px-4 py-4">Review</th><th className="rounded-tr-2xl px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shops.map((shop) => {
                  const hasPaidCurrentSubscription = String(shop.payment_status).toLowerCase() === "paid"
                    && shop.subscription_status !== "expired"
                    && hasCurrentSubscription(shop);
                  const isPendingApproval = approvalStatus(shop) === "pending";
                  const canActivate = Boolean(shop.approved_at) && hasPaidCurrentSubscription;
                  const action = shop.status === "active" ? "Suspend Shop" : "Activate Shop";
                  const currentPaymentStatus = String(shop.current_payment_status || shop.payment_status || "unpaid").toLowerCase();
                  const canVerifyPayment = Boolean(shop.subscription_id)
                    && ["pending", "unpaid"].includes(currentPaymentStatus);
                  return (
                    <tr key={shop.id} className="transition-colors hover:bg-emerald-50/45">
                      <td className="whitespace-nowrap px-4 py-4"><span className="rounded-md bg-amber-50 px-2 py-1 font-mono text-[11px] font-black text-amber-800">{shop.shop_code}</span></td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-600 text-[10px] font-black text-white shadow-sm shadow-emerald-900/15">{getInitials(shop.shop_name)}</span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-800">{shop.shop_name}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">{shop.email || "No email"}</p>
                            <p className={`mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold capitalize ${shop.status === "active" ? "text-emerald-700" : "text-slate-500"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${shop.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                              Shop {shop.status || "unknown"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-black text-amber-900">{getInitials(shop.owner_name || shop.shop_name)}</span>
                          <div>
                            <p className="whitespace-nowrap font-semibold text-slate-700">{shop.owner_name || "—"}</p>
                            <p className="mt-1 whitespace-nowrap text-xs text-slate-500">{shop.mobile || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4"><p className="whitespace-nowrap font-semibold text-slate-700">{shop.plan_name || "No plan"}</p><p className="mt-1 whitespace-nowrap text-xs text-slate-500">Start: {formatDate(shop.account_start_date)}</p><p className="whitespace-nowrap text-xs text-slate-500">Expiry: {formatDate(shop.account_end_date)}</p></td>
                      <td className="px-4 py-4">
                        {canVerifyPayment ? (
                          <button
                            type="button"
                            disabled={paymentDetailsLoadingShopId !== null}
                            onClick={() => openShopPaymentConfirmation(shop)}
                            className="whitespace-nowrap rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-50"
                          >
                            {paymentDetailsLoadingShopId === shop.id ? "Loading…" : "Verify Payment"}
                          </button>
                        ) : currentPaymentStatus === "paid" ? (
                          <StatusBadge value="paid" />
                        ) : currentPaymentStatus === "failed" ? (
                          <span className="inline-flex whitespace-nowrap rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-800 ring-1 ring-inset ring-rose-200">Payment Failed</span>
                        ) : (
                          <StatusBadge value={currentPaymentStatus} />
                        )}
                      </td>
                      <td className="px-4 py-4"><StatusBadge value={approvalStatus(shop)} /></td>
                      <td className="px-4 py-4">
                        {isPendingApproval ? (
                          <div className="flex items-center gap-2">
                            <button type="button" disabled={approvalSubmitting || rejectingShopId !== null || approvalDetailLoadingShopId !== null} aria-label={`Approve ${shop.shop_name}`} onClick={() => approveShop(shop)} className="whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-50">
                              {approvalDetailLoadingShopId === shop.id ? "Loading…" : approvalSubmitting && pendingApproval?.id === shop.id ? "Approving…" : "Approve"}
                            </button>
                            <button type="button" title={`Reject ${shop.shop_name}`} disabled={approvalSubmitting || rejectingShopId !== null || approvalDetailLoadingShopId !== null} aria-label={`Reject ${shop.shop_name}`} onClick={() => rejectShop(shop)} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 disabled:cursor-wait disabled:opacity-50">
                              <X size={16} aria-hidden="true" />
                            </button>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="inline-flex items-center gap-0.5 rounded-xl border border-slate-100 bg-slate-50 p-1">
                          <button type="button" title="View details and confirm payment" aria-label={`View details and confirm payment for ${shop.shop_name}`} onClick={() => openDetails(shop)} className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"><Eye size={16} /></button>
                          <button type="button" title="Edit shop" aria-label={`Edit ${shop.shop_name}`} onClick={() => openEdit(shop)} className="rounded-lg p-2 text-blue-700 transition hover:bg-blue-50"><Pencil size={16} /></button>
                          <button type="button" title="Change subscription" aria-label={`Change subscription for ${shop.shop_name}`} onClick={() => { setSelectedShop(shop); setModal("subscription"); }} className="rounded-lg p-2 text-amber-800 transition hover:bg-amber-50"><CreditCard size={16} /></button>
                          <button type="button" title={canActivate || shop.status === "active" ? action : "Approval and a current paid subscription are required"} aria-label={`${action}: ${shop.shop_name}`} disabled={shop.status !== "active" && !canActivate} onClick={() => changeStatus(shop)} className="rounded-lg p-2 text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-35"><CheckCircle2 size={16} /></button>
                          <button type="button" title="Archive shop" aria-label={`Archive ${shop.shop_name}`} onClick={() => archiveShop(shop)} className="rounded-lg p-2 text-rose-700 transition hover:bg-rose-50"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <footer className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-xs text-slate-500">
            Showing <span className="font-bold text-slate-700">{firstVisibleShop}–{lastVisibleShop}</span> of <span className="font-bold text-slate-700">{Number(pagination.total || 0).toLocaleString("en-IN")}</span> shops
          </p>
          <div className="flex items-center gap-2">
            <span className="mr-1 text-xs font-semibold text-slate-500">Page {page} of {Math.max(Number(pagination.totalPages || 1), 1)}</span>
            <button type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => Math.max(current - 1, 1)); }} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-200 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={17} /></button>
            <button type="button" aria-label="Next page" disabled={page >= (pagination.totalPages || 1) || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); }} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-200 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={17} /></button>
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
      {paymentVerification && (
        <Modal
          title="Verify subscription payment"
          wide
          footer={(
            <>
              <button type="button" disabled={paymentSubmitting} onClick={() => setPaymentVerification(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="submit" form="subscription-payment-form" disabled={paymentSubmitting || !isVerifiablePayment(paymentVerification.shop, paymentVerification.payment)} className="inline-flex items-center gap-2 rounded-xl bg-[#00796B] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">
                {paymentSubmitting && <LoaderCircle size={16} className="animate-spin" />}
                {paymentSubmitting ? "Verifying…" : "Confirm Payment"}
              </button>
            </>
          )}
          onClose={() => {
            if (!paymentSubmitting) setPaymentVerification(null);
          }}
        >
          <form id="subscription-payment-form" onSubmit={confirmSubscriptionPayment} className="space-y-4 p-5">
            <p className="text-sm text-slate-600">Confirm only after you have verified that the payment was received. This marks the current subscription as paid and records your reference.</p>
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-800">Shop details</h3>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs font-semibold text-slate-500">Shop name</dt><dd className="mt-1 font-semibold text-slate-800">{paymentVerification.shop.shop_name || "—"}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">Shop code</dt><dd className="mt-1 font-semibold text-slate-800">{paymentVerification.shop.shop_code || "—"}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">Owner</dt><dd className="mt-1 font-semibold text-slate-800">{paymentVerification.shop.owner_name || "—"}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">Contact</dt><dd className="mt-1 font-semibold text-slate-800">{paymentVerification.shop.mobile || paymentVerification.shop.email || "—"}</dd></div>
              </dl>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-800">Subscription details</h3>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs font-semibold text-slate-500">Plan</dt><dd className="mt-1 font-semibold text-slate-800">{paymentVerification.shop.plan_name || "—"}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">Duration</dt><dd className="mt-1 font-semibold capitalize text-slate-800">{paymentVerification.shop.duration || "—"}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">Start date</dt><dd className="mt-1 font-semibold text-slate-800">{formatDate(paymentVerification.shop.account_start_date || paymentVerification.shop.start_date)}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">End date</dt><dd className="mt-1 font-semibold text-slate-800">{formatDate(paymentVerification.shop.account_end_date || paymentVerification.shop.end_date)}</dd></div>
              </dl>
            </section>
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-800">Payment details</h3>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs font-semibold text-slate-500">Amount</dt><dd className="mt-1 font-bold text-slate-800">{formatAmount(paymentVerification.payment.amount)}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">Status</dt><dd className="mt-1"><StatusBadge value={paymentVerification.payment.payment_status} /></dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">Current method</dt><dd className="mt-1 font-semibold capitalize text-slate-800">{paymentVerification.payment.payment_method?.replaceAll("_", " ") || "Not recorded"}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">Payment date</dt><dd className="mt-1 font-semibold text-slate-800">{formatDate(paymentVerification.payment.payment_date || paymentVerification.payment.created_at)}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs font-semibold text-slate-500">Existing reference</dt><dd className="mt-1 break-all font-semibold text-slate-800">{paymentVerification.payment.transaction_id || "Not recorded"}</dd></div>
              </dl>
            </section>
            <div className="grid gap-4 sm:grid-cols-2">
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
                <CustomSelect
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
                </CustomSelect>
              </label>
            </div>
          </form>
        </Modal>
      )}
      {pendingApproval && (
        <Modal
          title="Verify shop approval"
          wide
          footer={(
            <>
              <button type="button" disabled={approvalSubmitting} onClick={() => setPendingApproval(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="button" disabled={approvalSubmitting} onClick={confirmApproveShop} className="inline-flex items-center gap-2 rounded-xl bg-[#00796B] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">
                {approvalSubmitting && <LoaderCircle size={16} className="animate-spin" />}
                {approvalSubmitting ? "Approving…" : "Verify & Approve"}
              </button>
            </>
          )}
          onClose={() => {
            if (!approvalSubmitting) setPendingApproval(null);
          }}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Confirm the shop and owner details before approving. This creates the Shop Admin account; subscription activation continues through the existing payment workflow.</p>
            <section>
              <h3 className="mb-3 font-bold text-slate-800">Shop information</h3>
              <dl className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg bg-white p-3"><dt className="text-xs font-semibold text-slate-500">Shop name</dt><dd className="mt-1 font-semibold text-slate-800">{pendingApproval.shop_name || "—"}</dd></div>
                <div className="rounded-lg bg-white p-3"><dt className="text-xs font-semibold text-slate-500">Shop UUID</dt><dd className="mt-1 break-all font-semibold text-slate-800">{pendingApproval.shop_uuid || "—"}</dd></div>
                <div className="rounded-lg bg-white p-3"><dt className="text-xs font-semibold text-slate-500">Shop status</dt><dd className="mt-1 font-semibold capitalize text-slate-800">{pendingApproval.status || "—"}</dd></div>
                {shopInformationFields(pendingApproval).map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-white p-3">
                    <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                    <dd className="mt-1 break-words whitespace-pre-wrap font-semibold text-slate-800">{value || "—"}</dd>
                  </div>
                ))}
                <div className="rounded-lg bg-white p-3 sm:col-span-2 lg:col-span-3">
                  <dt className="text-xs font-semibold text-slate-500">Admin notes</dt>
                  <dd className="mt-1 whitespace-pre-wrap font-semibold text-slate-800">{pendingApproval.notes || "—"}</dd>
                </div>
              </dl>
            </section>
            <section>
              <h3 className="mb-3 font-bold text-slate-800">Current subscription</h3>
              {pendingApproval.current_subscription_id ? (
                <dl className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div><dt className="text-xs font-semibold text-slate-500">Plan</dt><dd className="mt-1 font-semibold text-slate-800">{pendingApproval.plan_name || "—"}</dd></div>
                  <div><dt className="text-xs font-semibold text-slate-500">Account type</dt><dd className="mt-1 font-semibold capitalize text-slate-800">{accountPlanTypeLabel(pendingApproval)}</dd></div>
                  <div><dt className="text-xs font-semibold text-slate-500">Duration / amount</dt><dd className="mt-1 font-semibold capitalize text-slate-800">{pendingApproval.duration || "—"} · {formatAmount(pendingApproval.subscription_amount)}</dd></div>
                  <div><dt className="text-xs font-semibold text-slate-500">Start date</dt><dd className="mt-1 font-semibold text-slate-800">{formatDate(pendingApproval.account_start_date)}</dd></div>
                  <div><dt className="text-xs font-semibold text-slate-500">Expiry</dt><dd className="mt-1 font-semibold text-slate-800">{formatDate(pendingApproval.account_end_date)}</dd></div>
                  <div><dt className="text-xs font-semibold text-slate-500">Subscription status</dt><dd className="mt-1 font-semibold capitalize text-slate-800">{pendingApproval.subscription_status || "—"}</dd></div>
                  <div><dt className="text-xs font-semibold text-slate-500">Payment status</dt><dd className="mt-1 font-semibold capitalize text-slate-800">{pendingApproval.payment_status || "—"}</dd></div>
                </dl>
              ) : <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No subscription history.</p>}
            </section>
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">The password set during registration will remain unchanged and will not be displayed.</p>
          </div>
        </Modal>
      )}
      {approvalCredentials && (
        <Modal
          title="Shop Admin login approved"
          onClose={() => setApprovalCredentials(null)}
          footer={<button type="button" onClick={() => setApprovalCredentials(null)} className="rounded-xl bg-[#00796B] px-4 py-2.5 text-sm font-bold text-white">Done</button>}
        >
          <div className="space-y-4">
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
          </div>
        </Modal>
      )}
      {modal === "subscription" && selectedShop && (
        <Modal
          title={`Change subscription · ${selectedShop.shop_name}`}
          onClose={() => setModal(null)}
          footer={(
            <>
              <button type="button" onClick={() => setModal(null)} className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold">Cancel</button>
              <button type="submit" form="shop-subscription-form" disabled={submitting || !plans.length} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {submitting && <LoaderCircle size={16} className="animate-spin" />} Save Subscription
              </button>
            </>
          )}
        >
          <form id="shop-subscription-form" onSubmit={submitSubscription} className="space-y-4">
            <p className="text-sm text-stone-600">A new subscription starts as pending. The server calculates the amount and expiry. After verifying receipt, confirm payment from the shop’s payment history using its transaction/reference ID.</p>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">
              Plan
              <CustomSelect className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm normal-case" value={subscriptionForm.planId} onChange={(event) => setSubscriptionForm((current) => ({ ...current, planId: event.target.value }))} required>
                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.plan_name}</option>)}
              </CustomSelect>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">
              Duration
              <CustomSelect className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm normal-case" value={subscriptionForm.duration} onChange={(event) => setSubscriptionForm((current) => ({ ...current, duration: event.target.value }))}>
                <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="half_yearly">Half-Yearly</option><option value="yearly">Yearly</option>
              </CustomSelect>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">
              Start date
              <input type="date" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm normal-case" value={subscriptionForm.startDate} onChange={(event) => setSubscriptionForm((current) => ({ ...current, startDate: event.target.value }))} required />
            </label>
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">Price from plan</p>
              <p className="mt-1 text-lg font-bold text-amber-900">{formatAmount(subscriptionPrice)}</p>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}
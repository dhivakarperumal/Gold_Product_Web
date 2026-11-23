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
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
  Trash2,
  X
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../api";
import AddGoldShop from "./AddGoldShop";

const PAGE_SIZE = 10;

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  inactive: "bg-stone-100 text-stone-700 ring-stone-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
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

function ShopDetails({ shop, loading }) {
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
        <StatusBadge value={shop.status} />
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
            <div><p className="text-xs text-stone-500">Duration / amount</p><p className="mt-1 font-semibold capitalize">{shop.duration} · {formatAmount(shop.subscription_amount)}</p></div>
            <div><p className="text-xs text-stone-500">Period</p><p className="mt-1 font-semibold">{formatDate(shop.start_date)} – {formatDate(shop.end_date)}</p></div>
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
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="p-3">Transaction</th><th className="p-3">Amount</th><th className="p-3">Method</th><th className="p-3">Status</th><th className="p-3">Date</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {(shop.payments || []).map((payment) => (
                <tr key={payment.id}>
                  <td className="p-3">{payment.transaction_id || "Awaiting gateway"}</td>
                  <td className="p-3">{formatAmount(payment.amount)}</td>
                  <td className="p-3">{payment.payment_method || "—"}</td>
                  <td className="p-3"><StatusBadge value={payment.payment_status} /></td>
                  <td className="p-3">{formatDate(payment.payment_date || payment.created_at)}</td>
                </tr>
              ))}
              {!shop.payments?.length && <tr><td className="p-4 text-stone-500" colSpan="5">No payments recorded.</td></tr>}
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
      const { subscription, ...shop } = payload;
      const response = modal === "edit"
        ? await api.put(`/super-admin/gold-shops/${selectedShop.id}`, shop)
        : await api.post("/super-admin/gold-shops", { ...shop, subscription });
      toast.success(response.data?.message || (modal === "edit" ? "Shop updated." : "Gold shop created."));
      if (addAnother) {
        setFormKey((key) => key + 1);
      } else {
        setModal(null);
      }
      refreshList();
    } catch (error) {
      console.error("Failed to save gold shop:", error);
      toast.error(error.response?.data?.message || "Could not save this gold shop.");
    } finally {
      setSubmitting(false);
    }
  };

  const openDetails = (shop) => {
    setSelectedShop(shop);
    setDetailLoading(true);
    setModal("details");
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Gold Shops Management</h1>
          <p className="mt-1 mb-5 text-sm text-slate-500">Manage all registered gold shops.</p>
        </div>
      </header>

      <section aria-label="Gold shop summary" className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Shops" value={summary.total_shops} note="All registered gold shops" icon={Store} theme="emerald" />
        <StatCard label="Pending" value={summary.pending_shops} note="Awaiting activation" icon={Clock3} theme="amber" />
        <StatCard label="Active" value={summary.active_shops} note="Active subscriptions" icon={CheckCircle2} theme="sky" />
        <StatCard label="Expired" value={summary.expired_subscriptions} note="Expired subscriptions" icon={ShieldAlert} theme="rose" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-2.5 border-b border-slate-100 p-3 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1 lg:max-w-sm">
            <span className="sr-only">Search gold shops</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }} className="min-h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-[#008577]" placeholder="Search by name, code, owner or mobile..." />
          </label>
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <select value={statusFilter} onChange={(event) => { setLoading(true); setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter by shop status" className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#008577]">
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
        {loading ? (
          <div className="space-y-3 p-5" aria-label="Loading shops" role="status">
            {[1, 2, 3].map((row) => <div key={row} className="h-12 animate-pulse rounded-xl bg-stone-100" />)}
          </div>
        ) : loadError ? (
          <div role="alert" className="p-8 text-center text-sm text-rose-700">{loadError}</div>
        ) : !shops.length ? (
          <div className="p-10 text-center">
            <Store className="mx-auto h-10 w-10 text-stone-300" />
            <p className="mt-3 font-semibold text-stone-700">No gold shops found</p>
            <p className="mt-1 text-sm text-stone-500">Add a shop or adjust your search and filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-stone-50 text-[11px] uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">Shop ID</th><th className="px-4 py-3">Shop name</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Mobile</th><th className="px-4 py-3">City</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Shop status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {shops.map((shop) => {
                  const canActivate = shop.payment_status === "paid" && shop.subscription_status !== "expired";
                  const action = shop.status === "active" ? "Suspend Shop" : "Activate Shop";
                  return (
                    <tr key={shop.id} className="transition hover:bg-amber-50/30">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-amber-800">{shop.shop_code}</td>
                      <td className="px-4 py-3"><p className="font-semibold text-stone-800">{shop.shop_name}</p><p className="mt-0.5 text-xs text-stone-500">{shop.email || "No email"}</p></td>
                      <td className="whitespace-nowrap px-4 py-3">{shop.owner_name}</td>
                      <td className="whitespace-nowrap px-4 py-3">{shop.mobile}</td>
                      <td className="whitespace-nowrap px-4 py-3"><span className="inline-flex items-center gap-1"><MapPin size={13} className="text-stone-400" />{shop.city || "—"}</span></td>
                      <td className="whitespace-nowrap px-4 py-3">{shop.plan_name || "No plan"}</td>
                      <td className="whitespace-nowrap px-4 py-3">{formatDate(shop.subscription_expiry)}</td>
                      <td className="px-4 py-3"><StatusBadge value={shop.payment_status || "unpaid"} /></td>
                      <td className="px-4 py-3"><StatusBadge value={shop.status} /></td>
                      <td className="whitespace-nowrap px-4 py-3">{formatDate(shop.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button type="button" title="View details" aria-label={`View ${shop.shop_name}`} onClick={() => openDetails(shop)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Eye size={16} /></button>
                          <button type="button" title="Edit shop" aria-label={`Edit ${shop.shop_name}`} onClick={() => openEdit(shop)} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><Pencil size={16} /></button>
                          <button type="button" title="Change subscription" aria-label={`Change subscription for ${shop.shop_name}`} onClick={() => { setSelectedShop(shop); setModal("subscription"); }} className="rounded-lg p-2 text-amber-800 hover:bg-amber-50"><CreditCard size={16} /></button>
                          <button type="button" title={canActivate || shop.status === "active" ? action : "Payment confirmation required"} aria-label={`${action}: ${shop.shop_name}`} disabled={shop.status !== "active" && !canActivate} onClick={() => changeStatus(shop)} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-35"><CheckCircle2 size={16} /></button>
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
        <footer className="flex items-center justify-between border-t border-stone-100 px-4 py-3 sm:px-5">
          <p className="text-xs text-stone-500">Page {pagination.page || page} of {Math.max(pagination.totalPages || 1, 1)}</p>
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
          <ShopDetails shop={selectedShop} loading={detailLoading} />
        </Modal>
      )}
      {modal === "subscription" && selectedShop && (
        <Modal title={`Change subscription · ${selectedShop.shop_name}`} onClose={() => setModal(null)}>
          <form onSubmit={submitSubscription} className="space-y-4 p-5">
            <p className="text-sm text-stone-600">A new subscription starts as pending. The server calculates the amount and expiry; payment status is set by the gateway.</p>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">
              Plan
              <select className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm normal-case" value={subscriptionForm.planId} onChange={(event) => setSubscriptionForm((current) => ({ ...current, planId: event.target.value }))} required>
                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.plan_name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">
              Duration
              <select className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm normal-case" value={subscriptionForm.duration} onChange={(event) => setSubscriptionForm((current) => ({ ...current, duration: event.target.value }))}>
                <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
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
    </div>
  );
}
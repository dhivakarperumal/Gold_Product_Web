import CustomSelect from "../../Components/CustomSelect.jsx";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Copy, Eye, Filter, Layers3, LayoutGrid, List, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../api";
import { formatCurrency } from "../../utils/currency";
import AddSubScription from "./AddSubScription";

const formatAmount = formatCurrency;
const formatDate = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const PAGE_SIZE = 10;

function StatCard({ label, value, icon: Icon, note, loading, theme }) {
  const themes = {
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
    }
  };
  const colors = themes[theme] || themes.forest;

  return (
    <article className={`group relative isolate flex min-h-36 min-w-0 items-center justify-between gap-4 overflow-hidden rounded-2xl border p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl ${colors.card}`}>
      <span aria-hidden="true" className={`absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl transition duration-300 group-hover:scale-125 ${colors.glow}`} />
      <div className="relative min-w-0">
        <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        {loading
          ? <div className="mt-2 h-8 w-28 animate-pulse rounded-lg bg-slate-200/80" />
          : <p className="mt-2 text-3xl font-black leading-none tracking-tight text-slate-900">{Number(value || 0).toLocaleString("en-IN")}</p>}
        <p className={`mt-3 flex items-center gap-1.5 truncate text-[11px] font-bold ${colors.detail}`}>
          {loading
            ? <span className="h-3 w-24 animate-pulse rounded bg-slate-200/80" />
            : (
              <>
                <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} />
                {note}
              </>
            )}
        </p>
      </div>
      <span className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg ${colors.icon}`}><Icon size={22} strokeWidth={2} /></span>
    </article>
  );
}

export default function AllSubscriptionPlan() {
  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState("table");

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/super-admin/subscription-plans", { params: { page, pageSize: PAGE_SIZE, search, status } });
      setPlans(data.plans || []);
      setSummary(data.summary || {});
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load subscription plans.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPlans(), 200);
    return () => window.clearTimeout(timer);
  }, [loadPlans]);

  const openCreate = () => { setSelected(null); setModal("create"); };
  const openEdit = (plan) => { setSelected(plan); setModal("edit"); };

  const savePlan = async (payload) => {
    setSubmitting(true);
    try {
      const response = modal === "edit"
        ? await api.put(`/super-admin/subscription-plans/${selected.id}`, payload)
        : await api.post("/super-admin/subscription-plans", payload);
      toast.success(response.data.message || "Subscription plan saved.");
      setModal(null);
      await loadPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save subscription plan.");
    } finally {
      setSubmitting(false);
    }
  };

  const viewPlan = async (plan) => {
    try {
      const { data } = await api.get(`/super-admin/subscription-plans/${plan.id}`);
      setSelected(data.plan); setModal("view");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load plan details.");
    }
  };

  const toggleStatus = async (plan) => {
    const next = plan.status === "active" ? "inactive" : "active";
    if (!window.confirm(`${next === "active" ? "Activate" : "Deactivate"} ${plan.plan_name}?`)) return;
    try {
      await api.patch(`/super-admin/subscription-plans/${plan.id}/status`, { status: next });
      toast.success(`Plan ${next}.`);
      await loadPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update plan status.");
    }
  };

  const duplicatePlan = async (plan) => {
    if (!window.confirm(`Duplicate ${plan.plan_name}?`)) return;
    try {
      await api.post(`/super-admin/subscription-plans/${plan.id}/duplicate`);
      toast.success("Plan duplicated.");
      await loadPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not duplicate plan.");
    }
  };

  const deletePlan = async (plan) => {
    if (!window.confirm(`Delete ${plan.plan_name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/super-admin/subscription-plans/${plan.id}`);
      toast.success("Plan deleted.");
      await loadPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete plan.");
    }
  };

  return (
    <main className="space-y-5 pb-6">
      <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-[#063B35] via-[#075F54] to-[#0D776D] p-5 text-white shadow-[0_18px_38px_rgba(4,78,67,0.2)] sm:p-6">
        <div aria-hidden="true" className="absolute -right-12 -top-24 h-64 w-64 rounded-full border border-white/10 bg-white/5" />
        <div aria-hidden="true" className="absolute -right-2 -top-14 h-44 w-44 rounded-full border border-amber-200/20 bg-amber-300/10 blur-sm" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-amber-200 shadow-inner">
              <Layers3 size={23} />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Super Admin · Control Center</p>
              <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">Subscription plan portfolio</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-emerald-50/80 sm:text-sm">Manage pricing, plan availability, and shop subscriptions from one place.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-bold text-white/90 backdrop-blur">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              Plan operations
            </span>
            <button type="button" onClick={openCreate} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-400 px-4 py-2.5 text-sm font-extrabold text-emerald-950 shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:from-amber-200 hover:to-yellow-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/40">
              <Plus size={17} /> Create Plan
            </button>
          </div>
        </div>
      </section>

      <section aria-label="Subscription plan summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Plans" value={summary.total_plans} icon={Layers3} note="All configured plans" loading={loading} theme="forest" />
        <StatCard label="Active Plans" value={summary.active_plans} icon={Layers3} note="Available for shops" loading={loading} theme="blue" />
        <StatCard label="Inactive Plans" value={summary.inactive_plans} icon={Layers3} note="Not currently available" loading={loading} theme="rust" />
        <StatCard label="Shops Using Plans" value={summary.total_shops_using} icon={Layers3} note="With active subscriptions" loading={loading} theme="gold" />
      </section>

      <section aria-label="Plan search and filters" className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search subscription plans</span>
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-700" />
            <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Search by plan name or code..." className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-3.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100/70" />
          </label>
          <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
            <span className="inline-flex items-center gap-1.5 pr-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              <Filter size={14} /> Filters
            </span>
            <div className="group relative inline-flex min-w-[156px] items-center">
              <CustomSelect
                aria-label="Filter subscription plans by status"
                value={status}
                onChange={(event) => { setPage(1); setStatus(event.target.value); }}
                className="min-h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-10 text-xs font-semibold text-slate-700 shadow-none outline-none transition hover:border-emerald-300 focus:border-emerald-600"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </CustomSelect>
            </div>
            {(search || status !== "all") && (
              <button type="button" onClick={() => { setPage(1); setSearch(""); setStatus("all"); }} className="inline-flex min-h-10 items-center rounded-xl px-2.5 text-xs font-bold text-slate-500 transition hover:bg-rose-50 hover:text-rose-700">Clear filters</button>
            )}
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button type="button" title="Table view" aria-label="Table view" aria-pressed={viewMode === "table"} onClick={() => setViewMode("table")} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition ${viewMode === "table" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-400 hover:text-slate-700"}`}>
                <List size={16} />
              </button>
              <button type="button" title="Card view" aria-label="Card view" aria-pressed={viewMode === "card"} onClick={() => setViewMode("card")} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition ${viewMode === "card" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-400 hover:text-slate-700"}`}>
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.07)]">
        <header className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-sm font-extrabold tracking-tight text-slate-800">Plan directory</h2>
            <p className="mt-0.5 text-xs text-slate-500">Review pricing, availability, and active subscriptions for each plan.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {Number(pagination.total || 0).toLocaleString("en-IN")} plans
          </span>
        </header>
        {loading ? (
          <div className="space-y-3 p-5" aria-label="Loading subscription plans" role="status">
            {[1, 2, 3, 4].map((row) => <div key={row} className="h-14 animate-pulse rounded-xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100" />)}
          </div>
        ) : !plans.length ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100"><Layers3 size={25} /></span>
            <h3 className="mt-4 text-sm font-extrabold text-slate-800">{search || status !== "all" ? "No plans match these filters" : "No subscription plans yet"}</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{search || status !== "all" ? "Try changing the search or status filter to find the plan you’re looking for." : "Create the first plan to start managing shop subscriptions."}</p>
            {search || status !== "all" ? (
              <button type="button" onClick={() => { setPage(1); setSearch(""); setStatus("all"); }} className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-800">Clear filters</button>
            ) : (
              <button type="button" onClick={openCreate} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700"><Plus size={15} /> Create Plan</button>
            )}
          </div>
        ) : viewMode === "card" ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.id} className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-emerald-50/40 p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex max-w-full truncate rounded-md bg-amber-50 px-2 py-1 font-mono text-[10px] font-black tracking-wide text-amber-800">{plan.plan_code}</p>
                    <h3 className="mt-2 truncate font-bold text-slate-900">{plan.plan_name}</h3>
                    {plan.is_featured && <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-800">Featured plan</span>}
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ring-1 ring-inset ${plan.status === "active" ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${plan.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {plan.status}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-white/80 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Monthly price</dt><dd className="mt-1 font-extrabold text-slate-800">{formatAmount(plan.monthly_price)}</dd></div>
                  <div className="rounded-xl border border-slate-100 bg-white/80 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Active shops</dt><dd className="mt-1 font-extrabold text-emerald-800">{Number(plan.active_subscriptions || 0).toLocaleString("en-IN")}</dd></div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-semibold text-slate-500">Plan actions</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => viewPlan(plan)} title="View" aria-label={`View ${plan.plan_name}`} className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"><Eye size={16} /></button>
                    <button type="button" onClick={() => openEdit(plan)} title="Edit" aria-label={`Edit ${plan.plan_name}`} className="rounded-lg p-2 text-blue-700 transition hover:bg-blue-50"><Pencil size={16} /></button>
                    <button type="button" onClick={() => duplicatePlan(plan)} title="Duplicate" aria-label={`Duplicate ${plan.plan_name}`} className="rounded-lg p-2 text-violet-700 transition hover:bg-violet-50"><Copy size={16} /></button>
                    <button type="button" onClick={() => toggleStatus(plan)} title={plan.status === "active" ? "Deactivate" : "Activate"} className="rounded-lg px-2 py-1.5 text-[10px] font-bold text-amber-800 transition hover:bg-amber-50">{plan.status === "active" ? "Deactivate" : "Activate"}</button>
                    <button type="button" onClick={() => deletePlan(plan)} title="Delete" aria-label={`Delete ${plan.plan_name}`} className="rounded-lg p-2 text-rose-700 transition hover:bg-rose-50"><Trash2 size={16} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table aria-label="Subscription plans" className="w-full min-w-[1080px] table-auto overflow-hidden rounded-t-2xl text-left text-sm">
              <thead className="bg-gradient-to-r from-[#063B35] via-[#08796B] to-[#0D776D] text-[10px] font-extrabold uppercase tracking-[0.1em] text-white">
                <tr>
                  <th className="whitespace-nowrap rounded-tl-2xl px-4 py-4">S No</th>
                  <th className="whitespace-nowrap px-4 py-4">Plan ID</th>
                  <th className="px-4 py-4">Plan Name</th>
                  <th className="whitespace-nowrap px-4 py-4">Plan Code</th>
                  <th className="whitespace-nowrap px-4 py-4">Monthly</th>
                  <th className="whitespace-nowrap px-4 py-4">Active Shops</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="whitespace-nowrap px-4 py-4">Created</th>
                  <th className="whitespace-nowrap rounded-tr-2xl px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.map((plan, index) => (
                  <tr key={plan.id} className="group transition-colors odd:bg-white even:bg-slate-50/40 hover:bg-emerald-50/60">
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-slate-100 px-2 text-[10px] font-extrabold text-slate-500 transition group-hover:bg-white group-hover:text-emerald-800">{(page - 1) * PAGE_SIZE + index + 1}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className="inline-flex rounded-lg border border-amber-100 bg-gradient-to-br from-amber-50 to-white px-2.5 py-1.5 font-mono text-[10px] font-black tracking-wide text-amber-800 shadow-sm">#{String(plan.id).padStart(4, "0")}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ${plan.is_featured ? "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-900/15" : "bg-gradient-to-br from-emerald-700 to-emerald-600 text-white shadow-emerald-900/15"}`}><Layers3 size={16} /></span>
                        <div className="min-w-0">
                          <p className="truncate font-extrabold text-slate-800">{plan.plan_name}</p>
                          {plan.is_featured && <span className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wide text-amber-700"><span className="h-1 w-1 rounded-full bg-amber-500" />Featured plan</span>}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4"><span className="inline-flex rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-wide text-slate-600">{plan.plan_code}</span></td>
                    <td className="whitespace-nowrap px-4 py-4"><span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-extrabold text-emerald-900 ring-1 ring-inset ring-emerald-100">{formatAmount(plan.monthly_price)}</span></td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className={`inline-flex min-w-10 items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-extrabold ring-1 ring-inset ${Number(plan.active_subscriptions || 0) > 0 ? "bg-sky-50 text-sky-800 ring-sky-100" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>{Number(plan.active_subscriptions || 0).toLocaleString("en-IN")}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-extrabold capitalize ring-1 ring-inset ${plan.status === "active" ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${plan.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />{plan.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4"><span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500"><CalendarDays size={13} className="text-slate-400" />{formatDate(plan.created_at)}</span></td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50 p-1">
                        <button type="button" onClick={() => viewPlan(plan)} title="View" aria-label={`View ${plan.plan_name}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-200 hover:text-slate-900"><Eye size={15} /></button>
                        <button type="button" onClick={() => openEdit(plan)} title="Edit" aria-label={`Edit ${plan.plan_name}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-white text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-100 hover:bg-blue-50"><Pencil size={15} /></button>
                        <button type="button" onClick={() => duplicatePlan(plan)} title="Duplicate" aria-label={`Duplicate ${plan.plan_name}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-white text-violet-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-100 hover:bg-violet-50"><Copy size={15} /></button>
                        <button type="button" onClick={() => toggleStatus(plan)} title={plan.status === "active" ? "Deactivate" : "Activate"} className="rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-[10px] font-extrabold text-amber-800 transition hover:border-amber-200 hover:bg-amber-100">{plan.status === "active" ? "Deactivate" : "Activate"}</button>
                        <button type="button" onClick={() => deletePlan(plan)} title="Delete" aria-label={`Delete ${plan.plan_name}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-white text-rose-700 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-100 hover:bg-rose-50"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">Showing page <span className="font-bold text-slate-700">{Math.min(page, Math.max(pagination.totalPages || 1, 1))}</span> of <span className="font-bold text-slate-700">{Math.max(pagination.totalPages || 1, 1)}</span> · {Number(pagination.total || 0).toLocaleString("en-IN")} total plans</p>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:border-emerald-200 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:border-emerald-200 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </footer>
      </section>

      {(modal === "create" || modal === "edit") && <AddSubScription mode={modal} initialPlan={selected} submitting={submitting} onCancel={() => setModal(null)} onSubmit={savePlan} />}
      {modal === "view" && selected && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
          <section role="dialog" aria-modal="true" aria-label="Plan details" className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-100 bg-[#153B35] px-5 py-4 text-white"><h2 className="text-lg font-bold">{selected.plan_name}</h2><button type="button" onClick={() => setModal(null)} className="rounded-full p-2 hover:bg-white/10"><X size={18} /></button></header>
            <div className="max-h-[75vh] overflow-y-auto p-5">
              <dl className="grid gap-3 sm:grid-cols-2">
                {[["Plan Code", selected.plan_code], ["Description", selected.description], ["Monthly", formatAmount(selected.monthly_price)], ["Quarterly", formatAmount(selected.quarterly_price)], ["Half-Yearly", formatAmount(selected.half_yearly_price)], ["Yearly", formatAmount(selected.yearly_price)], ["Setup Fee", formatAmount(selected.setup_fee)], ["Free Trial", `${selected.free_trial_days || 0} days`], ["Branches", selected.max_branches ?? "Unlimited"], ["Staff", selected.max_staff ?? "Unlimited"], ["Users", selected.max_users ?? "Unlimited"], ["Products", selected.max_products ?? "Unlimited"], ["Monthly Invoices", selected.max_monthly_invoices ?? "Unlimited"], ["Grace Period", `${selected.grace_period_days || 0} days`], ["Status", selected.status], ["Created", formatDate(selected.created_at)]].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-200 p-3"><dt className="text-[10px] font-bold uppercase text-slate-400">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{value || "—"}</dd></div>
                ))}
              </dl>
              <section className="mt-4"><h3 className="text-sm font-bold text-slate-900">Enabled Features</h3><div className="mt-2 flex flex-wrap gap-2">{Object.entries(selected.features || {}).filter(([, enabled]) => enabled).map(([key]) => <span key={key} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{key.replace(/([A-Z])/g, " $1")}</span>)}</div></section>
              {selected.history?.length > 0 && <section className="mt-5"><h3 className="text-sm font-bold text-slate-900">Modification History</h3><div className="mt-2 space-y-2">{selected.history.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">{item.changed_by_name || "System"} · {formatDate(item.changed_at)}</div>)}</div></section>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
import { useCallback, useEffect, useState } from "react";
import { Copy, Eye, Layers3, LayoutGrid, List, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../api";
import AddSubScription from "./AddSubScription";

const formatAmount = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const formatDate = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const PAGE_SIZE = 10;

function StatCard({ label, value, icon: Icon, note, loading, theme }) {
  const themes = {
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
    }
  };
  const colors = themes[theme] || themes.forest;

  return (
    <article className={`relative flex min-h-[176px] min-w-0 items-center gap-4 overflow-hidden rounded-xl border border-l-4 p-4 shadow-md transition-shadow hover:shadow-lg sm:p-5 ${colors.card}`}>
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl shadow-inner ${colors.icon}`}><Icon size={25} strokeWidth={1.9} /></span>
      <div className="min-w-0 flex-1 pb-1">
        <p className={`truncate text-sm font-semibold ${colors.label}`}>{label}</p>
        {loading
          ? <div className="mt-2 h-8 w-28 animate-pulse rounded bg-white/15" />
          : <p className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-[28px]">{Number(value || 0).toLocaleString("en-IN")}</p>}
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
    <main className="space-y-3 pb-5">
      <section className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Plans" value={summary.total_plans} icon={Layers3} note="All configured plans" loading={loading} theme="forest" />
        <StatCard label="Active Plans" value={summary.active_plans} icon={Layers3} note="Available for shops" loading={loading} theme="blue" />
        <StatCard label="Inactive Plans" value={summary.inactive_plans} icon={Layers3} note="Not currently available" loading={loading} theme="rust" />
        <StatCard label="Shops Using Plans" value={summary.total_shops_using} icon={Layers3} note="With active subscriptions" loading={loading} theme="gold" />
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1 lg:max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Search plan name or code..." className="min-h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-[#008577]" />
          </label>
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-700">
              <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
            <div className="flex overflow-hidden rounded-lg border border-slate-200">
              <button type="button" title="Table view" aria-label="Table view" onClick={() => setViewMode("table")} className={`inline-flex h-9 w-9 items-center justify-center ${viewMode === "table" ? "bg-slate-100 text-[#00796B]" : "text-slate-400"}`}>
                <List size={16} />
              </button>
              <button type="button" title="Card view" aria-label="Card view" onClick={() => setViewMode("card")} className={`inline-flex h-9 w-9 items-center justify-center ${viewMode === "card" ? "bg-slate-100 text-[#00796B]" : "text-slate-400"}`}>
                <LayoutGrid size={16} />
              </button>
            </div>
            <button type="button" onClick={openCreate} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#00796B] px-3 py-2 text-xs font-bold text-white"><Plus size={15} />Create Plan</button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading subscription plans…</div>
        ) : !plans.length ? (
          <div className="min-h-36 p-10 text-center text-sm text-slate-500">No subscription plans found. Create one to get started.</div>
        ) : viewMode === "card" ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#00796B]">{plan.plan_code}</p>
                    <h3 className="mt-1 font-bold text-slate-900">{plan.plan_name}</h3>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${plan.status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{plan.status}</span>
                </div>
                {plan.is_featured && <p className="mt-2 text-[10px] font-bold uppercase text-amber-700">Featured Plan</p>}
                <dl className="mt-4 grid grid-cols-1 gap-3 text-xs">
                  <div><dt className="text-slate-400">Monthly</dt><dd className="mt-1 font-semibold text-slate-800">{formatAmount(plan.monthly_price)}</dd></div>
                </dl>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-500">{Number(plan.active_subscriptions || 0)} active subscriptions</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => viewPlan(plan)} title="View" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Eye size={16} /></button>
                    <button type="button" onClick={() => openEdit(plan)} title="Edit" className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><Pencil size={16} /></button>
                    <button type="button" onClick={() => duplicatePlan(plan)} title="Duplicate" className="rounded-lg p-2 text-violet-700 hover:bg-violet-50"><Copy size={16} /></button>
                    <button type="button" onClick={() => toggleStatus(plan)} title={plan.status === "active" ? "Deactivate" : "Activate"} className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-50">{plan.status === "active" ? "Deactivate" : "Activate"}</button>
                    <button type="button" onClick={() => deletePlan(plan)} title="Delete" className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 size={16} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-auto overflow-hidden rounded-t-2xl text-left text-sm">
              <thead className="bg-[#075C51] text-[11px] font-bold uppercase tracking-wide text-white">
                <tr>
                  <th className="rounded-tl-2xl px-4 py-4">S No</th><th className="px-4 py-4">Plan ID</th><th className="px-4 py-4">Plan Name</th><th className="px-4 py-4">Plan Code</th>
                  <th className="px-4 py-4">Monthly</th><th className="px-4 py-4">Active</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Created</th><th className="rounded-tr-2xl px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.map((plan, index) => (
                  <tr key={plan.id} className="hover:bg-amber-50/30">
                    <td className="px-4 py-4">{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td className="px-4 py-4 font-mono text-xs font-bold text-[#00796B]">#{String(plan.id).padStart(4, "0")}</td>
                    <td className="px-4 py-4"><p className="font-semibold text-slate-800">{plan.plan_name}</p>{plan.is_featured && <p className="text-[10px] font-bold uppercase text-amber-700">Featured</p>}</td>
                    <td className="px-4 py-4 font-mono text-xs">{plan.plan_code}</td>
                    <td className="px-4 py-4">{formatAmount(plan.monthly_price)}</td>
                    <td className="px-4 py-4 font-semibold">{Number(plan.active_subscriptions || 0)}</td>
                    <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${plan.status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{plan.status}</span></td>
                    <td className="px-4 py-4">{formatDate(plan.created_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1">
                        <button type="button" onClick={() => viewPlan(plan)} title="View" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Eye size={16} /></button>
                        <button type="button" onClick={() => openEdit(plan)} title="Edit" className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><Pencil size={16} /></button>
                        <button type="button" onClick={() => duplicatePlan(plan)} title="Duplicate" className="rounded-lg p-2 text-violet-700 hover:bg-violet-50"><Copy size={16} /></button>
                        <button type="button" onClick={() => toggleStatus(plan)} title={plan.status === "active" ? "Deactivate" : "Activate"} className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-50">{plan.status === "active" ? "Deactivate" : "Activate"}</button>
                        <button type="button" onClick={() => deletePlan(plan)} title="Delete" className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-500">{pagination.total} total plans</p>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-40">Next</button>
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
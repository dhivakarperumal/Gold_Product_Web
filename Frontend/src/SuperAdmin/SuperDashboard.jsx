import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from "chart.js";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  CreditCard,
  ExternalLink,
  Gem,
  IndianRupee,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Store,
  Users,
  X,
  XCircle
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import api from "../api";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
);

const CURRENCY_FORMAT = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});
const NUMBER_FORMAT = new Intl.NumberFormat("en-IN");
const EMPTY_RECENT_SHOPS = [];

const formatCurrency = (amount) => CURRENCY_FORMAT.format(Number(amount) || 0);
const formatCount = (count) => NUMBER_FORMAT.format(Number(count) || 0);

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatPercentage(value) {
  const change = Number(value) || 0;
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
}

const metricTones = {
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
  },
  indigo: {
    card: "border-[#555E9C] border-l-violet-300 bg-[#292B50]",
    icon: "bg-[#7138E8] text-white",
    label: "text-violet-50/90",
    detail: "text-violet-200",
    bars: "bg-violet-300"
  },
  teal: {
    card: "border-[#34766D] border-l-teal-300 bg-[#153E3A]",
    icon: "bg-[#087D70] text-white",
    label: "text-teal-50/90",
    detail: "text-teal-200",
    bars: "bg-teal-300"
  },
  burgundy: {
    card: "border-[#94475B] border-l-rose-300 bg-[#4A2635]",
    icon: "bg-[#C8103E] text-white",
    label: "text-rose-50/90",
    detail: "text-rose-200",
    bars: "bg-rose-300"
  }
};

function MetricCard({ label, value, icon: Icon, change, note, loading, tone = "forest" }) {
  const isPositive = Number(change) >= 0;
  const colors = metricTones[tone] || metricTones.forest;

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
          : change !== undefined
            ? (
              <>
                {isPositive
                  ? <ArrowUpRight size={14} className={isPositive ? "text-emerald-300" : "text-rose-300"} />
                  : <ArrowDownRight size={14} className="text-rose-300" />}
                <span className={`font-semibold ${isPositive ? "text-emerald-300" : "text-rose-300"}`}>
                  {formatPercentage(change)}
                </span>
                <span className="text-white/60">vs. last month</span>
              </>
            )
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

function Panel({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#1F2937]">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ChartSkeleton() {
  return (
    <div role="status" aria-label="Loading chart" className="flex h-64 items-end gap-3 border-b border-l border-slate-100 px-5 pb-2">
      {[38, 57, 44, 71, 50, 82, 63, 90, 58, 76, 49, 68].map((height, index) => (
        <div key={index} className="flex-1 animate-pulse bg-slate-100" style={{ height: `${height}%` }} />
      ))}
    </div>
  );
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#1F2937",
      padding: 10,
      displayColors: false
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: "#6B7280", maxRotation: 0, autoSkip: true }
    },
    y: {
      beginAtZero: true,
      grid: { color: "#EEF0F3" },
      ticks: { color: "#6B7280", precision: 0 }
    }
  }
};

function StatusBadge({ status }) {
  const value = String(status || "pending").toLowerCase();
  const classes = {
    approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
    pending: "border-amber-200 bg-amber-50 text-amber-800",
    rejected: "border-rose-200 bg-rose-50 text-rose-800",
    paid: "border-emerald-200 bg-emerald-50 text-emerald-800",
    refunded: "border-slate-200 bg-slate-100 text-slate-700",
    failed: "border-rose-200 bg-rose-50 text-rose-800",
    unpaid: "border-amber-200 bg-amber-50 text-amber-800"
  };

  return (
    <span className={`inline-flex border px-2 py-1 text-[11px] font-semibold capitalize ${classes[value] || "border-slate-200 bg-slate-50 text-slate-700"}`}>
      {value}
    </span>
  );
}

function TableLoadingRows({ columns }) {
  return Array.from({ length: 4 }, (_, index) => (
    <tr key={index} aria-hidden="true">
      {Array.from({ length: columns }, (_, columnIndex) => (
        <td key={columnIndex} className="border-b border-slate-100 px-3 py-4">
          <div className="h-3 w-20 animate-pulse bg-slate-100" />
        </td>
      ))}
    </tr>
  ));
}

export default function SuperDashboard() {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [actingOnShop, setActingOnShop] = useState(null);
  const requestId = useRef(0);

  const fetchDashboard = useCallback(async () => {
    const currentRequest = ++requestId.current;
    try {
      const [statsResponse, analyticsResponse] = await Promise.all([
        api.get("/super-admin/dashboard/stats"),
        api.get("/super-admin/dashboard/analytics")
      ]);
      const nextStats = statsResponse.data?.data;
      const nextAnalytics = analyticsResponse.data?.data;
      if (!nextStats || !nextAnalytics || currentRequest !== requestId.current) return;
      setStats(nextStats);
      setAnalytics(nextAnalytics);
      setLastUpdated(new Date());
      setLoadError("");
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      console.error("Failed to load Super Admin dashboard:", error);
      setLoadError(error.response?.data?.message || "Dashboard data could not be loaded.");
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => void fetchDashboard(), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchDashboard();
    }, 30000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void fetchDashboard();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      requestId.current += 1;
    };
  }, [fetchDashboard]);

  const recentShops = Array.isArray(analytics?.recentShops) ? analytics.recentShops : EMPTY_RECENT_SHOPS;

  const revenueChartData = useMemo(() => ({
    labels: (analytics?.monthlyRevenue || []).map((item) => item.label),
    datasets: [{
      label: "Revenue",
      data: (analytics?.monthlyRevenue || []).map((item) => item.revenue),
      backgroundColor: "#07564B",
      hoverBackgroundColor: "#043D37",
      borderRadius: 2,
      maxBarThickness: 30
    }]
  }), [analytics?.monthlyRevenue]);

  const registrationChartData = useMemo(() => ({
    labels: (analytics?.shopRegistrations || []).map((item) => item.label),
    datasets: [{
      label: "Gold shops",
      data: (analytics?.shopRegistrations || []).map((item) => item.registrations),
      borderColor: "#07564B",
      backgroundColor: "rgba(7, 86, 75, 0.12)",
      pointBackgroundColor: "#07564B",
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5
    }]
  }), [analytics?.shopRegistrations]);

  const subscriptionChartData = useMemo(() => ({
    labels: (analytics?.subscriptionGrowth || []).map((item) => item.label),
    datasets: [{
      label: "Subscriptions",
      data: (analytics?.subscriptionGrowth || []).map((item) => item.subscriptions),
      borderColor: "#365C4B",
      backgroundColor: "rgba(54, 92, 75, 0.12)",
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5
    }]
  }), [analytics?.subscriptionGrowth]);

  const shopStatusChartData = useMemo(() => ({
    labels: ["Active", "Expired"],
    datasets: [{
      data: [analytics?.shopStatus?.active || 0, analytics?.shopStatus?.expired || 0],
      backgroundColor: ["#D4A017", "#CBD5E1"],
      borderWidth: 0,
      hoverOffset: 4
    }]
  }), [analytics?.shopStatus]);

  const shopStatusOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: "68%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { usePointStyle: true, padding: 18, color: "#4B5563" }
      }
    }
  }), []);

  const summaryCards = [
    { label: "Total Gold Shops", value: stats?.totalGoldShops, change: stats?.changes?.totalGoldShops, icon: Store, tone: "forest" },
    { label: "Active Gold Shops", value: stats?.activeGoldShops, note: "Approved and active", icon: Building2, tone: "gold" },
    { label: "Pending Gold Shops", value: stats?.pendingGoldShops, note: "Awaiting approval", icon: Clock3, tone: "blue" },
    { label: "Rejected Gold Shops", value: stats?.rejectedGoldShops, note: "Registration declined", icon: XCircle, tone: "rust" },
    { label: "Registered Users", value: stats?.totalUsers, change: stats?.changes?.totalUsers, icon: Users, tone: "slate" },
    { label: "Active Subscriptions", value: stats?.activeSubscriptions, change: stats?.changes?.activeSubscriptions, icon: ShieldCheck, tone: "indigo" },
    { label: "Expired Subscriptions", value: stats?.expiredSubscriptions, note: "Requires renewal", icon: CalendarDays, tone: "teal" },
    { label: "Total Revenue", value: stats?.totalRevenue, change: stats?.changes?.totalRevenue, icon: IndianRupee, currency: true, tone: "burgundy" }
  ];

  const handleShopDecision = async (shop, decision) => {
    const action = decision === "approve" ? "approve" : "reject";
    const prompt = action === "approve"
      ? `Approve ${shop.shop_name}?`
      : `Reject ${shop.shop_name}? This cannot be undone from the dashboard.`;
    if (!window.confirm(prompt)) return;

    setActingOnShop(shop.id);
    try {
      await api.post(`/super-admin/gold-shops/${shop.id}/${action}`);
      toast.success(`Shop ${action === "approve" ? "approved" : "rejected"}.`);
      setRefreshing(true);
      await fetchDashboard();
    } catch (error) {
      console.error(`Failed to ${action} gold shop:`, error);
      toast.error(error.response?.data?.message || `Unable to ${action} this shop.`);
    } finally {
      setActingOnShop(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-8">
      <section
        aria-labelledby="dashboard-welcome-title"
        className="relative flex min-h-[170px] items-center overflow-hidden rounded-xl border border-[#A87908]/70 bg-[#003B32] shadow-sm sm:min-h-[184px]"
      >
        <img
          src="/images/registerbanner1.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#002D27]/95 via-[#003B32]/80 to-[#003B32]/10" />
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2 sm:right-5 sm:top-4">
          {lastUpdated && (
            <span className="hidden text-[10px] text-white/80 sm:inline">
              Updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            type="button"
            aria-label="Refresh dashboard"
            onClick={() => {
              setRefreshing(true);
              void fetchDashboard();
            }}
            disabled={refreshing}
            className="inline-flex h-9 items-center gap-2 border border-white/40 bg-[#003B32]/75 px-2.5 text-xs font-semibold text-white transition hover:bg-[#003B32] disabled:cursor-wait disabled:opacity-60 sm:px-3"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
        <div className="relative z-10 flex min-h-[170px] w-full items-center px-5 sm:min-h-[184px] sm:px-9">
          <div className="max-w-[82%] sm:max-w-[64%]">
            <p className="text-xs font-semibold tracking-wide text-[#FFE39A] sm:text-base">Welcome to</p>
            <h2
              id="dashboard-welcome-title"
              className="mt-0.5 font-serif text-2xl font-bold leading-tight text-[#FFD15C] sm:text-4xl lg:text-5xl"
            >
              Sri Gold Superadmin
            </h2>
            <p className="mt-2 max-w-md text-[10px] leading-relaxed text-white/90 sm:text-sm">
              Manage your gold retail platform from one place.
            </p>
            <div className="mt-3 hidden items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#FFE39A] sm:flex">
              <span>Purity</span><span className="text-white/50">|</span>
              <span>Trust</span><span className="text-white/50">|</span>
              <span>Prosperity</span>
            </div>
          </div>
          <div className="ml-auto hidden max-w-[190px] space-y-3 pr-3 text-[#FFE39A] lg:block">
            <div className="flex items-center gap-2">
              <Gem size={18} className="shrink-0" />
              <span className="text-[9px] font-bold uppercase leading-tight tracking-wide">Traditional Values</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="shrink-0" />
              <span className="text-[9px] font-bold uppercase leading-tight tracking-wide">Modern Management</span>
            </div>
            <div className="flex items-center gap-2">
              <Users size={18} className="shrink-0" />
              <span className="text-[9px] font-bold uppercase leading-tight tracking-wide">Customer Satisfaction</span>
            </div>
          </div>
        </div>
      </section>

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{loadError}</span>
          <button type="button" onClick={() => void fetchDashboard()} className="font-semibold underline underline-offset-2">
            Try again
          </button>
        </div>
      )}

      <section aria-label="Platform statistics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <MetricCard
            key={card.label}
            {...card}
            value={card.currency
              ? (card.value === undefined ? "—" : formatCurrency(card.value))
              : (card.value === undefined ? "—" : formatCount(card.value))}
            loading={loading && !stats}
          />
        ))}
      </section>

      <section aria-labelledby="quick-access-title" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="quick-access-title" className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Quick Actions &amp; Shortcuts</h2>
            <p className="mt-1 text-xs text-slate-500">One-click access to common platform tasks</p>
          </div>
          <span className="border border-[#E8E1CF] bg-[#FBF8F0] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#805B05]">
            Super Admin
          </span>
        </div>
        <nav aria-label="Dashboard shortcuts" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Gold Shop Management", detail: "Review registrations", to: "/superadmin/goldshop", icon: Store, color: "from-[#07564B] to-[#008577]" },
            { label: "User Management", detail: "Manage platform accounts", to: "/superadmin/users", icon: Users, color: "from-[#17364D] to-[#28708A]" },
            { label: "Subscription Plans", detail: "Manage available plans", to: "/superadmin/subscription-plans", icon: CreditCard, color: "from-[#A87908] to-[#D4A017]" },
            { label: "Notifications", detail: "Review platform activity", to: "/superadmin/profile?tab=notifications", icon: Bell, color: "from-[#71384D] to-[#A94760]" }
          ].map(({ label, detail, to, icon: Icon, color }) => (
            <Link
              key={label}
              to={to}
              className="group flex min-h-[132px] flex-col items-center justify-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-4 text-center transition duration-200 hover:-translate-y-0.5 hover:border-[#D4A017]/60 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow-sm transition-transform group-hover:scale-105`}>
                <Icon size={19} strokeWidth={1.8} />
              </span>
              <span className="block text-xs font-bold leading-snug text-slate-800 group-hover:text-[#07564B] sm:text-[13px]">{label}</span>
              <span className="block text-[11px] leading-snug text-slate-500">{detail}</span>
            </Link>
          ))}
        </nav>
      </section>

      <section aria-label="Platform analytics" className="grid gap-4 xl:grid-cols-2">
        <Panel title="Monthly Revenue" subtitle="Collected subscription payments · last 12 months">
          {loading && !analytics
            ? <ChartSkeleton />
            : <div className="h-64"><Bar data={revenueChartData} options={{
              ...chartOptions,
              plugins: {
                ...chartOptions.plugins,
                tooltip: {
                  ...chartOptions.plugins.tooltip,
                  callbacks: { label: (context) => formatCurrency(context.parsed.y) }
                }
              },
              scales: {
                ...chartOptions.scales,
                y: {
                  ...chartOptions.scales.y,
                  ticks: {
                    ...chartOptions.scales.y.ticks,
                    callback: (value) => formatCurrency(value)
                  }
                }
              }
            }} /></div>}
        </Panel>

        <Panel title="Gold Shop Registrations" subtitle="New shop registrations · last 12 months">
          {loading && !analytics
            ? <ChartSkeleton />
            : <div className="h-64"><Line data={registrationChartData} options={chartOptions} /></div>}
        </Panel>

        <Panel title="Subscription Growth" subtitle="Subscriptions created · last 12 months">
          {loading && !analytics
            ? <ChartSkeleton />
            : <div className="h-64"><Line data={subscriptionChartData} options={chartOptions} /></div>}
        </Panel>

        <Panel title="Active vs Expired Shops" subtitle="Latest subscription status for approved shops">
          {loading && !analytics
            ? <ChartSkeleton />
            : (
              <div className="grid min-h-64 grid-cols-1 items-center gap-5 sm:grid-cols-[minmax(0,1fr)_180px]">
                <div className="relative mx-auto h-56 w-full max-w-[260px]">
                  <Doughnut data={shopStatusChartData} options={shopStatusOptions} />
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold text-[#1F2937]">
                      {formatCount((analytics?.shopStatus?.active || 0) + (analytics?.shopStatus?.expired || 0))}
                    </span>
                    <span className="text-xs text-slate-500">Approved shops</span>
                  </div>
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 bg-[#D4A017]" />Active</dt>
                    <dd className="font-semibold text-slate-800">{formatCount(analytics?.shopStatus?.active)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 bg-slate-300" />Expired</dt>
                    <dd className="font-semibold text-slate-800">{formatCount(analytics?.shopStatus?.expired)}</dd>
                  </div>
                </dl>
              </div>
            )}
        </Panel>
      </section>

      <section aria-label="Recent platform activity" className="grid items-start gap-4 xl:grid-cols-2">
        <Panel
          title="Recent Shop Registrations"
          subtitle="Latest onboarding activity and approval decisions"
          action={(
            <Link to="/superadmin/goldshop" className="inline-flex items-center gap-1 text-xs font-semibold text-[#805B05] hover:underline">
              Manage shops <ExternalLink size={13} />
            </Link>
          )}
        >
        <div className="overflow-x-auto rounded-t-xl">
          <table className="w-full min-w-[1050px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-y border-[#043D37] bg-[#07564B] text-[11px] uppercase tracking-wide text-white/90">
                <th className="px-4 py-4 font-semibold">Shop ID</th>
                <th className="px-4 py-4 font-semibold">Shop name</th>
                <th className="px-4 py-4 font-semibold">Owner</th>
                <th className="px-4 py-4 font-semibold">Email / Mobile</th>
                <th className="px-4 py-4 font-semibold">Plan</th>
                <th className="px-4 py-4 font-semibold">Registered</th>
                <th className="px-4 py-4 font-semibold">Approval</th>
                <th className="px-4 py-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !analytics
                ? <TableLoadingRows columns={8} />
                : recentShops.length
                  ? recentShops.map((shop) => {
                    const approvalStatus = String(shop.approval_status || "pending").toLowerCase();
                    const isActing = actingOnShop === shop.id;
                    return (
                      <tr key={shop.id} className="border-b border-slate-100 text-slate-700 hover:bg-[#FCFAF4]">
                        <td className="whitespace-nowrap px-3 py-3.5 font-semibold">{shop.shop_code || shop.id}</td>
                        <td className="max-w-[190px] truncate px-3 py-3.5 font-semibold text-slate-900">{shop.shop_name}</td>
                        <td className="whitespace-nowrap px-3 py-3.5">{shop.owner_name || "—"}</td>
                        <td className="px-3 py-3.5">
                          <span className="block max-w-[190px] truncate">{shop.email || "—"}</span>
                          <span className="mt-1 block text-slate-400">{shop.mobile || "—"}</span>
                        </td>
                        <td className="px-3 py-3.5">{shop.plan_name || "No plan"}</td>
                        <td className="whitespace-nowrap px-3 py-3.5">{formatDate(shop.created_at)}</td>
                        <td className="px-3 py-3.5"><StatusBadge status={approvalStatus} /></td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/superadmin/goldshop/${shop.id}`}
                              aria-label={`View ${shop.shop_name}`}
                              title="View details"
                              className="inline-flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-600 hover:border-[#D4A017] hover:text-[#805B05]"
                            >
                              <ExternalLink size={14} />
                            </Link>
                            {approvalStatus === "pending" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleShopDecision(shop, "approve")}
                                  disabled={isActing}
                                  aria-label={`Approve ${shop.shop_name}`}
                                  title="Approve"
                                  className="inline-flex h-8 w-8 items-center justify-center border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                >
                                  {isActing ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={15} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleShopDecision(shop, "reject")}
                                  disabled={isActing}
                                  aria-label={`Reject ${shop.shop_name}`}
                                  title="Reject"
                                  className="inline-flex h-8 w-8 items-center justify-center border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                >
                                  <X size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                  : (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                        No recent shop registrations are available.
                      </td>
                    </tr>
                  )}
            </tbody>
          </table>
        </div>
      </Panel>

        <Panel
          title="Recent Payments"
          subtitle="Latest subscription transactions across gold shops"
          action={(
            <Link to="/superadmin/payments" className="inline-flex items-center gap-1 text-xs font-semibold text-[#805B05] hover:underline">
              Payment management <ExternalLink size={13} />
            </Link>
          )}
        >
        <div className="overflow-x-auto rounded-t-xl">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-y border-[#043D37] bg-[#07564B] text-[11px] uppercase tracking-wide text-white/90">
                <th className="px-4 py-4 font-semibold">Payment ID</th>
                <th className="px-4 py-4 font-semibold">Gold shop</th>
                <th className="px-4 py-4 font-semibold">Plan</th>
                <th className="px-4 py-4 font-semibold">Amount</th>
                <th className="px-4 py-4 font-semibold">Payment date</th>
                <th className="px-4 py-4 font-semibold">Method</th>
                <th className="px-4 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && !analytics
                ? <TableLoadingRows columns={7} />
                : analytics?.recentPayments?.length
                  ? analytics.recentPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-slate-100 text-slate-700 hover:bg-[#FCFAF4]">
                      <td className="whitespace-nowrap px-3 py-3.5 font-semibold">{payment.paymentId}</td>
                      <td className="px-3 py-3.5 font-medium text-slate-900">{payment.shop_name}</td>
                      <td className="px-3 py-3.5">{payment.plan_name}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 font-semibold">{formatCurrency(payment.amount)}</td>
                      <td className="whitespace-nowrap px-3 py-3.5">{formatDate(payment.payment_date)}</td>
                      <td className="px-3 py-3.5">{payment.payment_method || "—"}</td>
                      <td className="px-3 py-3.5"><StatusBadge status={payment.payment_status} /></td>
                    </tr>
                  ))
                  : (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                        No payment records are available.
                      </td>
                    </tr>
                  )}
            </tbody>
          </table>
        </div>
        </Panel>
      </section>
    </div>
  );
}

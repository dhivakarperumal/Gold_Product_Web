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
import { formatCompactCurrency, formatCurrency } from "../utils/currency";

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

const NUMBER_FORMAT = new Intl.NumberFormat("en-IN");
const COMPACT_NUMBER_FORMAT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});
const EMPTY_RECENT_SHOPS = [];

const formatCount = (count) => NUMBER_FORMAT.format(Number(count) || 0);
const formatCompactCount = (count) => COMPACT_NUMBER_FORMAT.format(Number(count) || 0);

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
    card: "border-emerald-100 border-t-4 border-t-emerald-500 bg-gradient-to-br from-white via-white to-emerald-50",
    icon: "bg-emerald-700 text-white shadow-emerald-900/15",
    label: "text-slate-500",
    detail: "text-emerald-700",
    bars: "bg-emerald-500",
    glow: "bg-emerald-300/35"
  },
  gold: {
    card: "border-amber-100 border-t-4 border-t-amber-500 bg-gradient-to-br from-white via-white to-amber-50",
    icon: "bg-amber-500 text-white shadow-amber-900/15",
    label: "text-slate-500",
    detail: "text-amber-700",
    bars: "bg-amber-500",
    glow: "bg-amber-300/35"
  },
  blue: {
    card: "border-sky-100 border-t-4 border-t-sky-500 bg-gradient-to-br from-white via-white to-sky-50",
    icon: "bg-sky-700 text-white shadow-sky-900/15",
    label: "text-slate-500",
    detail: "text-sky-700",
    bars: "bg-sky-500",
    glow: "bg-sky-300/35"
  },
  rust: {
    card: "border-rose-100 border-t-4 border-t-rose-500 bg-gradient-to-br from-white via-white to-rose-50",
    icon: "bg-rose-600 text-white shadow-rose-900/15",
    label: "text-slate-500",
    detail: "text-rose-700",
    bars: "bg-rose-500",
    glow: "bg-rose-300/35"
  },
  slate: {
    card: "border-cyan-100 border-t-4 border-t-cyan-500 bg-gradient-to-br from-white via-white to-cyan-50",
    icon: "bg-cyan-700 text-white shadow-cyan-900/15",
    label: "text-slate-500",
    detail: "text-cyan-700",
    bars: "bg-cyan-500",
    glow: "bg-cyan-300/35"
  },
  indigo: {
    card: "border-violet-100 border-t-4 border-t-violet-500 bg-gradient-to-br from-white via-white to-violet-50",
    icon: "bg-violet-600 text-white shadow-violet-900/15",
    label: "text-slate-500",
    detail: "text-violet-700",
    bars: "bg-violet-500",
    glow: "bg-violet-300/35"
  },
  teal: {
    card: "border-teal-100 border-t-4 border-t-teal-500 bg-gradient-to-br from-white via-white to-teal-50",
    icon: "bg-teal-700 text-white shadow-teal-900/15",
    label: "text-slate-500",
    detail: "text-teal-700",
    bars: "bg-teal-500",
    glow: "bg-teal-300/35"
  },
  burgundy: {
    card: "border-orange-100 border-t-4 border-t-orange-500 bg-gradient-to-br from-white via-white to-orange-50",
    icon: "bg-orange-600 text-white shadow-orange-900/15",
    label: "text-slate-500",
    detail: "text-orange-700",
    bars: "bg-orange-500",
    glow: "bg-orange-300/35"
  }
};

function MetricCard({ label, value, fullValue, icon: Icon, change, note, loading, tone = "forest" }) {
  const isPositive = Number(change) >= 0;
  const colors = metricTones[tone] || metricTones.forest;

  return (
    <article className={`group relative isolate flex min-h-36 min-w-0 items-center justify-between gap-4 overflow-hidden rounded-2xl border p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl ${colors.card}`}>
      <span aria-hidden="true" className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl transition duration-300 group-hover:scale-125 ${colors.glow}`} />
      <div className="relative min-w-0 flex-1">
        <p className={`min-h-8 text-[10px] font-extrabold uppercase leading-4 tracking-[0.08em] ${colors.label}`}>{label}</p>
        {loading
          ? <div className="mt-2 h-8 w-28 animate-pulse rounded-lg bg-slate-200/80" />
          : <p title={fullValue} className="mt-2 truncate text-3xl font-black leading-none tracking-tight text-slate-900">{value}</p>}
        <div className={`mt-3 flex min-h-5 flex-wrap items-center gap-1.5 text-xs ${colors.detail}`}>
        {loading
          ? <div className="h-3 w-24 animate-pulse rounded bg-slate-200/80" />
          : change !== undefined
            ? (
              <>
                <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-1 font-bold ${isPositive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  {formatPercentage(change)}
                </span>
                <span className="text-[11px] text-slate-500">vs. last month</span>
              </>
            )
            : (
              <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-slate-100 bg-white/80 px-2 py-1 text-slate-600">
                <span className={`h-1.5 w-1.5 rounded-full ${colors.bars}`} />
                <span className="font-semibold">{note}</span>
              </span>
            )}
        </div>
      </div>
      <span className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg ${colors.icon}`}>
        <Icon size={22} strokeWidth={2} />
      </span>
    </article>
  );
}

function Panel({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] transition-shadow duration-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:p-5 ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-gradient-to-b from-[#D4A017] to-[#07564B]" />
          <div>
            <h2 className="text-base font-semibold tracking-tight text-[#1F2937]">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
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
  const dotClasses = {
    approved: "bg-emerald-500",
    pending: "bg-amber-500",
    rejected: "bg-rose-500",
    paid: "bg-emerald-500",
    refunded: "bg-slate-500",
    failed: "bg-rose-500",
    unpaid: "bg-amber-500"
  };

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${classes[value] || "border-slate-200 bg-slate-50 text-slate-700"}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dotClasses[value] || "bg-slate-400"}`} />
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
        className="relative flex min-h-[176px] items-center overflow-hidden rounded-2xl border border-[#A87908]/70 bg-[#003B32] shadow-[0_12px_30px_rgba(4,61,55,0.16)] ring-1 ring-inset ring-white/15 sm:min-h-[188px] lg:min-h-[196px]"
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
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/40 bg-[#003B32]/75 px-2.5 text-xs font-semibold text-white shadow-sm backdrop-blur transition hover:border-white/70 hover:bg-[#003B32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE39A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#003B32] disabled:cursor-wait disabled:opacity-60 sm:px-3"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
        <div className="relative z-10 flex min-h-[170px] w-full items-center px-5 sm:min-h-[184px] sm:px-9">
          <div className="max-w-[82%] sm:max-w-[64%]">
            <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFE39A] sm:text-xs">
              <span aria-hidden="true" className="h-px w-5 bg-[#FFE39A]/80" />
              Welcome to
            </p>
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

      <section aria-label="Platform statistics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <MetricCard
            key={card.label}
            {...card}
            value={card.value === undefined
              ? "—"
              : card.currency
                ? formatCompactCurrency(card.value ?? 0)
                : formatCompactCount(card.value)}
            fullValue={card.value === undefined
              ? "—"
              : card.currency
                ? formatCurrency(card.value)
                : formatCount(card.value)}
            loading={loading && !stats}
          />
        ))}
      </section>

      <section aria-labelledby="quick-access-title" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5">
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
              className="group relative flex min-h-[140px] flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50/90 to-white px-3 py-4 text-center transition duration-200 hover:-translate-y-1 hover:border-[#D4A017]/60 hover:from-white hover:to-[#FFFCF4] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]"
            >
              <span aria-hidden="true" className="absolute right-3 top-3 text-slate-300 transition-colors group-hover:text-[#A87908]">
                <ArrowUpRight size={15} />
              </span>
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
            : <div className="h-64 rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white p-2"><Bar data={revenueChartData} options={{
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
            : <div className="h-64 rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white p-2"><Line data={registrationChartData} options={chartOptions} /></div>}
        </Panel>

        <Panel title="Subscription Growth" subtitle="Subscriptions created · last 12 months">
          {loading && !analytics
            ? <ChartSkeleton />
            : <div className="h-64 rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white p-2"><Line data={subscriptionChartData} options={chartOptions} /></div>}
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

      <section aria-label="Recent platform activity" className="grid grid-cols-1 items-start gap-5">
        <Panel
          title="Recent Shop Registrations"
          subtitle="Latest onboarding activity and approval decisions"
          action={(
            <Link to="/superadmin/goldshop" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#805B05] transition hover:bg-[#FBF8F0] hover:text-[#5F4300] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]">
              Manage shops <ExternalLink size={13} />
            </Link>
          )}
        >
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-900/[0.04]">
            <table aria-label="Recent shop registrations" className="w-full min-w-[1050px] border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-[#064E3B] via-[#08796B] to-[#0D776D] text-[10px] font-extrabold uppercase tracking-[0.12em] text-white">
                  <th className="rounded-tl-xl border-b border-white/10 px-4 py-4">Shop ID</th>
                  <th className="border-b border-white/10 px-4 py-4">Shop name</th>
                  <th className="border-b border-white/10 px-4 py-4">Owner</th>
                  <th className="border-b border-white/10 px-4 py-4">Email / Mobile</th>
                  <th className="border-b border-white/10 px-4 py-4">Plan</th>
                  <th className="border-b border-white/10 px-4 py-4">Registered</th>
                  <th className="border-b border-white/10 px-4 py-4">Approval</th>
                  <th className="rounded-tr-xl border-b border-white/10 px-4 py-4">Actions</th>
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
                      <tr key={shop.id} className="group border-b border-slate-100 text-slate-700 transition-colors odd:bg-white even:bg-slate-50/45 hover:bg-emerald-50/55">
                        <td className="whitespace-nowrap px-4 py-4">
                          <span className="inline-flex rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-wide text-emerald-800">
                            {shop.shop_code || shop.id}
                          </span>
                        </td>
                        <td className="max-w-[210px] px-4 py-4">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-700 shadow-sm transition group-hover:scale-105">
                              <Store size={15} strokeWidth={2} />
                            </span>
                            <span className="truncate font-semibold text-slate-900">{shop.shop_name}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-700">{shop.owner_name || "—"}</td>
                        <td className="px-4 py-4">
                          <span className="block max-w-[190px] truncate font-semibold text-slate-800">{shop.email || "—"}</span>
                          <span className="mt-1 block text-[10px] font-medium text-slate-500">{shop.mobile || "—"}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm">
                            {shop.plan_name || "No plan"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays size={13} className="text-slate-400" />
                            {formatDate(shop.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-4"><StatusBadge status={approvalStatus} /></td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/superadmin/goldshop/${shop.id}`}
                              aria-label={`View ${shop.shop_name}`}
                              title="View details"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50"
                                >
                                  {isActing ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={15} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleShopDecision(shop, "reject")}
                                  disabled={isActing}
                                  aria-label={`Reject ${shop.shop_name}`}
                                  title="Reject"
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-50"
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
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                        <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                          <Store size={20} />
                        </span>
                        <span className="font-semibold text-slate-700">No recent shop registrations</span>
                        <span className="mt-1 block text-xs text-slate-400">New registrations will appear here.</span>
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
            <Link to="/superadmin/payments" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#805B05] transition hover:bg-[#FBF8F0] hover:text-[#5F4300] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]">
              Payment management <ExternalLink size={13} />
            </Link>
          )}
        >
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-900/[0.05]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-emerald-50/50 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-white text-emerald-800 shadow-sm">
                <CreditCard size={16} />
              </span>
              <div>
                <p className="text-xs font-bold text-slate-800">Subscription transaction activity</p>
                <p className="mt-0.5 text-[10px] text-slate-500">Latest payments across all gold shops</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-[10px] font-bold text-emerald-800 shadow-sm">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {formatCount(analytics?.recentPayments?.length || 0)} recent
            </span>
          </div>
          <div className="overflow-x-auto">
            <table aria-label="Recent payments" className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-[#064E3B] via-[#08796B] to-[#0D776D] text-[10px] font-extrabold uppercase tracking-[0.12em] text-white">
                  <th className="rounded-tl-xl border-b border-white/10 px-4 py-4">Payment ID</th>
                  <th className="border-b border-white/10 px-4 py-4">Gold shop</th>
                  <th className="border-b border-white/10 px-4 py-4">Plan</th>
                  <th className="border-b border-white/10 px-4 py-4">Amount</th>
                  <th className="border-b border-white/10 px-4 py-4">Payment date</th>
                  <th className="border-b border-white/10 px-4 py-4">Method</th>
                  <th className="rounded-tr-xl border-b border-white/10 px-4 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && !analytics
                ? <TableLoadingRows columns={7} />
                : analytics?.recentPayments?.length
                  ? analytics.recentPayments.map((payment) => (
                    <tr key={payment.id} className="group border-b border-slate-100 text-slate-700 transition-colors odd:bg-white even:bg-slate-50/45 hover:bg-emerald-50/55">
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[10px] font-bold text-slate-700">
                          {payment.paymentId}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="inline-flex items-center gap-2 font-extrabold text-slate-900">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-700">
                            <Store size={14} />
                          </span>
                          {payment.shop_name}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm">
                          {payment.plan_name}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="inline-flex rounded-lg border border-amber-200/80 bg-gradient-to-r from-amber-50 via-amber-50 to-orange-50 px-3 py-1.5 font-extrabold tracking-tight text-amber-800 shadow-sm shadow-amber-900/[0.04]">
                          {formatCurrency(payment.amount)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays size={13} className="text-slate-400" />
                          {formatDate(payment.payment_date)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 font-semibold text-slate-600">
                          <CreditCard size={13} className="text-slate-400" />
                          {payment.payment_method || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4"><StatusBadge status={payment.payment_status} /></td>
                    </tr>
                  ))
                  : (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                        <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                          <CreditCard size={20} />
                        </span>
                        <span className="font-semibold text-slate-700">No recent payment records</span>
                        <span className="mt-1 block text-xs text-slate-400">New transactions will appear here.</span>
                      </td>
                    </tr>
                  )}
            </tbody>
            </table>
          </div>
        </div>
        </Panel>
      </section>
    </div>
  );
}

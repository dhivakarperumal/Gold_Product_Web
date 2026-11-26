import React, { useEffect, useState, useCallback } from "react";
import { useAdmin } from "../PrivateRouter/AdminContext";
import { formatRateDate } from "../PrivateRouter/goldRateUtils";
import useGoldRates from "../PrivateRouter/useGoldRates";
import api from "../api";
import DateRangeFilter from "./Components/DateRangeFilter";
import { formatCurrency } from "../utils/currency";
import { toast, Toaster } from "react-hot-toast";
import SubscriptionCheckoutModal from "../Components/Subscription/SubscriptionCheckoutModal";
import { useNavigate } from "react-router-dom";
import {
  FiUsers,
  FiBox,
  FiArrowRight,
  FiMoreHorizontal,
  FiChevronRight,
  FiLayers,
  FiAlertTriangle,
  FiFileText,
  FiActivity,
  FiCalendar,
  FiRefreshCw
} from "react-icons/fi";
import { FaRupeeSign, FaCoins, FaGem, FaHandHoldingUsd, FaShieldAlt } from "react-icons/fa";
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

const backendUrl = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");

const getDashboardImageUrl = (image) => {
  if (!image) return "/images/categories/necklacecat.png";
  if (/^(https?:|data:|blob:|\/images\/)/i.test(image)) return image;
  return `${backendUrl}${image.startsWith("/") ? image : `/${image}`}`;
};

const formatAccountDate = (value) => {
  if (!value) return "—";
  const date = new Date(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const DEFAULT_DASHBOARD_DATA = {
  stats: [
    {
      id: "total_customers",
      label: "Total Customers",
      value: "—",
      trend: "Users table count",
      trendUp: true,
      icon: "users",
      color: "emerald"
    },
    {
      id: "active_gold_loans",
      label: "Active Gold Loans",
      value: "—",
      trend: "Live API count",
      trendUp: true,
      icon: "loan",
      color: "amber"
    },
    {
      id: "today_collection",
      label: "Today's Collection",
      value: "—",
      trend: "No loan payment data",
      trendUp: true,
      icon: "rupee",
      color: "emerald"
    },
    {
      id: "gold_stock_value",
      label: "Gold Stock Value",
      value: "—",
      trend: "Live API estimate",
      trendUp: true,
      icon: "gold",
      color: "amber"
    },
    {
      id: "total_products",
      label: "Total Products",
      value: "0",
      trend: "Inventory",
      trendUp: true,
      icon: "products",
      color: "blue"
    },
    {
      id: "total_categories",
      label: "Total Categories",
      value: "0",
      trend: "Categories",
      trendUp: true,
      icon: "categories",
      color: "purple"
    },
    {
      id: "completed_loans",
      label: "Completed Loans",
      value: "0",
      trend: "Closed loans",
      trendUp: true,
      icon: "completed",
      color: "teal"
    },
    {
      id: "low_stock_products",
      label: "Low Stock Products",
      value: "0",
      trend: "Below 10 units",
      trendUp: false,
      icon: "low-stock",
      color: "rose"
    }
  ],
  totalLoansCount: 0,
  loanStatusCounts: {
    Active: 0,
    Processing: 0,
    Pending: 0,
    Overdue: 0,
    Completed: 0,
  },
  revenueTrends: [],
  topProducts: []
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { dashboardData, setDashboardCached } = useAdmin();
  const { current: currentGoldRates, loading: goldRatesLoading } = useGoldRates();
  const [dateRange, setDateRange] = useState({ preset: "all", startDate: "", endDate: "" });
  const [metricsError, setMetricsError] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [assistanceSubmitting, setAssistanceSubmitting] = useState(false);
  const [assistanceRequested, setAssistanceRequested] = useState(false);
  const [dismissedTrialEndDate, setDismissedTrialEndDate] = useState("");
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const metricsLoading = !dashboardData?.stats && !metricsError;
  const [dashboardDateLabel] = useState(() => new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date()));

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await api.get('/dashboard', {
        params: {
          datePreset: dateRange.preset,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        }
      });
      if (!response.data?.stats) throw new Error("Dashboard API returned no metrics");
      setDashboardCached(response.data);
      setMetricsError(false);
    } catch (error) {
      setMetricsError(true);
      console.error("Failed to refresh dashboard metrics:", error);
    }
  }, [dateRange, setDashboardCached]);

  const refreshDashboardNow = async () => {
    setManualRefreshing(true);
    try {
      await fetchDashboardData();
    } finally {
      setManualRefreshing(false);
    }
  };

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => fetchDashboardData(), 0);
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") fetchDashboardData();
    }, 30000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") fetchDashboardData();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [fetchDashboardData]);

  // Safe resolved data (merged with defaults so it ALWAYS renders properly)
  const data = dashboardData || DEFAULT_DASHBOARD_DATA;
  const stats = dashboardData?.stats || [];
  const recentLoans = Array.isArray(data.recentLoans) ? data.recentLoans : [];
  const topProducts = Array.isArray(data.topProducts) ? data.topProducts : [];
  const loanStatusCounts = data.loanStatusCounts || DEFAULT_DASHBOARD_DATA.loanStatusCounts;
  const revenueTrends = Array.isArray(dashboardData?.revenueTrends) ? dashboardData.revenueTrends : [];
  const totalLoansCount = data.totalLoansCount ?? 0;
  const accountPlan = data.accountPlan;
  const showTrialWarning = Boolean(accountPlan?.trial_active)
    && String(accountPlan.payment_status || "").toLowerCase() !== "paid"
    && Number(accountPlan.trial_days_remaining) < 3
    && dismissedTrialEndDate !== accountPlan.trial_end_date
    && !checkoutOpen;

  const askSuperAdminForSubscription = async () => {
    if (assistanceSubmitting || assistanceRequested) return;
    setAssistanceSubmitting(true);
    try {
      const { data: response } = await api.post("/subscriptions/requests", {});
      setAssistanceRequested(true);
      toast.success(response.message || "Your request was sent to the Super Admin.");
    } catch (error) {
      console.error("Could not request subscription assistance:", error);
      toast.error(error.response?.data?.message || "Could not send your request.");
    } finally {
      setAssistanceSubmitting(false);
    }
  };
  const summaryCards = [
    {
      id: "total_customers",
      icon: <FiUsers />,
      accentColor: "#047857",
      glowColor: "#6EE7B7",
      gradient: "linear-gradient(135deg, #059669 0%, #047857 48%, #064E3B 100%)",
      trendUp: true
    },
    {
      id: "active_gold_loans",
      icon: <FaCoins />,
      accentColor: "#A16207",
      glowColor: "#FDE68A",
      gradient: "linear-gradient(135deg, #D97706 0%, #A16207 52%, #713F12 100%)"
    },
    {
      id: "today_collection",
      icon: <FaRupeeSign />,
      accentColor: "#0369A1",
      glowColor: "#7DD3FC",
      gradient: "linear-gradient(135deg, #0284C7 0%, #0369A1 52%, #1E3A8A 100%)"
    },
    {
      id: "gold_stock_value",
      icon: <FaGem />,
      accentColor: "#B45309",
      glowColor: "#FDBA74",
      gradient: "linear-gradient(135deg, #EA580C 0%, #C2410C 52%, #7C2D12 100%)"
    },
    {
      id: "total_products",
      icon: <FiBox />,
      accentColor: "#0E7490",
      glowColor: "#67E8F9",
      gradient: "linear-gradient(135deg, #0F766E 0%, #0E7490 52%, #164E63 100%)"
    },
    {
      id: "total_categories",
      icon: <FiLayers />,
      accentColor: "#6D28D9",
      glowColor: "#C4B5FD",
      gradient: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 52%, #4C1D95 100%)"
    },
    {
      id: "completed_loans",
      icon: <FaCoins />,
      accentColor: "#0F766E",
      glowColor: "#5EEAD4",
      gradient: "linear-gradient(135deg, #0D9488 0%, #0F766E 52%, #134E4A 100%)"
    },
    {
      id: "low_stock_products",
      icon: <FiAlertTriangle />,
      accentColor: "#BE123C",
      glowColor: "#FDA4AF",
      gradient: "linear-gradient(135deg, #E11D48 0%, #BE123C 52%, #881337 100%)"
    }
  ].map((card) => {
    const defaultStat = DEFAULT_DASHBOARD_DATA.stats.find((stat) => stat.id === card.id);
    const liveStat = stats.find((stat) => stat.id === card.id);
    return {
      ...defaultStat,
      ...liveStat,
      ...card,
      value: liveStat?.value ?? (metricsLoading ? "Loading…" : metricsError ? "Unavailable" : "—"),
    };
  });

  // Status styling
  const getStatusBadge = (status) => {
    switch (status) {
      case "Active":
      case "Delivered":
        return "bg-emerald-50 text-emerald-600 font-semibold";
      case "Completed":
        return "bg-teal-50 text-teal-700 font-semibold";
      case "Processing":
        return "bg-amber-50 text-amber-600 font-semibold";
      case "Pending":
        return "bg-sky-50 text-sky-600 font-semibold";
      case "Overdue":
      case "Cancelled":
        return "bg-rose-50 text-rose-600 font-semibold";
      default:
        return "bg-slate-50 text-slate-600 font-semibold";
    }
  };

  // ── Bar Chart Data & Options ──────────────────────────────────────
  const barLabels = revenueTrends.map(t => t.label || t.month || "");
  const barValues = revenueTrends.map(t => Number(t.revenue) || 0);

  const barChartData = {
    labels: barLabels,
    datasets: [
      {
        label: 'Sales',
        data: barValues,
        backgroundColor: '#2DD4BF', // soft emerald / teal like the screenshot
        hoverBackgroundColor: '#0D9488',
        borderRadius: 6,
        borderSkipped: false,
        categoryPercentage: 0.65,
        barPercentage: 0.75,
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0F172A',
        titleColor: '#F8FAFC',
        bodyColor: '#34D399',
        padding: { top: 8, bottom: 8, left: 12, right: 12 },
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: (items) => {
            const idx = items[0]?.dataIndex;
            return revenueTrends[idx]?.date || items[0]?.label || "";
          },
          label: (context) => `● ${formatCurrency(context.parsed.y)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => {
            if (value === 0) return '0';
            if (value >= 100000) return `${(value / 1000).toFixed(0)}K`;
            return `${(value / 1000).toFixed(0)}K`;
          },
          color: '#94A3B8',
          font: { size: 11, weight: '500' }
        },
        grid: { color: '#F1F5F9', drawBorder: false },
        border: { dash: [4, 4], display: false }
      },
      x: {
        ticks: { color: '#94A3B8', font: { size: 11, weight: '500' } },
        grid: { display: false, drawBorder: false }
      }
    }
  };

  // ── Doughnut Chart: Loan Status ──────────────────────────────────
  const loanStatusLabels = ['Active', 'Processing', 'Pending', 'Overdue', 'Completed'];
  const loanStatusColors = ['#10B981', '#F59E0B', '#38BDF8', '#EF4444', '#0F766E'];
  const loanStatusValues = [
    loanStatusCounts.Active ?? 0,
    loanStatusCounts.Processing ?? 0,
    loanStatusCounts.Pending ?? 0,
    loanStatusCounts.Overdue ?? 0,
    loanStatusCounts.Completed ?? 0,
  ];
  const totalLoanStatusSum = loanStatusValues.reduce((a, b) => a + b, 0) || 1;

  const doughnutData = {
    labels: loanStatusLabels,
    datasets: [
      {
        data: loanStatusValues,
        backgroundColor: loanStatusColors,
        borderWidth: 0,
        cutout: '72%',
        hoverOffset: 4
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0F172A',
        titleColor: '#F8FAFC',
        bodyColor: '#F8FAFC',
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.raw} (${((ctx.raw / totalLoanStatusSum) * 100).toFixed(0)}%)`
        }
      }
    }
  };

  const loanStatusLegend = loanStatusLabels.map((label, idx) => ({
    label,
    count: loanStatusValues[idx],
    pct: `${Math.round((loanStatusValues[idx] / totalLoanStatusSum) * 100)}%`,
    color: loanStatusColors[idx]
  }));

  return (
    <div className="min-h-screen space-y-6 bg-gradient-to-br from-slate-50 via-[#F8FAFC] to-emerald-50/40 pb-12">
      <Toaster position="top-right" />

      <section aria-label="Dashboard overview" className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/85 p-3.5 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#07564B] to-[#0B8A78] text-white shadow-md shadow-emerald-900/15">
            <FiActivity size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#08796B]">Store pulse</p>
            <p className="truncate text-xs font-medium text-slate-500">A live snapshot of your business at a glance</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span
            role="status"
            aria-live="polite"
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[10px] font-bold ${metricsError ? "border-rose-100 bg-rose-50 text-rose-700" : "border-emerald-100 bg-emerald-50 text-emerald-800"}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${metricsError ? "bg-rose-500" : "animate-pulse bg-emerald-500"}`} />
            {metricsError ? "Connection issue" : "Auto-refresh · 30s"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-100 bg-white px-3 py-2 text-[10px] font-semibold text-slate-600">
            <FiCalendar className="text-slate-400" />
            {dashboardDateLabel}
          </span>
          <button
            type="button"
            onClick={refreshDashboardNow}
            disabled={manualRefreshing}
            aria-label="Refresh dashboard data"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#07564B] px-3.5 py-2 text-[10px] font-extrabold text-white shadow-sm transition hover:bg-[#08796B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
          >
            <FiRefreshCw className={manualRefreshing ? "animate-spin" : ""} />
            {manualRefreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </section>

      <section className="group relative flex min-h-[178px] items-center overflow-hidden rounded-2xl border border-amber-200/70 bg-[#003B32] shadow-lg shadow-emerald-950/10 sm:min-h-[196px]">
        <img
          src="/images/Hero/hero4.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#002D27]/95 via-[#003B32]/80 to-[#003B32]/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#001F1B]/35 via-transparent to-white/[0.04]" />
        <div className="relative z-10 flex h-full w-full items-center px-5 sm:px-9">
          <div className="max-w-[58%] sm:max-w-[52%]">
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200/30 bg-black/20 px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-[0.18em] text-amber-100 backdrop-blur-sm sm:text-[9px]">
              <FaGem className="text-[#F5C45E]" />
              Admin dashboard
            </span>
            <p className="text-xs font-semibold tracking-wide text-[#F6D991] sm:text-base" style={{ color: "#FFE39A", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>Welcome to</p>
            <h1
              className="mt-0.5 font-serif text-3xl font-bold leading-none sm:text-5xl"
              style={{ color: "#FFD15C", textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}
            >
              Sri Golds
            </h1>
            <p className="mt-2 max-w-md text-[10px] leading-relaxed text-white/90 sm:text-sm" style={{ color: "#FFFFFF", textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}>
              Your trusted jewellery &amp; gold loan management partner
            </p>
            <div className="mt-3 hidden items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#F6D991] sm:flex" style={{ color: "#FFE39A", textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}>
              <span>Purity</span><span className="text-white/50">|</span>
              <span>Trust</span><span className="text-white/50">|</span>
              <span>Prosperity</span>
            </div>
          </div>
          <div className="ml-auto hidden max-w-[180px] space-y-3 pr-3 text-[#F6D991] lg:block" style={{ color: "#FFE39A", textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}>
            <div className="flex items-center gap-2">
              <FaGem className="shrink-0 text-lg" />
              <span className="text-[9px] font-bold uppercase leading-tight tracking-wide">Traditional Values</span>
            </div>
            <div className="flex items-center gap-2">
              <FaShieldAlt className="shrink-0 text-lg" />
              <span className="text-[9px] font-bold uppercase leading-tight tracking-wide">Modern Management</span>
            </div>
            <div className="flex items-center gap-2">
              <FiUsers className="shrink-0 text-lg" />
              <span className="text-[9px] font-bold uppercase leading-tight tracking-wide">Customer Satisfaction</span>
            </div>
          </div>
        </div>
      </section>

      {accountPlan && (
        <section aria-label="Account plan" className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-white via-white to-amber-50/70 p-4 shadow-sm shadow-amber-900/[0.04] sm:p-5">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-amber-200/30 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-200/70 bg-white text-amber-700 shadow-sm">
                <FaShieldAlt />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Account plan</p>
                <h2 className="mt-1 truncate text-lg font-black text-slate-900">
                  <span className="capitalize">{accountPlan.account_plan_type || "—"}</span>
                  {accountPlan.plan_name ? ` · ${accountPlan.plan_name}` : ""}
                </h2>
              </div>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2 sm:gap-3">
              <div className="rounded-xl border border-slate-100 bg-white/85 px-3.5 py-2.5 shadow-sm">
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Starts</dt>
                <dd className="mt-1 font-bold text-slate-800">{formatAccountDate(accountPlan.account_start_date)}</dd>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white/85 px-3.5 py-2.5 shadow-sm">
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Ends</dt>
                <dd className="mt-1 font-bold text-slate-800">{formatAccountDate(accountPlan.account_end_date)}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      {showTrialWarning && (
        <div className="fixed inset-0 z-[145] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <section role="alertdialog" aria-modal="true" aria-labelledby="trial-expiry-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800"><FiAlertTriangle /></span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Trial ending soon</p>
                <h2 id="trial-expiry-title" className="mt-1 text-xl font-black text-slate-900">
                  {accountPlan.trial_days_remaining} {Number(accountPlan.trial_days_remaining) === 1 ? "day" : "days"} remaining
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Your {accountPlan.plan_name} trial ends {formatAccountDate(accountPlan.trial_end_date)}. Subscribe before then to keep using your shop account.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={assistanceSubmitting || assistanceRequested} onClick={askSuperAdminForSubscription} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">
                {assistanceSubmitting ? "Sending…" : assistanceRequested ? "Request sent" : "Ask Super Admin"}
              </button>
              <button type="button" onClick={() => setCheckoutOpen(true)} className="rounded-xl bg-[#00796B] px-4 py-3 text-sm font-bold text-white">
                Subscribe now
              </button>
            </div>
            <button type="button" onClick={() => setDismissedTrialEndDate(accountPlan.trial_end_date)} className="mt-3 w-full rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50">
              Remind me later
            </button>
          </section>
        </div>
      )}

      {checkoutOpen && (
        <SubscriptionCheckoutModal
          onClose={() => setCheckoutOpen(false)}
          onPaymentComplete={async () => {
            setCheckoutOpen(false);
            setDismissedTrialEndDate(accountPlan?.trial_end_date || "");
            await fetchDashboardData();
          }}
        />
      )}

      <section aria-label="Business overview" className="relative isolate space-y-4 overflow-hidden rounded-[28px] border border-amber-200/60 bg-gradient-to-br from-white via-white to-emerald-50/60 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)] sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 -z-10 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-emerald-700 shadow-sm">
              <FiActivity size={19} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Live store overview</p>
              <h2 className="mt-0.5 text-base font-extrabold text-slate-900">Business at a glance</h2>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-2xl border border-amber-200/70 bg-white/85 px-3 py-2 shadow-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-300 to-amber-500 text-[11px] font-black text-amber-950">08</span>
            <span className="text-[10px] font-bold text-slate-600">Key metrics</span>
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <article
              key={card.id}
              style={{ background: card.gradient, borderColor: "rgba(255,255,255,0.2)" }}
              className="group relative flex min-h-[198px] min-w-0 flex-col overflow-hidden rounded-[24px] border p-4 text-white shadow-[0_12px_28px_rgba(15,23,42,0.14)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_42px_rgba(15,23,42,0.22)] sm:p-5"
            >
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
              <div
                aria-hidden="true"
                style={{ background: `radial-gradient(circle, ${card.glowColor} 0%, transparent 72%)` }}
                className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 opacity-40 blur-xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-60"
              />
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.14] via-transparent to-black/[0.18]" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 right-12 h-28 w-28 rounded-full border border-white/[0.08] transition-transform duration-500 group-hover:scale-110" />
              <div className="relative z-10 flex min-w-0 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/[0.16] text-lg text-white shadow-inner shadow-white/10 backdrop-blur-sm transition-transform duration-300 group-hover:scale-105"
                  >
                    {card.icon}
                  </span>
                  <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/85">{card.label}</p>
                </div>
                <button
                  type="button"
                  aria-label={`View ${card.label}`}
                  onClick={() => navigate({
                    total_customers: "/admin/loans/customermanagement",
                    gold_stock_value: "/admin/products/stock",
                    total_products: "/admin/products/all",
                    total_categories: "/admin/products/category",
                    completed_loans: "/admin/loans/allloans",
                    low_stock_products: "/admin/products/stock"
                  }[card.id] || "/admin/loans/allloans")}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/[0.14] text-white shadow-sm backdrop-blur-sm transition hover:scale-105 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <FiChevronRight />
                </button>
              </div>
              <div className="relative z-10 mt-4 min-w-0 rounded-2xl border border-white/[0.12] bg-black/[0.11] px-4 py-3 shadow-inner shadow-white/[0.04] backdrop-blur-sm">
                <p className="truncate text-[32px] font-black leading-none tracking-tight text-white tabular-nums drop-shadow-sm">{card.value}</p>
                <div
                  className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.13] px-2.5 py-1 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm"
                >
                  <span
                    style={{ backgroundColor: card.id === "today_collection" ? "#FDE68A" : metricsError ? "#FDA4AF" : "#86EFAC" }}
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${!metricsError && card.id !== "today_collection" ? "animate-pulse" : ""}`}
                  />
                  <span className="truncate">{card.trend}</span>
                </div>
              </div>
              <p className="relative z-10 mt-auto flex items-center gap-1.5 pt-3 text-[10px] font-medium text-white/75">
                <FiRefreshCw size={10} className={metricsLoading ? "animate-spin" : ""} />
                {card.id === "today_collection"
                  ? "Loan payment source unavailable"
                  : metricsError && dashboardData?.stats
                    ? "Refresh failed · showing last data"
                    : metricsLoading
                      ? "Loading live API data…"
                      : "Updates every 30 seconds"}
              </p>
            </article>
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white via-white to-emerald-50/40 p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-[#08796B]">
              <FiArrowRight size={15} />
            </span>
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">
                Quick Actions & Shortcuts
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-400">Jump straight into common tasks</p>
            </div>
          </div>
          <span className="rounded-full border border-slate-100 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 shadow-sm">One-click management</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {[
            { label: "Add Product", icon: <FiBox size={18} />, color: "from-[#004D40] to-[#008577]", path: "/admin/products/add" },
            { label: "New Bill", icon: <FiFileText size={18} />, color: "from-[#003B3B] to-[#008577]", path: "/admin/billings?new=1" },
            { label: "New Loan", icon: <FaHandHoldingUsd size={18} />, color: "from-[#0F766E] to-[#14B8A6]", path: "/admin/loans/createloan" },
            { label: "All Loans", icon: <FaCoins size={18} />, color: "from-[#047857] to-[#34D399]", path: "/admin/loans/allloans" },
            { label: "Customers", icon: <FiUsers size={18} />, color: "from-[#B7791F] to-[#F5C45E]", path: "/admin/loans/customermanagement" },
            { label: "Stock Details", icon: <FiBox size={18} />, color: "from-[#B45309] to-[#F59E0B]", path: "/admin/products/stock" },
            { label: "Daily Gold Rate", icon: <FaGem size={18} />, color: "from-[#003B3B] to-[#008577]", path: "/admin/settings/daily-gold-rate" }
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => navigate(action.path)}
              className="group flex min-h-[104px] flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-100 bg-white/80 p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:bg-white hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${action.color} text-white shadow-md ring-1 ring-white/70 transition-transform duration-200 group-hover:scale-110`}>
                {action.icon}
              </span>
              <span className="text-center text-[11px] font-extrabold leading-tight text-slate-700 transition-colors group-hover:text-[#08796B]">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Active daily precious rates banner ── */}
      <div className="relative isolate overflow-hidden rounded-2xl border border-[#0b5b52] bg-[#003B3B] p-5 text-white shadow-lg shadow-emerald-950/10 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-20 -z-10 h-56 w-56 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 -z-10 h-48 w-48 rounded-full bg-amber-200/10 blur-3xl" />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200/20 bg-white/10 text-lg text-[#F5C45E] shadow-inner backdrop-blur">
              <FaGem />
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100/70">Daily market snapshot</p>
              <h2 className="text-base font-extrabold tracking-wide text-white">
                Sri Golds Precious Rates
              </h2>
              <p className="mt-1 text-xs font-medium text-emerald-50/75">
                {goldRatesLoading ? "Refreshing rates..." : currentGoldRates ? `Effective ${formatRateDate(currentGoldRates.rate_date)}` : "Live benchmark market rates"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/admin/settings/daily-gold-rate")}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white px-4 py-2.5 text-xs font-bold text-[#003B3B] shadow-md transition hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-[#003B3B]"
          >
            Manage rates <span aria-hidden="true" className="text-sm">→</span>
          </button>
        </div>

        {currentGoldRates?.rates?.length ? (
          <div className="mt-5 space-y-3">
            {[...new Set(currentGoldRates.rates.map((rate) => rate.metal_type))]
              .sort((first, second) => {
                const metalOrder = ["Gold", "Silver", "Platinum", "Diamond"];
                const firstIndex = metalOrder.indexOf(first);
                const secondIndex = metalOrder.indexOf(second);
                return (firstIndex === -1 ? metalOrder.length : firstIndex)
                  - (secondIndex === -1 ? metalOrder.length : secondIndex);
              })
              .map((metal) => (
                <section key={metal} className="grid gap-2 border-t border-white/15 pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[100px_minmax(0,1fr)] sm:items-center">
                  <h3 className="text-sm font-bold text-emerald-100">{metal}</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                    {currentGoldRates.rates
                      .filter((rate) => rate.metal_type === metal)
                      .map((rate) => (
                        <div key={`${rate.metal_type}-${rate.purity}`} className="group rounded-xl border border-white/10 bg-white/[0.08] px-3.5 py-3 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-amber-200/40 hover:bg-white/[0.13]">
                          <span className="block truncate text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-50/70">
                            {rate.metal_type === "Gold" ? ({
                              "999": "24K (999)",
                              "916": "22K (916)",
                              "833": "20K (833)",
                              "750": "18K (750)",
                              "585": "14K (585)"
                            })[rate.purity] || rate.purity : rate.purity}
                          </span>
                          <p className="mt-1.5 text-base font-extrabold tabular-nums text-white">
                            {formatCurrency(rate.rate_per_unit ?? rate.rate_per_gram)}
                            <span className="ml-1 text-xs font-semibold text-emerald-100/70">/{rate.rate_unit === "carat" ? "ct" : "g"}</span>
                          </p>
                        </div>
                      ))}
                  </div>
                </section>
              ))}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-medium text-emerald-50/80">
            No active metal rates are configured yet.
          </p>
        )}
      </div>

      {/* ── Middle Section: Charts (Sales Overview & Loan Status) ──── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Sales Overview (65% width) */}
        <div className="flex flex-col rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white via-white to-slate-50/80 p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6 lg:col-span-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-[#08796B]">
                <FiFileText size={17} />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-slate-800 sm:text-lg">Sales Overview</h3>
                <p className="mt-0.5 text-[10px] font-medium text-slate-400">Live billing data · refreshes every 30 seconds</p>
              </div>
            </div>
            <DateRangeFilter onApply={setDateRange} className="max-w-full sm:max-w-[360px]" />
          </div>
          <div className="relative h-[260px] w-full rounded-xl border border-slate-100/80 bg-gradient-to-b from-slate-50/70 to-white p-2 pt-4 sm:h-[280px]">
            {metricsLoading
              ? <div className="flex h-full items-center justify-center text-sm font-medium text-slate-400">Loading sales data…</div>
              : metricsError && !dashboardData
                ? <div className="flex h-full items-center justify-center text-sm font-medium text-rose-500">Sales data is unavailable.</div>
                : revenueTrends.length > 0
                  ? <Bar data={barChartData} options={barChartOptions} />
                  : <div className="flex h-full items-center justify-center text-sm font-medium text-slate-400">No sales recorded for this period.</div>}
          </div>
        </div>

        {/* Right: Loan Status Donut Chart (35% width, Replacing Order Status) */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white via-white to-emerald-50/40 p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6 lg:col-span-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-700">
                <FaCoins size={17} />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-slate-800 sm:text-lg">Loan Status</h3>
                <p className="text-[10px] font-medium text-slate-400">Portfolio breakdown</p>
              </div>
            </div>
          </div>
          <div className="my-auto flex flex-col items-center justify-between gap-4 py-2 sm:flex-row lg:flex-row">
            {/* Donut with center text */}
            <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
              <Doughnut data={doughnutData} options={doughnutOptions} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-800 leading-none">
                  {totalLoansCount}
                </span>
                <span className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                  Loans
                </span>
              </div>
            </div>

            {/* Legend breakdown list matching the screenshot */}
            <div className="w-full flex-1 space-y-1.5 sm:w-auto">
              {loanStatusLegend.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-100/80 bg-white/80 px-2.5 py-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{item.count}</span>
                    <span className="text-slate-400 font-semibold w-8 text-right">{item.pct}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Section: Recent Loans & Top Selling Products ───── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Recent Loans (65% width, replacing Recent Orders properly) */}
        <div className="flex flex-col rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white via-white to-slate-50/80 p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6 lg:col-span-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-[#08796B]">
                <FaHandHoldingUsd size={17} />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-slate-800 sm:text-lg">Recent Loans</h3>
                <p className="text-[10px] font-medium text-slate-400">Latest customer loan activity</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/admin/loans/allloans')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-[11px] font-extrabold text-[#08796B] shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              View All <FiArrowRight className="text-xs" />
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-[#064E3B] via-[#08796B] to-[#0D776D] text-[10px] font-extrabold uppercase tracking-[0.12em] text-white">
                  <th className="rounded-tl-xl px-4 py-3.5">S No</th>
                  <th className="px-4 py-3.5">Loan ID</th>
                  <th className="px-4 py-3.5">Customer</th>
                  <th className="px-4 py-3.5">Products</th>
                  <th className="px-4 py-3.5">Amount</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="rounded-tr-xl px-4 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentLoans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center">
                      <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                        <FaHandHoldingUsd size={17} />
                      </span>
                      <span className="block text-xs font-bold text-slate-700">No recent loans yet</span>
                      <span className="mt-1 block text-[10px] text-slate-400">New loan activity will appear here.</span>
                    </td>
                  </tr>
                ) : recentLoans.map((loan, idx) => (
                  <tr key={idx} className="group bg-white text-slate-700 transition-colors odd:bg-white even:bg-slate-50/45 hover:bg-emerald-50/55">
                    <td className="whitespace-nowrap px-4 py-3.5 font-bold text-slate-500">{idx + 1}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] font-bold text-slate-700">{loan.id}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-extrabold text-slate-900">{loan.customer}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <img
                          src={getDashboardImageUrl(loan.img)}
                          alt={loan.jewellery}
                          className="h-9 w-9 shrink-0 rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-1 object-contain shadow-sm"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "/images/categories/necklacecat.png";
                          }}
                        />
                        <span className="max-w-[120px] truncate font-semibold text-slate-700 sm:max-w-none">
                          {loan.jewellery}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-extrabold text-slate-800">{formatCurrency(loan.amount)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-full border border-current/10 px-2.5 py-1 text-[10px] ${getStatusBadge(loan.status)}`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-500">{loan.date}</td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => navigate(loan.rawId ? `/admin/loans/details/${loan.rawId}` : '/admin/loans/allloans')}
                        aria-label={`View loan ${loan.id}`}
                        className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        title="View details"
                      >
                        <FiMoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Top Selling Products (35% width, Matching Screenshot) */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white via-white to-amber-50/40 p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6 lg:col-span-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-800 sm:text-lg">Latest Products</h3>
              <p className="text-[10px] font-medium text-slate-400">Recently added to your catalog</p>
            </div>
            <button
              onClick={() => navigate('/admin/products/all')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-100 bg-white px-3 py-2 text-[11px] font-extrabold text-amber-700 shadow-sm transition hover:border-amber-200 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              View All <FiArrowRight className="text-xs" />
            </button>
          </div>

          <div className="my-auto space-y-2.5">
            {topProducts.length === 0 ? (
              <div className="py-8 text-center">
                <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <FiBox size={17} />
                </span>
                <span className="block text-xs font-bold text-slate-700">No products yet</span>
                <span className="mt-1 block text-[10px] text-slate-400">Your newest catalog items will appear here.</span>
              </div>
            ) : topProducts.map((prod) => (
              <div key={prod.id} className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white/80 p-2.5 transition hover:border-amber-200 hover:bg-white hover:shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={getDashboardImageUrl(prod.img)}
                    alt={prod.name}
                    className="h-11 w-11 shrink-0 rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-1 object-contain shadow-sm"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/images/categories/necklacecat.png";
                    }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold leading-tight text-slate-800 transition-colors group-hover:text-[#08796B]">
                      {prod.name}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-slate-400">
                      {prod.cat}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                    {formatCurrency(prod.price)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;

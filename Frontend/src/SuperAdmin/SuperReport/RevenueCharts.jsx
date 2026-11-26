import { useState, useMemo } from "react";
import { Bar, Line, Doughnut } from "react-chartjs-2";
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
} from "chart.js";
import { BarChart3, TrendingUp, PieChart, Calendar, RefreshCcw } from "lucide-react";
import { formatCurrency } from "../../utils/currency";

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

export default function RevenueCharts({
  analyticsData = {},
  subscriptionData = {},
  loading = false,
  onRefresh
}) {
  const [activeTab, setActiveTab] = useState("monthly"); // "daily" | "weekly" | "monthly" | "yearly" | "growth"

  // 1. Data calculation based on activeTab
  const currentChartData = useMemo(() => {
    const daily = analyticsData.daily || [];
    const weekly = analyticsData.weekly || [];
    const monthly = analyticsData.monthly || [];
    const yearly = analyticsData.yearly || [];
    const growth = analyticsData.growth || [];

    switch (activeTab) {
      case "daily":
        return {
          labels: daily.length > 0 ? daily.map((d) => d.label || d.date) : ["No Data"],
          datasets: [
            {
              label: "Daily Revenue",
              data: daily.length > 0 ? daily.map((d) => d.revenue) : [0],
              backgroundColor: "#07564B",
              hoverBackgroundColor: "#0A6F62",
              borderRadius: 6,
              maxBarThickness: 32
            }
          ]
        };

      case "weekly":
        return {
          labels: weekly.length > 0 ? weekly.map((w) => w.label) : ["No Data"],
          datasets: [
            {
              label: "Weekly Revenue",
              data: weekly.length > 0 ? weekly.map((w) => w.revenue) : [0],
              backgroundColor: "#0A6F62",
              hoverBackgroundColor: "#07564B",
              borderRadius: 8,
              maxBarThickness: 40
            }
          ]
        };

      case "yearly":
        return {
          labels: yearly.length > 0 ? yearly.map((y) => y.label) : ["No Data"],
          datasets: [
            {
              label: "Yearly Revenue",
              data: yearly.length > 0 ? yearly.map((y) => y.revenue) : [0],
              backgroundColor: "#07564B",
              hoverBackgroundColor: "#0D9488",
              borderRadius: 8,
              maxBarThickness: 48
            }
          ]
        };

      case "growth":
        return {
          labels: growth.length > 0 ? growth.map((g) => g.label) : ["No Data"],
          datasets: [
            {
              type: "line",
              label: "Growth Rate (%)",
              data: growth.length > 0 ? growth.map((g) => g.growthRate) : [0],
              borderColor: "#10B981",
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              borderWidth: 2.5,
              fill: true,
              tension: 0.35,
              pointBackgroundColor: "#10B981",
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              yAxisID: "y1"
            },
            {
              type: "bar",
              label: "Revenue (₹)",
              data: growth.length > 0 ? growth.map((g) => g.revenue) : [0],
              backgroundColor: "rgba(7, 86, 75, 0.8)",
              hoverBackgroundColor: "#07564B",
              borderRadius: 6,
              maxBarThickness: 28,
              yAxisID: "y"
            }
          ]
        };

      case "monthly":
      default:
        return {
          labels: monthly.length > 0 ? monthly.map((m) => m.label) : ["No Data"],
          datasets: [
            {
              label: "Monthly Revenue",
              data: monthly.length > 0 ? monthly.map((m) => m.revenue) : [0],
              backgroundColor: "#07564B",
              hoverBackgroundColor: "#0D9488",
              borderRadius: 8,
              maxBarThickness: 36
            }
          ]
        };
    }
  }, [activeTab, analyticsData]);

  // Options for main chart
  const barChartOptions = useMemo(() => {
    const isGrowth = activeTab === "growth";
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: isGrowth,
          position: "top",
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            font: { size: 12, weight: 600 }
          }
        },
        tooltip: {
          backgroundColor: "#0F172A",
          titleFont: { size: 13, weight: 700 },
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: function (context) {
              const label = context.dataset.label || "";
              const val = context.raw || 0;
              if (label.includes("(%)") || label.includes("Growth")) {
                return `${label}: ${val}%`;
              }
              return `${label}: ₹${Number(val).toLocaleString("en-IN")}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 11, weight: 600 },
            color: "#64748B"
          }
        },
        y: {
          grid: { color: "#F1F5F9", strokeDashArray: [4, 4] },
          ticks: {
            font: { size: 11 },
            color: "#64748B",
            callback: (val) => (val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`)
          }
        },
        ...(isGrowth && {
          y1: {
            position: "right",
            grid: { display: false },
            ticks: {
              font: { size: 11 },
              color: "#10B981",
              callback: (val) => `${val}%`
            }
          }
        })
      }
    };
  }, [activeTab]);

  // 2. Subscription Plan Distribution Doughnut Chart
  const doughnutData = useMemo(() => {
    const items = subscriptionData.items || [];
    const filtered = items.filter((item) => (item.totalRevenue || 0) > 0);
    const dataToUse = filtered.length > 0 ? filtered : items.slice(0, 5);

    const labels = dataToUse.map((p) => p.planName);
    const revenues = dataToUse.map((p) => p.totalRevenue || 0);
    const colors = [
      "#07564B",
      "#0D9488",
      "#10B981",
      "#F59E0B",
      "#6366F1",
      "#EC4899",
      "#8B5CF6"
    ];

    return {
      labels: labels.length > 0 ? labels : ["No Subscriptions"],
      datasets: [
        {
          data: revenues.length > 0 ? revenues : [1],
          backgroundColor: colors.slice(0, Math.max(1, labels.length)),
          borderWidth: 2,
          borderColor: "#FFFFFF",
          hoverOffset: 6
        }
      ]
    };
  }, [subscriptionData]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          font: { size: 11, weight: 600 },
          padding: 14
        }
      },
      tooltip: {
        backgroundColor: "#0F172A",
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context) => {
            const val = context.raw || 0;
            return ` ₹${Number(val).toLocaleString("en-IN")}`;
          }
        }
      }
    },
    cutout: "68%"
  };

  const tabs = [
    { id: "monthly", label: "Monthly Revenue" },
    { id: "daily", label: "Daily (Last 30D)" },
    { id: "weekly", label: "Weekly Trend" },
    { id: "yearly", label: "Yearly Comparison" },
    { id: "growth", label: "Growth Analytics" }
  ];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Main Revenue Chart (8 cols on lg) */}
      <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-emerald-50/30 p-5 shadow-sm sm:p-6 lg:col-span-8">
        {/* Header & Tabs */}
        <div>
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-base font-black tracking-tight text-slate-900 sm:text-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                  <BarChart3 className="h-4 w-4" />
                </span>
                Revenue Analytics & Trends
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Real-time subscription income performance aggregated from verified database transactions
              </p>
            </div>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-900 sm:self-auto"
                title="Refresh analytics data"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Refresh
              </button>
            )}
          </div>

          {/* Interactive Navigation Pills */}
          <div className="mt-4 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? "border-emerald-800 bg-emerald-800 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="mt-6 h-72 sm:h-80 w-full relative">
          {loading ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
            </div>
          ) : activeTab === "growth" ? (
            <Line data={currentChartData} options={barChartOptions} />
          ) : (
            <Bar data={currentChartData} options={barChartOptions} />
          )}
        </div>
      </div>

      {/* Secondary Chart: Plan Revenue Distribution (4 cols on lg) */}
      <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-sky-50/30 p-5 shadow-sm sm:p-6 lg:col-span-4">
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
            <h2 className="flex items-center gap-2 text-base font-black tracking-tight text-slate-900 sm:text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-800">
                <PieChart className="h-4 w-4" />
              </span>
                Plan Distribution
              </h2>
            <p className="mt-1 text-xs text-slate-500">Revenue share by subscription tier</p>
            </div>
          </div>

          <div className="mt-4 text-center">
            <span className="text-xs font-medium text-slate-500">Total Subscription Income</span>
            <p className="text-xl font-black text-slate-900">
              {formatCurrency(subscriptionData.totalAllRevenue || 0)}
            </p>
          </div>
        </div>

        {/* Donut Chart Canvas */}
        <div className="mt-2 h-64 sm:h-72 w-full relative flex items-center justify-center">
          {loading ? (
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
          ) : (
            <Doughnut data={doughnutData} options={doughnutOptions} />
          )}
        </div>
      </div>
    </div>
  );
}

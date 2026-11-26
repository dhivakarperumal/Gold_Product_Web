import CustomSelect from "../../Components/CustomSelect.jsx";
import { useState, useEffect, useCallback, useId } from "react";
import {
  BarChart3,
  TrendingUp,
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  Filter,
  RefreshCw,
  Store,
  Layers,
  CreditCard,
  Search,
  Eye,
  Sparkles,
  ChevronDown
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../api";
import { formatCurrency } from "../../utils/currency";
import RevenueSummaryCards from "./RevenueSummaryCards";
import RevenueCharts from "./RevenueCharts";
import ShopRevenueTable from "./ShopRevenueTable";
import SubscriptionRevenueSection from "./SubscriptionRevenueSection";
import PaymentHistoryTable from "./PaymentHistoryTable";
import ShopRevenueModal from "./ShopRevenueModal";
import PaymentInvoiceModal from "./PaymentInvoiceModal";
import RevenueComingSoon from "./RevenueComingSoon";
import { exportToCsv, exportToExcel, printElement } from "./exportUtils";

export default function RevenueReports() {
  // Coming Soon toggle state
  const [showComingSoon, setShowComingSoon] = useState(false);

  // Active View Tab
  const [activeView, setActiveView] = useState("all"); // "all" | "analytics" | "shops" | "plans" | "payments"

  // Primary Data States
  const [overview, setOverview] = useState({});
  const [analytics, setAnalytics] = useState({});
  const [shops, setShops] = useState([]);
  const [shopPagination, setShopPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [subscriptions, setSubscriptions] = useState({ items: [], totalAllRevenue: 0 });
  const [payments, setPayments] = useState([]);
  const [paymentPagination, setPaymentPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [plansList, setPlansList] = useState([]);

  // Filter States
  const [datePreset, setDatePreset] = useState("all"); // all | today | yesterday | last7days | last30days | thismonth | lastmonth | thisyear | custom
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Search & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const [shopPage, setShopPage] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [paymentPage, setPaymentPage] = useState(1);

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modals
  const [selectedShopId, setSelectedShopId] = useState(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const customStartDateId = useId();
  const customEndDateId = useId();

  // Helper to resolve dates from preset
  const resolveDates = useCallback(() => {
    const today = new Date();
    const toYMD = (d) => d.toISOString().slice(0, 10);

    switch (datePreset) {
      case "today": {
        const d = toYMD(today);
        return { startDate: d, endDate: d };
      }
      case "yesterday": {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        const d = toYMD(y);
        return { startDate: d, endDate: d };
      }
      case "last7days": {
        const past = new Date(today);
        past.setDate(past.getDate() - 6);
        return { startDate: toYMD(past), endDate: toYMD(today) };
      }
      case "last30days": {
        const past = new Date(today);
        past.setDate(past.getDate() - 29);
        return { startDate: toYMD(past), endDate: toYMD(today) };
      }
      case "thismonth": {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { startDate: toYMD(start), endDate: toYMD(end) };
      }
      case "lastmonth": {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        return { startDate: toYMD(start), endDate: toYMD(end) };
      }
      case "thisyear": {
        const start = new Date(today.getFullYear(), 0, 1);
        const end = new Date(today.getFullYear(), 11, 31);
        return { startDate: toYMD(start), endDate: toYMD(end) };
      }
      case "custom": {
        return { startDate: customStart || undefined, endDate: customEnd || undefined };
      }
      case "all":
      default:
        return { startDate: undefined, endDate: undefined };
    }
  }, [datePreset, customStart, customEnd]);

  // Load Overview & Analytics & Subscriptions
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = resolveDates();
      const params = {
        startDate,
        endDate,
        planId: selectedPlan !== "all" ? selectedPlan : undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined
      };

      const [overviewRes, analyticsRes, subsRes, plansListRes] = await Promise.all([
        api.get("/super-admin/revenue-reports/overview", { params }),
        api.get("/super-admin/revenue-reports/analytics", { params }),
        api.get("/super-admin/revenue-reports/subscription-revenue"),
        api.get("/super-admin/subscription-plans", { params: { pageSize: 50 } })
      ]);

      setOverview(overviewRes.data.data || {});
      setAnalytics(analyticsRes.data.data || {});
      setSubscriptions(subsRes.data.data || { items: [], totalAllRevenue: 0 });
      setPlansList(plansListRes.data.plans || []);
    } catch (err) {
      console.error("Failed to load revenue overview:", err);
      setError(err.response?.data?.message || "Failed to load revenue analytics.");
      toast.error("Could not load revenue reports");
    } finally {
      setLoading(false);
    }
  }, [resolveDates, selectedPlan, selectedStatus]);

  // Load Shop-wise Revenue
  const loadShopData = useCallback(async () => {
    setTableLoading(true);
    try {
      const { startDate, endDate } = resolveDates();
      const params = {
        page: shopPage,
        limit: 10,
        search: searchQuery,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
        planId: selectedPlan !== "all" ? selectedPlan : undefined,
        startDate,
        endDate
      };
      const res = await api.get("/super-admin/revenue-reports/shop-revenue", { params });
      setShops(res.data.data?.items || []);
      setShopPagination(res.data.data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      console.error("Failed to load shop revenue:", err);
    } finally {
      setTableLoading(false);
    }
  }, [resolveDates, shopPage, searchQuery, selectedStatus, selectedPlan]);

  // Load Payments History
  const loadPaymentData = useCallback(async () => {
    setTableLoading(true);
    try {
      const { startDate, endDate } = resolveDates();
      const params = {
        page: paymentPage,
        limit: 10,
        search: searchQuery,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
        paymentMethod: paymentMethod !== "all" ? paymentMethod : undefined,
        planId: selectedPlan !== "all" ? selectedPlan : undefined,
        startDate,
        endDate
      };
      const res = await api.get("/super-admin/revenue-reports/payments", { params });
      setPayments(res.data.data?.items || []);
      setPaymentPagination(res.data.data?.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      console.error("Failed to load payments:", err);
    } finally {
      setTableLoading(false);
    }
  }, [resolveDates, paymentPage, searchQuery, selectedStatus, paymentMethod, selectedPlan]);

  // Trigger main dashboard load when filters change
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Trigger shop data when search/page/filters change
  useEffect(() => {
    loadShopData();
  }, [loadShopData]);

  // Trigger payment data when search/page/filters change
  useEffect(() => {
    loadPaymentData();
  }, [loadPaymentData]);

  // Reset pagination on search
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setShopPage(1);
    setPaymentPage(1);
  };

  // Export handlers
  const handleExportCsv = async () => {
    setExportOpen(false);
    try {
      toast.loading("Preparing CSV export...", { id: "export" });
      const { startDate, endDate } = resolveDates();
      const res = await api.get("/super-admin/revenue-reports/export", {
        params: {
          reportType: activeView === "shops" ? "shop_revenue" : activeView === "plans" ? "subscription_revenue" : "payments",
          format: "csv",
          startDate,
          endDate,
          planId: selectedPlan !== "all" ? selectedPlan : undefined,
          status: selectedStatus !== "all" ? selectedStatus : undefined
        },
        responseType: "blob"
      });

      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `revenue_report_${datePreset}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("CSV export downloaded!", { id: "export" });
    } catch (err) {
      toast.error("Export failed", { id: "export" });
    }
  };

  const handleExportExcel = () => {
    setExportOpen(false);
    if (activeView === "shops") {
      const headers = ["S.No", "Shop Name", "Shop ID", "Plan", "Total Amount", "Paid Amount", "Pending Amount", "Status", "Last Payment Date"];
      const rows = shops.map((s) => [
        s.sNo,
        s.shopName,
        s.shopCode,
        s.planName,
        s.totalAmount,
        s.paidAmount,
        s.pendingAmount,
        s.paymentStatus,
        s.lastPaymentDate ? new Date(s.lastPaymentDate).toISOString().slice(0, 10) : "N/A"
      ]);
      exportToExcel(`shop_revenue_${new Date().toISOString().slice(0, 10)}`, "Shop Revenue", headers, rows);
      toast.success("Excel report exported!");
    } else if (activeView === "plans") {
      const headers = ["Plan Name", "Monthly Price", "Subscribers", "Active", "Expired", "Total Revenue", "Share %"];
      const rows = subscriptions.items.map((p) => [
        p.planName,
        p.monthlyPrice,
        p.subscribersCount,
        p.activeSubscriptions,
        p.expiredSubscriptions,
        p.totalRevenue,
        `${p.percentageShare}%`
      ]);
      exportToExcel(`subscription_revenue_${new Date().toISOString().slice(0, 10)}`, "Subscription Revenue", headers, rows);
      toast.success("Excel report exported!");
    } else {
      const headers = ["Txn ID", "Invoice No", "Shop Name", "Shop ID", "Plan", "Payment Date", "Method", "Amount", "Status"];
      const rows = payments.map((p) => [
        p.transactionId,
        p.invoiceNumber,
        p.shopName,
        p.shopCode,
        p.planName,
        p.paymentDate ? new Date(p.paymentDate).toISOString().slice(0, 10) : "N/A",
        p.paymentMethod,
        p.amount,
        p.paymentStatus
      ]);
      exportToExcel(`payment_transactions_${new Date().toISOString().slice(0, 10)}`, "Payment History", headers, rows);
      toast.success("Excel report exported!");
    }
  };

  const handlePrint = () => {
    setExportOpen(false);
    const targetId = activeView === "shops"
      ? "shop-revenue-table-container"
      : activeView === "plans"
      ? "subscription-revenue-container"
      : activeView === "payments"
      ? "payment-history-table-container"
      : "revenue-reports-main-content";

    printElement(targetId, `Sri Golds Revenue Report - ${new Date().toLocaleDateString("en-IN")}`);
  };

  // If user explicitly views the Coming Soon preview screen:
  if (showComingSoon) {
    return <RevenueComingSoon onSwitchToLive={() => setShowComingSoon(false)} />;
  }

  return (
    <div className="space-y-6 pb-12 font-sans" id="revenue-reports-main-content">
      {/* ── TOP HEADER & ACTIONS ─────────────────────────────────────────── */}
      <div className="relative isolate rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-[#07564B] via-[#086257] to-[#0A7465] px-5 py-5 text-white shadow-lg shadow-emerald-950/10 sm:px-7 sm:py-6">
        <span aria-hidden="true" className="pointer-events-none absolute -right-6 -top-14 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-[-4rem] right-1/3 h-36 w-36 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-amber-200 shadow-inner">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-emerald-100/80">Super Admin | Finance</p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">
                Revenue Reports
              </h1>
              <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-emerald-50/80 sm:text-sm">
                Super Admin financial analytics, subscription income, and verified transaction ledgers
              </p>
            </div>
          </div>
        </div>

        {/* Global Toolbar: Date filter, Coming Soon toggle, Export, Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => {
              loadDashboardData();
              loadShopData();
              loadPaymentData();
              toast.success("Revenue data refreshed");
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-white/20 active:scale-95"
            title="Refresh All Revenue Data"
          >
            <RefreshCw className="h-3.5 w-3.5 text-amber-200" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen(!exportOpen)}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-300 px-4 py-2.5 text-xs font-extrabold text-emerald-950 shadow-md shadow-emerald-950/15 transition hover:bg-amber-200 active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Reports</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </button>

            {exportOpen && (
              <div className="absolute right-0 z-50 mt-2 w-52 origin-top-right rounded-2xl border border-slate-100 bg-white p-1.5 text-slate-800 shadow-xl ring-1 ring-black/5">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Export to Excel (.xls)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition"
                >
                  <FileText className="h-4 w-4 text-teal-600" />
                  <span>Export to CSV (.csv)</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Printer className="h-4 w-4 text-slate-500" />
                  <span>Print / Download PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Toggle Coming Soon Screen for Review */}
          <button
            type="button"
            onClick={() => setShowComingSoon(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-white/20"
            title="Preview Coming Soon Screen"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Coming Soon Preview</span>
          </button>
        </div>
        </div>
      </div>

      {/* ── SECTION 6: FILTERS & SEARCH TOOLBAR ──────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
          <Filter className="h-3.5 w-3.5 text-emerald-700" />
          <span>Report filters</span>
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:w-72 xl:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search shops, transactions, invoices..."
              aria-label="Search revenue reports"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm font-medium text-slate-800 transition focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/10"
            />
          </div>

          <div className="flex w-full flex-col items-end gap-2 xl:w-auto xl:flex-row xl:items-center xl:shrink-0">
            <div className="flex w-full items-center gap-2 xl:w-auto">
              <CustomSelect
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                aria-label="Filter revenue reports by period"
                className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/10 xl:w-[150px]"
              >
                {[
                  { id: "all", label: "All Time" },
                  { id: "today", label: "Today" },
                  { id: "yesterday", label: "Yesterday" },
                  { id: "last7days", label: "Last 7 Days" },
                  { id: "last30days", label: "Last 30 Days" },
                  { id: "thismonth", label: "This Month" },
                  { id: "lastmonth", label: "Last Month" },
                  { id: "thisyear", label: "This Year" },
                  { id: "custom", label: "Custom Date Range" }
                ].map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </CustomSelect>
            </div>

            <CustomSelect
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              aria-label="Filter revenue reports by subscription plan"
              className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/10 xl:w-[190px]"
            >
              <option value="all">All Subscription Plans</option>
              {plansList.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.plan_name}
                </option>
              ))}
            </CustomSelect>

            <CustomSelect
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filter revenue reports by payment status"
              className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/10 xl:w-[190px]"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid Only</option>
              <option value="pending">Pending Only</option>
              <option value="failed">Failed Only</option>
              <option value="refunded">Refunded Only</option>
            </CustomSelect>
          </div>
        </div>

        {/* Custom Date Range Picker when preset === 'custom' */}
        {datePreset === "custom" && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-xs">
            <div className="flex items-center gap-1.5">
              <label htmlFor={customStartDateId} className="font-semibold text-slate-600">Start Date:</label>
              <input
                id={customStartDateId}
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-slate-700 focus:border-emerald-700 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label htmlFor={customEndDateId} className="font-semibold text-slate-600">End Date:</label>
              <input
                id={customEndDateId}
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-slate-700 focus:border-emerald-700 focus:bg-white focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                loadDashboardData();
                loadShopData();
                loadPaymentData();
              }}
              className="rounded-lg bg-emerald-800 px-3.5 py-2 font-bold text-white shadow-sm transition hover:bg-emerald-900"
            >
              Apply Filter
            </button>
          </div>
        )}
      </div>

      {/* Filter Notice Banner if custom or specific filter is active */}
      {overview.filteredSummary && (
        <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 text-xs text-emerald-900 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold">Filtered Period Revenue:</span>
            <span className="font-black text-sm font-sans">
              {formatCurrency(overview.filteredSummary.filteredRevenue)}
            </span>
            <span className="text-emerald-700">
              ({overview.filteredSummary.filteredPaidCount} Paid / {overview.filteredSummary.filteredTransactions} Total Invoices)
            </span>
          </div>
          {overview.filteredSummary.filteredPending > 0 && (
            <div className="font-semibold text-amber-800">
              Filtered Pending: {formatCurrency(overview.filteredSummary.filteredPending)}
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 1: DASHBOARD OVERVIEW SUMMARY CARDS ────────────────── */}
      <RevenueSummaryCards data={overview} loading={loading} />

      {/* ── NAVIGATION TABS (All / Analytics / Shop-wise / Subscription / Payments) ── */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
        {[
          { id: "all", label: "Executive Overview", icon: BarChart3 },
          { id: "analytics", label: "Analytics Charts", icon: TrendingUp },
          { id: "shops", label: "Shop-wise Revenue", icon: Store },
          { id: "plans", label: "Subscription Revenue", icon: Layers },
          { id: "payments", label: "Payment History", icon: CreditCard }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id)}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-all ${
                isActive
                  ? "border-emerald-800 bg-emerald-800 text-white shadow-sm"
                  : "border-transparent text-slate-500 hover:border-emerald-100 hover:bg-emerald-50 hover:text-emerald-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── SECTION 2: REVENUE ANALYTICS INTERACTIVE CHARTS ────────────── */}
      {(activeView === "all" || activeView === "analytics") && (
        <RevenueCharts
          analyticsData={analytics}
          subscriptionData={subscriptions}
          loading={loading}
          onRefresh={loadDashboardData}
        />
      )}

      {/* ── SECTION 3: SHOP-WISE REVENUE TABLE ──────────────────────────── */}
      {(activeView === "all" || activeView === "shops") && (
        <ShopRevenueTable
          shops={shops}
          pagination={shopPagination}
          loading={tableLoading}
          status={selectedStatus}
          onStatusChange={setSelectedStatus}
          page={shopPage}
          onPageChange={setShopPage}
          onSelectShop={(shop) => setSelectedShopId(shop.shopId)}
        />
      )}

      {/* ── SECTION 4: SUBSCRIPTION REVENUE BREAKDOWN ───────────────────── */}
      {(activeView === "all" || activeView === "plans") && (
        <SubscriptionRevenueSection
          subscriptionData={subscriptions}
          loading={loading}
        />
      )}

      {/* ── SECTION 5: PAYMENT TRANSACTION HISTORY ──────────────────────── */}
      {(activeView === "all" || activeView === "payments") && (
        <PaymentHistoryTable
          payments={payments}
          pagination={paymentPagination}
          loading={tableLoading}
          status={selectedStatus}
          onStatusChange={setSelectedStatus}
          method={paymentMethod}
          onMethodChange={setPaymentMethod}
          page={paymentPage}
          onPageChange={setPaymentPage}
          onSelectPayment={(p) => setSelectedPaymentId(p.id)}
        />
      )}

      {/* ── SECTION 8: MODALS FOR REVENUE DETAILS ──────────────────────── */}
      {selectedShopId && (
        <ShopRevenueModal
          shopId={selectedShopId}
          onClose={() => setSelectedShopId(null)}
        />
      )}

      {selectedPaymentId && (
        <PaymentInvoiceModal
          paymentId={selectedPaymentId}
          onClose={() => setSelectedPaymentId(null)}
        />
      )}
    </div>
  );
}

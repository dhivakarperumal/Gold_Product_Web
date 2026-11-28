import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  Gem,
  Package,
  RefreshCw,
  Share2,
  TrendingUp,
  UsersRound,
  Wallet
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../api";
import DateRangeFilter from "../Components/DateRangeFilter";
import { DATE_RANGE_OPTIONS, formatDateRange } from "../Components/dateRange";
import { formatCurrency } from "../../utils/currency";

const RANGE_OPTIONS = DATE_RANGE_OPTIONS.map(([value, label]) => ({ value, label }));

const EMPTY_REVENUE_TRENDS = [];

const STAT_CARDS = [
  {
    id: "total_customers",
    icon: UsersRound,
    cardStyle: "border-t-[#00b8a9] bg-gradient-to-br from-[#eefbf9] to-white",
    iconStyle: "bg-[#009b8b] text-white",
    dotStyle: "bg-[#009b8b]",
    trendStyle: "text-[#007d70]",
    accent: "#009b8b"
  },
  {
    id: "active_gold_loans",
    icon: Wallet,
    cardStyle: "border-t-amber-500 bg-gradient-to-br from-amber-50 to-white",
    iconStyle: "bg-amber-500 text-white",
    dotStyle: "bg-amber-600",
    trendStyle: "text-amber-700",
    accent: "#d97706"
  },
  {
    id: "total_products",
    icon: Package,
    cardStyle: "border-t-sky-500 bg-gradient-to-br from-sky-50 to-white",
    iconStyle: "bg-sky-600 text-white",
    dotStyle: "bg-sky-600",
    trendStyle: "text-sky-700",
    accent: "#0284c7"
  },
  {
    id: "gold_stock_value",
    icon: Gem,
    cardStyle: "border-t-rose-500 bg-gradient-to-br from-rose-50 to-white",
    iconStyle: "bg-rose-600 text-white",
    dotStyle: "bg-rose-600",
    trendStyle: "text-rose-700",
    accent: "#e11d48"
  }
];

const escapeXml = (value) => String(value ?? "").replace(/[<>&'"]/g, (character) => ({
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  "'": "&apos;",
  "\"": "&quot;"
})[character]);

function getReportSheets(data, range) {
  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label || range;
  return [
    {
      name: "Summary",
      rows: [
        ["Gold Shop Report", rangeLabel],
        ["Metric", "Value", "Details"],
        ...(data.stats || []).map((stat) => [stat.label, stat.value, stat.trend]),
        ["Total loans", data.totalLoansCount ?? 0, "Filtered total"],
        ...Object.entries(data.loanStatusCounts || {}).map(([status, count]) => [`${status} loans`, count, "Filtered count"])
      ]
    },
    {
      name: "Sales Trend",
      rows: [
        ["Period", "Sales (INR)", "Date"],
        ...(data.revenueTrends || []).map((item) => [item.label, Number(item.revenue) || 0, item.date || ""])
      ]
    },
    {
      name: "Loan Activity",
      rows: [
        ["Loan ID", "Customer", "Jewellery", "Amount", "Status", "Date"],
        ...(data.recentLoans || []).map((loan) => [
          loan.id, loan.customer, loan.jewellery, loan.rawAmount ?? loan.amount, loan.status, loan.date
        ])
      ]
    },
    {
      name: "Products",
      rows: [
        ["Product", "Category", "Sales", "Price"],
        ...(data.topProducts || []).map((product) => [product.name, product.cat, product.sales, product.amount])
      ]
    }
  ];
}

function createExcelWorkbook(data, range) {
  const sheets = getReportSheets(data, range).map(({ name, rows }) => {
    const tableRows = rows.map((row) => `<Row>${row.map((value) => {
      const isNumber = typeof value === "number" && Number.isFinite(value);
      return `<Cell><Data ss:Type="${isNumber ? "Number" : "String"}">${escapeXml(value)}</Data></Cell>`;
    }).join("")}</Row>`).join("");
    return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${tableRows}</Table></Worksheet>`;
  }).join("");
  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheets}
</Workbook>`;
  return new Blob(["\uFEFF", workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
}

function downloadExcel(data, range) {
  const url = URL.createObjectURL(createExcelWorkbook(data, range));
  const link = document.createElement("a");
  link.href = url;
  link.download = `gold-shop-report-${range}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openPdfReport(data, range) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast.error("Allow pop-ups to print or save this report as PDF");
    return;
  }

  const table = (headers, rows) => `
    <table>
      <thead><tr>${headers.map((header) => `<th>${escapeXml(header)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${escapeXml(value)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;
  const sheets = getReportSheets(data, range);
  const summaryRows = [
    ...(data.stats || []).map((stat) => [stat.label, stat.value, stat.trend]),
    ["Total loans", data.totalLoansCount ?? 0, "Filtered total"],
    ...Object.entries(data.loanStatusCounts || {}).map(([status, count]) => [`${status} loans`, count, "Filtered count"])
  ];
  const rangeLabel = escapeXml(RANGE_OPTIONS.find((option) => option.value === range)?.label || range);
  const content = `
    <header><p>SRI GOLDS · ADMIN REPORT</p><h1>Gold Shop Report</h1><span>${rangeLabel}</span></header>
    <section><h2>Summary</h2>${table(["Metric", "Value", "Details"], summaryRows)}</section>
    <section><h2>Sales trend</h2>${table(sheets[1].rows[0], sheets[1].rows.slice(1))}</section>
    <section><h2>Loan activity</h2>${table(sheets[2].rows[0], sheets[2].rows.slice(1))}</section>
    <section><h2>Products</h2>${table(sheets[3].rows[0], sheets[3].rows.slice(1))}</section>`;
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Gold Shop Report</title>
    <style>
      body{font:14px Arial,sans-serif;color:#17211e;margin:32px}
      header{border-bottom:3px solid #006d50;padding-bottom:14px;margin-bottom:24px}
      header p{color:#006d50;font-size:11px;font-weight:bold;letter-spacing:2px}
      h1{margin:6px 0;font-size:26px}header span{color:#64748b}
      section{margin:22px 0;break-inside:avoid}
      h2{font-size:17px;color:#123b32}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #dbe4df;padding:7px;text-align:left}
      th{background:#edf5f1;color:#123b32}
      @page{size:auto;margin:16mm}
      @media print{body{margin:0}}
    </style></head><body>${content}</body></html>`);
  printWindow.document.close();
  printWindow.addEventListener("afterprint", () => printWindow.close(), { once: true });
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 300);
}

async function shareReport(data, range) {
  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label || range;
  const message = [
    `Gold Shop Report — ${rangeLabel}`,
    ...(data.stats || []).map((stat) => `${stat.label}: ${stat.value}`),
    `Total loans: ${data.totalLoansCount ?? 0}`
  ].join("\n");

  try {
    if (navigator.share) {
      const file = new File([createExcelWorkbook(data, range)], `gold-shop-report-${range}.xls`, {
        type: "application/vnd.ms-excel"
      });
      const shareData = { title: "Gold Shop Report", text: message };
      if (navigator.canShare?.({ files: [file] })) shareData.files = [file];
      await navigator.share(shareData);
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
      toast.success("Report summary copied. You can share it now.");
      return;
    }
    toast.error("Sharing is not available in this browser");
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Failed to share report:", error);
      toast.error("Could not share the report");
    }
  }
}

const Reports = () => {
  const [dateRange, setDateRange] = useState({ preset: "all", startDate: "", endDate: "" });
  const [reportsData, setReportsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const fetchReports = async () => {
      setLoading(true);
      setError(false);

      try {
        const response = await api.get("/dashboard", {
          params: {
            datePreset: dateRange.preset,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
          },
          signal: controller.signal
        });
        if (!response.data?.stats) {
          throw new Error("Dashboard API returned no report metrics");
        }
        setReportsData(response.data);
      } catch (fetchError) {
        if (fetchError.name === "CanceledError") return;
        console.error("Failed to load report data:", fetchError);
        setError(true);
        toast.error("Failed to load report data");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchReports();
    return () => controller.abort();
  }, [dateRange, retryKey]);

  const chartValues = reportsData?.revenueTrends || EMPTY_REVENUE_TRENDS;
  const chartMax = Math.max(...chartValues.map((item) => Number(item.revenue) || 0), 1);
  const chartTotal = useMemo(
    () => chartValues.reduce((total, item) => total + (Number(item.revenue) || 0), 0),
    [chartValues]
  );
  const statById = useMemo(
    () => new Map((reportsData?.stats || []).map((stat) => [stat.id, stat])),
    [reportsData]
  );
  const selectedRange = dateRange.preset === "custom"
    ? formatDateRange(dateRange)
    : RANGE_OPTIONS.find((option) => option.value === dateRange.preset)?.label || "All Time";
  const exportRange = dateRange.preset;
  const loans = reportsData?.recentLoans || [];
  const products = reportsData?.topProducts || [];
  const loanStatuses = reportsData?.loanStatusCounts || {};
  const displayedStatuses = ["Active", "Processing", "Pending", "Overdue"];

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 pb-8">
      <header className="relative isolate overflow-hidden rounded-[26px] bg-gradient-to-r from-[#064e45] via-[#087968] to-[#008577] px-5 py-6 text-white shadow-[0_20px_45px_rgba(4,78,69,0.18)] sm:px-8 sm:py-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-32 h-80 w-80 rounded-full border border-white/10">
          <div className="absolute inset-8 rounded-full border border-white/10" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-100">
              Admin insights <span className="mx-1.5 text-emerald-200/70">·</span> Business overview
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Reports</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50 sm:text-base">
              Track sales trends, customers, inventory, and gold loan activity from your dashboard.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white shadow-inner">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Live dashboard data
          </div>
        </div>
      </header>

      <section aria-label="Report date range and export actions" className="flex flex-col gap-3 rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter onApply={setDateRange} />
          <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{selectedRange}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => reportsData && downloadExcel(reportsData, exportRange)}
            disabled={!reportsData || loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            <FileSpreadsheet size={16} /> Excel
          </button>
          <button
            type="button"
            onClick={() => reportsData && openPdfReport(reportsData, exportRange)}
            disabled={!reportsData || loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            <FileText size={16} /> PDF
          </button>
          <button
            type="button"
            onClick={() => reportsData && shareReport(reportsData, exportRange)}
            disabled={!reportsData || loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            <Share2 size={16} /> Share
          </button>
        </div>
      </section>

      {error && !reportsData ? (
        <section className="rounded-[22px] border border-rose-200 bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-slate-800">Reports couldn’t be loaded.</p>
          <p className="mt-1 text-sm text-slate-500">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => setRetryKey((key) => key + 1)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-900"
          >
            <RefreshCw size={15} />
            Try again
          </button>
        </section>
      ) : (
        <>
          <section aria-label="Report summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {STAT_CARDS.map(({ id, icon: Icon, cardStyle, iconStyle, dotStyle, trendStyle, accent }) => {
              const stat = statById.get(id);
              return (
                <article
                  key={id}
                  className={`relative flex min-h-[150px] min-w-0 items-center justify-between gap-3 overflow-hidden rounded-[22px] border-x border-b border-t-4 border-x-slate-200/70 border-b-slate-200/70 p-4 shadow-[0_5px_15px_rgba(15,23,42,0.055)] transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5 2xl:p-6 ${cardStyle}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{stat?.label || "Loading metric"}</p>
                    <p className="my-2 truncate text-2xl font-black leading-tight tracking-tight text-slate-950 tabular-nums sm:text-3xl 2xl:text-4xl">
                      {loading && !stat ? "—" : stat?.value ?? "—"}
                    </p>
                    <p className={`flex min-w-0 items-center gap-2 text-xs font-bold ${trendStyle}`}>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${dotStyle}`} />
                      <span className="truncate">{stat?.trend || "From dashboard data"}</span>
                    </p>
                    <p className="mt-1 truncate text-[10px] font-medium text-slate-500">{selectedRange} · Dashboard report</p>
                  </div>
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] text-white shadow-lg shadow-slate-900/10 xl:h-10 xl:w-10 2xl:h-14 2xl:w-14 ${iconStyle}`}>
                    <Icon size={23} strokeWidth={2.2} />
                  </div>
                  <TrendingUp aria-hidden="true" size={26} strokeWidth={2.5} style={{ color: accent }} className="absolute bottom-3 right-3 opacity-15" />
                </article>
              );
            })}
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <section className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-6 xl:col-span-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><TrendingUp size={18} /></span>
                  <div>
                    <h2 className="text-base font-black text-slate-900">Sales overview</h2>
                    <p className="mt-1 text-xs text-slate-500">{selectedRange} · Values returned by the dashboard API</p>
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-2.5 text-right">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">Period total</p>
                  <p className="mt-0.5 text-base font-black tabular-nums text-slate-900">{formatCurrency(chartTotal)}</p>
                </div>
              </div>

              {chartValues.length ? (
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50/80 to-white p-3 sm:p-4">
                  <div className="overflow-x-auto pb-1">
                    <div className="relative flex h-56 min-w-[560px] items-end gap-2 border-b border-l border-slate-200 px-3 pb-7 pt-3 sm:gap-3">
                      <div className="pointer-events-none absolute inset-x-0 top-3 bottom-7 flex flex-col justify-between">
                        {[0, 1, 2, 3].map((line) => (
                          <div key={line} className="border-t border-dashed border-slate-200/80" />
                        ))}
                      </div>
                      {chartValues.map((item, index) => {
                        const amount = Number(item.revenue) || 0;
                        const height = Math.max((amount / chartMax) * 100, amount > 0 ? 4 : 0);
                        const labelStep = Math.max(1, Math.ceil(chartValues.length / 8));
                        const showLabel = index % labelStep === 0 || index === chartValues.length - 1;
                        return (
                          <div
                            key={`${item.label}-${index}`}
                            className="relative z-10 flex h-full min-w-0 flex-1 flex-col justify-end"
                            title={`${item.date || item.label}: ${formatCurrency(amount)}`}
                          >
                            <div className="flex h-full items-end">
                              <div
                                className="w-full rounded-t-lg bg-gradient-to-t from-[#087968] to-[#25c6ae] shadow-[0_4px_12px_rgba(8,121,104,0.16)] transition-[height] duration-300"
                                style={{ height: `${height}%` }}
                              />
                            </div>
                            {showLabel && (
                              <span className="absolute -bottom-6 left-1/2 w-12 -translate-x-1/2 truncate text-center text-[10px] font-semibold text-slate-500">
                                {item.label}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
                  No sales trend data is available for this period.
                </div>
              )}
            </section>

            <section className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-6 xl:col-span-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Wallet size={18} /></span>
                  <div>
                    <h2 className="text-base font-black text-slate-900">Gold loan report</h2>
                    <p className="mt-1 text-xs text-slate-500">Current loan counts from the dashboard</p>
                  </div>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2 text-right">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-800">Total loans</p>
                  <p className="text-lg font-black tabular-nums text-amber-950">{reportsData?.totalLoansCount ?? "—"}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {displayedStatuses.map((status) => (
                  <div key={status} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-gradient-to-r from-slate-50 to-white px-3 py-3">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <span className={`h-2 w-2 rounded-full ${status === "Active" ? "bg-emerald-500" : status === "Processing" ? "bg-sky-500" : status === "Pending" ? "bg-amber-500" : "bg-rose-500"}`} />
                      {status}
                    </span>
                    <span className="text-sm font-black tabular-nums text-slate-900">{loanStatuses[status] ?? 0}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-3 text-xs font-medium text-emerald-900">
                <BarChart3 size={16} className="shrink-0 text-emerald-700" />
                <span>Loan status counts reflect the latest dashboard response.</span>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <section className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] xl:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><BarChart3 size={18} /></span>
                  <div>
                    <h2 className="text-base font-black text-slate-900">Recent loan activity</h2>
                    <p className="mt-1 text-xs text-slate-500">Latest loan records in the dashboard response</p>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-800">{loans.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#064e45] via-[#087968] to-[#008577]">
                      {["Loan ID", "Customer", "Jewellery", "Amount", "Status", "Date"].map((heading) => (
                        <th key={heading} scope="col" className="whitespace-nowrap border-b border-white/15 px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map((loan, index) => (
                      <tr key={loan.rawId || loan.id || index} className="group transition-colors odd:bg-white even:bg-slate-50/60 hover:bg-emerald-50/70">
                        <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-sm font-extrabold tabular-nums text-slate-800">{loan.id || "—"}</td>
                        <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-800">{loan.customer || "—"}</td>
                        <td className="border-b border-slate-100 px-5 py-4 text-sm text-slate-600">{loan.jewellery || "—"}</td>
                        <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-sm font-extrabold tabular-nums text-slate-800">{loan.amount || "—"}</td>
                        <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${loan.status === "Active" ? "bg-emerald-100 text-emerald-800" : loan.status === "Overdue" ? "bg-rose-100 text-rose-800" : loan.status === "Pending" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>{loan.status || "—"}</span>
                        </td>
                        <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-xs font-medium text-slate-500">{loan.date || "—"}</td>
                      </tr>
                    ))}
                    {!loans.length && (
                      <tr>
                        <td colSpan="6" className="px-6 py-14 text-center text-sm font-medium text-slate-500">No loan activity is available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-6 xl:col-span-2">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Gem size={18} /></span>
                <div>
                  <h2 className="text-base font-black text-slate-900">Product price snapshot</h2>
                  <p className="mt-1 text-xs text-slate-500">Products returned by the dashboard API</p>
                </div>
              </div>
              <div className="mt-2 divide-y divide-slate-100">
                {products.slice(0, 5).map((product, index) => (
                  <div key={product.id || `${product.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition hover:bg-amber-50/50 first:pt-3 last:pb-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                        <Gem size={17} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-slate-800">{product.name || "Product"}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{product.cat || "Jewellery"}</p>
                      </div>
                    </div>
                    <p className="shrink-0 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-extrabold tabular-nums text-slate-800">{product.amount || "—"}</p>
                  </div>
                ))}
                {!products.length && (
                  <p className="py-10 text-center text-sm font-medium text-slate-500">No product data is available.</p>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;

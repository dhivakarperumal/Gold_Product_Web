import CustomSelect from "../../Components/CustomSelect.jsx";
import { Eye, Filter, Store, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Clock, CalendarDays } from "lucide-react";
import { formatCurrency } from "../../utils/currency";

export default function ShopRevenueTable({
  shops = [],
  pagination = {},
  loading = false,
  status = "all",
  onStatusChange,
  page = 1,
  onPageChange,
  onSelectShop
}) {
  const getStatusBadge = (shopStatus) => {
    switch (shopStatus) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Paid
          </span>
        );
      case "partial":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
            <Clock className="h-3 w-3" /> Partial
          </span>
        );
      case "pending":
      case "unpaid":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-800 border border-rose-200">
            <AlertCircle className="h-3 w-3" /> Pending
          </span>
        );
    }
  };

  const formatDate = (val) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lg shadow-slate-900/[0.04]" id="shop-revenue-table-container">
      {/* Table Header with Search & Filter */}
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-white via-white to-emerald-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-500 text-white shadow-md shadow-emerald-900/15">
            <Store className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">Collections overview</p>
            <h3 className="mt-0.5 text-base font-black tracking-tight text-slate-900">Shop-wise Revenue</h3>
            <p className="mt-1 text-xs text-slate-500">
              Revenue, billing obligations, and collections by registered Gold Shop
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
            {pagination.total ?? shops.length} shops
          </span>
          {/* Status Filter */}
          <div className="relative flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Filter className="h-4 w-4" />
            </span>
            <CustomSelect
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              aria-label="Filter shops by payment status"
              className="border-0 bg-transparent py-2.5 pl-1 pr-3 text-xs font-bold text-slate-700 focus:outline-none focus:ring-0"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="pending">Pending / Due</option>
            </CustomSelect>
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="overflow-x-auto bg-slate-50/50 px-3 pb-2 sm:px-4">
        <table className="w-full border-separate border-spacing-0 text-left text-xs">
          <thead>
            <tr className="bg-gradient-to-r from-[#064E3B] via-[#08796B] to-[#0D776D] text-[10px] font-extrabold uppercase tracking-[0.08em] text-white">
              <th className="rounded-tl-xl py-3 px-4 w-12 text-center">S.No</th>
              <th className="py-3 px-4">Shop Name</th>
              <th className="py-3 px-4">Shop ID</th>
              <th className="py-3 px-4">Subscription Plan</th>
              <th className="py-3 px-4 text-right">Total Amount</th>
              <th className="py-3 px-4 text-right">Paid Amount</th>
              <th className="py-3 px-4 text-right">Pending Amount</th>
              <th className="py-3 px-4 text-center">Payment Status</th>
              <th className="py-3 px-4">Last Payment Date</th>
              <th className="rounded-tr-xl py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={10} className="py-4 px-4">
                    <div className="h-4 bg-slate-100 rounded w-full" />
                  </td>
                </tr>
              ))
            ) : shops.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  <Store className="h-10 w-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                  <p className="text-sm font-semibold text-slate-600">No Gold Shops found</p>
                  <p className="text-xs text-slate-400 mt-1">Try modifying your search or status filter</p>
                </td>
              </tr>
            ) : (
              shops.map((shop, idx) => {
                const totalAmount = Number(shop.totalAmount) || 0;
                const paidAmount = Number(shop.paidAmount) || 0;
                const collectedPercent = totalAmount > 0
                  ? Math.min(100, Math.max(0, (paidAmount / totalAmount) * 100))
                  : 0;
                const shopInitials = (shop.shopName || "Gold Shop")
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")
                  .toUpperCase();

                return (
                  <tr key={shop.shopId || idx} className="group transition-colors odd:bg-white even:bg-slate-50/40 hover:bg-emerald-50/70">
                    <td className="py-4 px-4 text-center font-semibold text-slate-500">
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-slate-100 px-1.5 text-[10px] font-extrabold text-slate-500 transition group-hover:bg-emerald-100 group-hover:text-emerald-800">
                        {shop.sNo || idx + 1}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex min-w-[170px] items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-100 text-[11px] font-black text-amber-800 shadow-sm">
                          {shopInitials || "GS"}
                        </span>
                        <div>
                          <div className="font-extrabold text-slate-900">{shop.shopName}</div>
                          <div className="mt-0.5 text-[10px] font-medium text-slate-500">
                            {shop.ownerName || "Shop owner"}{shop.city ? ` · ${shop.city}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1 font-mono text-[10px] font-extrabold text-emerald-800">
                        {shop.shopCode}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-800">{shop.planName}</div>
                      <span className="mt-1 inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-500">
                        {shop.subscriptionDuration}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-sans">
                      <span className="font-extrabold text-slate-900">
                        {formatCurrency(shop.totalAmount)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-sans">
                      <span className="font-extrabold text-emerald-700">
                        {formatCurrency(shop.paidAmount)}
                      </span>
                      <div className="ml-auto mt-1.5 h-1.5 w-20 overflow-hidden rounded-full bg-emerald-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400 transition-all"
                          style={{ width: `${collectedPercent}%` }}
                          role="progressbar"
                          aria-label="Revenue collected"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(collectedPercent)}
                        />
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-extrabold font-sans">
                      <span className={`inline-flex rounded-lg px-2 py-1 ${shop.pendingAmount > 0 ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200/70" : "bg-slate-50 text-slate-400"}`}>
                        {formatCurrency(shop.pendingAmount)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      {getStatusBadge(shop.paymentStatus)}
                    </td>
                    <td className="py-4 px-4 text-slate-600 font-medium">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                        {formatDate(shop.lastPaymentDate)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => onSelectShop && onSelectShop(shop)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-800 hover:text-white active:scale-95"
                        title="View Detailed Shop Revenue Breakdown"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Details</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-white p-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium">
            Showing page {pagination.page || 1} of {pagination.totalPages || 1} ({pagination.total || 0} shops)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => onPageChange(page + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import CustomSelect from "../../Components/CustomSelect.jsx";
import { useState } from "react";
import { Eye, Filter, Store, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Clock } from "lucide-react";
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
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden" id="shop-revenue-table-container">
      {/* Table Header with Search & Filter */}
      <div className="p-5 border-b border-slate-100 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Store className="h-5 w-5 text-[#07564B]" />
            Shop-wise Revenue
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Breakdown of revenue, billing obligations, and collections by registered Gold Shop
          </p>
        </div>

        <div className="flex justify-end">
          {/* Status Filter */}
          <div className="relative">
            <CustomSelect
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              aria-label="Filter shops by payment status"
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:border-[#07564B] focus:outline-none focus:ring-1 focus:ring-[#07564B]"
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
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-left text-xs">
          <thead>
            <tr className="bg-gradient-to-r from-[#07564B] via-[#064A41] to-[#043D37] text-emerald-50 font-bold border-b border-white/10 uppercase tracking-wider">
              <th className="rounded-tl-xl bg-gradient-to-r from-[#07564B] to-[#064A41] py-3 px-4 w-12 text-center">S.No</th>
              <th className="py-3 px-4">Shop Name</th>
              <th className="py-3 px-4">Shop ID</th>
              <th className="py-3 px-4">Subscription Plan</th>
              <th className="py-3 px-4 text-right">Total Amount</th>
              <th className="py-3 px-4 text-right">Paid Amount</th>
              <th className="py-3 px-4 text-right">Pending Amount</th>
              <th className="py-3 px-4 text-center">Payment Status</th>
              <th className="py-3 px-4">Last Payment Date</th>
              <th className="rounded-tr-xl bg-gradient-to-r from-[#064A41] to-[#043D37] py-3 px-4 text-center">Action</th>
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
              shops.map((shop, idx) => (
                <tr key={shop.shopId || idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 text-center font-semibold text-slate-500">
                    {shop.sNo || idx + 1}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{shop.shopName}</div>
                    <div className="text-[11px] text-slate-500 font-normal">
                      {shop.ownerName} {shop.city ? `• ${shop.city}` : ""}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                      {shop.shopCode}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-800">{shop.planName}</div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {shop.subscriptionDuration}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-sans">
                    {formatCurrency(shop.totalAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-emerald-700 font-sans">
                    {formatCurrency(shop.paidAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold font-sans">
                    <span className={shop.pendingAmount > 0 ? "text-amber-700" : "text-slate-400"}>
                      {formatCurrency(shop.pendingAmount)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {getStatusBadge(shop.paymentStatus)}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium">
                    {formatDate(shop.lastPaymentDate)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => onSelectShop && onSelectShop(shop)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-[#07564B] hover:text-white hover:border-[#07564B] active:scale-95"
                      title="View Detailed Shop Revenue Breakdown"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Details</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && pagination.totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing page {pagination.page || 1} of {pagination.totalPages || 1} ({pagination.total || 0} shops)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => onPageChange(page + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

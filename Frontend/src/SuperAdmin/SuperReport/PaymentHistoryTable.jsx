import CustomSelect from "../../Components/CustomSelect.jsx";
import { useState } from "react";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RotateCcw,
  Copy,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  Check
} from "lucide-react";
import { toast } from "react-hot-toast";
import { formatCurrency } from "../../utils/currency";

export default function PaymentHistoryTable({
  payments = [],
  pagination = {},
  loading = false,
  status = "all",
  onStatusChange,
  method = "all",
  onMethodChange,
  page = 1,
  onPageChange,
  onSelectPayment
}) {
  const [copiedId, setCopiedId] = useState(null);

  const copyToClipboard = (text, id) => {
    if (!text || text === "PENDING") return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Transaction ID copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (paymentStatus) => {
    switch (paymentStatus) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Paid
          </span>
        );
      case "pending":
      case "unpaid":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
            <AlertCircle className="h-3 w-3" /> Pending
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-800 border border-rose-200">
            <XCircle className="h-3 w-3" /> Failed
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-800 border border-purple-200">
            <RotateCcw className="h-3 w-3" /> Refunded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {paymentStatus}
          </span>
        );
    }
  };

  const formatDate = (val) => {
    if (!val) return "—";
    return new Date(val).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden" id="payment-history-table-container">
      {/* Header with Search and Filters */}
      <div className="p-5 border-b border-slate-100 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#07564B]" />
            Payment History & Transactions
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete transaction ledger for subscription activations, renewals, and invoice payments
          </p>
        </div>

        <div className="flex justify-end">
          {/* Status Filter */}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <CustomSelect
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              aria-label="Filter transactions by payment status"
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:border-[#07564B] focus:outline-none focus:ring-1 focus:ring-[#07564B]"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </CustomSelect>

            {/* Payment Method Filter */}
            <CustomSelect
              value={method}
              onChange={(e) => onMethodChange && onMethodChange(e.target.value)}
              aria-label="Filter transactions by payment method"
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:border-[#07564B] focus:outline-none focus:ring-1 focus:ring-[#07564B]"
            >
              <option value="all">All Methods</option>
              <option value="UPI">UPI</option>
              <option value="Net Banking">Net Banking</option>
              <option value="Card">Credit / Debit Card</option>
              <option value="Cash">Cash / Offline</option>
            </CustomSelect>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-left text-xs">
          <thead>
            <tr className="bg-gradient-to-r from-[#07564B] via-[#064A41] to-[#043D37] text-emerald-50 font-bold border-b border-white/10 uppercase tracking-wider">
              <th className="rounded-tl-xl bg-gradient-to-r from-[#07564B] to-[#064A41] py-3 px-4">Transaction ID</th>
              <th className="py-3 px-4">Invoice Number</th>
              <th className="py-3 px-4">Shop Name</th>
              <th className="py-3 px-4">Plan Name</th>
              <th className="py-3 px-4">Payment Date</th>
              <th className="py-3 px-4 text-center">Payment Method</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-center">Payment Status</th>
              <th className="rounded-tr-xl bg-gradient-to-r from-[#064A41] to-[#043D37] py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={9} className="py-4 px-4">
                    <div className="h-4 bg-slate-100 rounded w-full" />
                  </td>
                </tr>
              ))
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <FileText className="h-10 w-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                  <p className="text-sm font-semibold text-slate-600">No payment records found</p>
                  <p className="text-xs text-slate-400 mt-1">Try resetting the filters or search keywords</p>
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Transaction ID */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-semibold text-slate-800">
                        {p.transactionId}
                      </span>
                      {p.transactionId !== "PENDING" && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(p.transactionId, p.id)}
                          className="text-slate-400 hover:text-slate-700 transition"
                          title="Copy Transaction ID"
                        >
                          {copiedId === p.id ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Invoice Number */}
                  <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-emerald-800">
                    <span className="inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      <FileText className="h-3 w-3 text-[#07564B]" />
                      {p.invoiceNumber}
                    </span>
                  </td>

                  {/* Shop Name */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{p.shopName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{p.shopCode}</div>
                  </td>

                  {/* Plan Name */}
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                    {p.planName}
                  </td>

                  {/* Payment Date */}
                  <td className="py-3.5 px-4 text-slate-600 font-medium">
                    {formatDate(p.paymentDate)}
                  </td>

                  {/* Payment Method */}
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 text-[11px]">
                      <CreditCard className="h-3 w-3 text-slate-500" />
                      {p.paymentMethod || "N/A"}
                    </span>
                  </td>

                  {/* Amount */}
                  <td className="py-3.5 px-4 text-right font-black text-slate-900 font-sans text-sm">
                    {formatCurrency(p.amount)}
                    {p.refundAmount > 0 && (
                      <div className="text-[10px] text-purple-600 font-semibold">
                        Refunded: {formatCurrency(p.refundAmount)}
                      </div>
                    )}
                  </td>

                  {/* Payment Status */}
                  <td className="py-3.5 px-4 text-center">
                    {getStatusBadge(p.paymentStatus)}
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => onSelectPayment && onSelectPayment(p)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-[#07564B] hover:text-white hover:border-[#07564B] active:scale-95"
                      title="View Transaction Invoice"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Invoice</span>
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
            Showing page {pagination.page || 1} of {pagination.totalPages || 1} ({pagination.total || 0} transactions)
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

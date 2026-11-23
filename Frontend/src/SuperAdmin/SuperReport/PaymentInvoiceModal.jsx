import { useEffect, useState } from "react";
import {
  X,
  FileText,
  Printer,
  CheckCircle2,
  Clock,
  RotateCcw,
  Store,
  CreditCard,
  ShieldCheck
} from "lucide-react";
import api from "../../api";
import { toast } from "react-hot-toast";
import { formatCurrency } from "../../utils/currency";
import { printElement } from "./exportUtils";

export default function PaymentInvoiceModal({ paymentId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!paymentId) return;
    let isMounted = true;
    setLoading(true);

    api
      .get(`/super-admin/revenue-reports/payments/${paymentId}/details`)
      .then((res) => {
        if (isMounted) setData(res.data.data);
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to load payment invoice");
        onClose();
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [paymentId, onClose]);

  if (!paymentId) return null;

  const formatDate = (val) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  const p = data || {};
  const shop = p.shop || {};
  const sub = p.subscription || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col">
        {/* Modal Controls */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
              {p.invoiceNumber || "INVOICE"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => printElement("printable-invoice-card", `Invoice - ${p.invoiceNumber}`)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <Printer className="h-4 w-4" />
              <span>Print Invoice</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Document */}
        <div className="p-8 space-y-6 flex-1" id="printable-invoice-card">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#07564B] border-t-transparent" />
              <p className="text-sm font-semibold text-slate-500">Loading invoice details...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                <div>
                  <h1 className="text-2xl font-black text-[#07564B] tracking-tight">
                    TAX INVOICE / RECEIPT
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">Sri Golds SaaS Platform Subscription</p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    GSTIN: 33AAECQ1234F1Z5 • Support: admin@srigolds.com
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-slate-900 text-sm">
                    {p.invoiceNumber}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Date: <strong className="text-slate-700">{formatDate(p.paymentDate)}</strong>
                  </div>
                  <div className="mt-2">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                        p.paymentStatus === "paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : p.paymentStatus === "pending"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {p.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Billed To Details */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    Billed To (Customer)
                  </span>
                  <p className="font-bold text-slate-900 text-sm mt-1">{shop.name}</p>
                  <p className="text-slate-600 mt-0.5 font-mono">ID: {shop.code}</p>
                  <p className="text-slate-600 mt-0.5">Contact: {shop.owner} ({shop.mobile})</p>
                  <p className="text-slate-600 mt-0.5">Email: {shop.email || "N/A"}</p>
                  {shop.gst && <p className="text-slate-600 mt-0.5 font-mono">GST: {shop.gst}</p>}
                  {shop.address && <p className="text-slate-600 mt-0.5">{shop.address}, {shop.city}</p>}
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    Transaction & Payment Details
                  </span>
                  <p className="text-slate-600 mt-1">
                    Transaction ID: <strong className="font-mono text-slate-900">{p.transactionId}</strong>
                  </p>
                  <p className="text-slate-600 mt-1">
                    Payment Method: <strong className="text-slate-900">{p.paymentMethod}</strong>
                  </p>
                  <p className="text-slate-600 mt-1">
                    Plan: <strong className="text-slate-900">{sub.planName}</strong> ({sub.duration})
                  </p>
                  <p className="text-slate-600 mt-1">
                    Validity: {formatDate(sub.startDate)} to {formatDate(sub.endDate)}
                  </p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Billing Cycle</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{sub.planName} Subscription</div>
                        <div className="text-[11px] text-slate-500">
                          Gold Shop SaaS management access ({formatDate(sub.startDate)} - {formatDate(sub.endDate)})
                        </div>
                      </td>
                      <td className="py-3 px-3 capitalize text-slate-700 font-medium">
                        {sub.duration}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 font-sans">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50/50">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3 text-right font-semibold text-slate-600">
                        Subtotal:
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-sans">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                    {p.refundAmount > 0 && (
                      <tr>
                        <td colSpan={2} className="py-2 px-3 text-right font-semibold text-purple-700">
                          Refund Processed:
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-purple-700 font-sans">
                          - {formatCurrency(p.refundAmount)}
                        </td>
                      </tr>
                    )}
                    <tr className="border-t border-slate-300">
                      <td colSpan={2} className="py-3 px-3 text-right font-black text-slate-900 text-sm">
                        Net Paid Amount:
                      </td>
                      <td className="py-3 px-3 text-right font-black text-emerald-800 text-sm font-sans">
                        {formatCurrency(p.netAmount ?? p.amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Footer Note */}
              <div className="text-center text-[11px] text-slate-400 border-t border-slate-100 pt-4">
                This is a computer-generated invoice from Sri Golds Super Admin platform. No physical signature required.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

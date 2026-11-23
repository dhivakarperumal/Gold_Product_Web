import { useEffect, useState } from "react";
import {
  X,
  Store,
  CreditCard,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  ShieldCheck,
  Mail,
  Phone,
  MapPin
} from "lucide-react";
import api from "../../api";
import { toast } from "react-hot-toast";
import { formatCurrency } from "../../utils/currency";
import { printElement } from "./exportUtils";

export default function ShopRevenueModal({ shopId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) return;
    let isMounted = true;
    setLoading(true);

    api
      .get(`/super-admin/revenue-reports/shops/${shopId}/details`)
      .then((res) => {
        if (isMounted) setData(res.data.data);
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to load shop details");
        onClose();
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [shopId, onClose]);

  if (!shopId) return null;

  const formatDate = (val) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  const shop = data?.shop || {};
  const subs = data?.subscriptions || [];
  const payments = data?.payments || [];
  const fin = data?.financialSummary || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-[#07564B]">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {shop.shop_name || "Gold Shop Revenue Details"}
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                {shop.shop_code} • {shop.city || "Tamil Nadu"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => printElement("printable-shop-report", `${shop.shop_name} - Revenue Statement`)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <Printer className="h-4 w-4" />
              <span>Print Statement</span>
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

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1" id="printable-shop-report">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#07564B] border-t-transparent" />
              <p className="text-sm font-semibold text-slate-500">Loading shop financials...</p>
            </div>
          ) : (
            <>
              {/* Financial Balance Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Invoiced</span>
                  <p className="mt-1 text-lg font-black text-slate-900 font-sans">
                    {formatCurrency(fin.totalInvoiced)}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <span className="text-[11px] font-semibold text-emerald-800 uppercase">Total Paid</span>
                  <p className="mt-1 text-lg font-black text-emerald-800 font-sans">
                    {formatCurrency(fin.totalPaid)}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                  <span className="text-[11px] font-semibold text-amber-800 uppercase">Pending Balance</span>
                  <p className="mt-1 text-lg font-black text-amber-800 font-sans">
                    {formatCurrency(fin.pendingBalance)}
                  </p>
                </div>
                <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-4">
                  <span className="text-[11px] font-semibold text-purple-800 uppercase">Refunds</span>
                  <p className="mt-1 text-lg font-black text-purple-800 font-sans">
                    {formatCurrency(fin.totalRefunded)}
                  </p>
                </div>
              </div>

              {/* Shop & Owner Information */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Shop Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">Owner Name</span>
                    <p className="font-bold text-slate-800 mt-0.5">{shop.owner_name || "—"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Contact Number</span>
                    <p className="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                      <Phone className="h-3 w-3 text-slate-400" />
                      {shop.mobile || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Email Address</span>
                    <p className="font-bold text-slate-800 mt-0.5 flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3 text-slate-400" />
                      {shop.email || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">GST Registration</span>
                    <p className="font-mono font-bold text-slate-800 mt-0.5">
                      {shop.gst_number || "Not Registered"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400">Address</span>
                    <p className="font-medium text-slate-700 mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      {shop.address ? `${shop.address}, ${shop.city || ""}, ${shop.state || ""}` : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Subscriptions History */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Subscription Plans ({subs.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                        <th className="py-2.5 px-3">Plan Name</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Start Date</th>
                        <th className="py-2.5 px-3">End Date</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subs.map((s) => (
                        <tr key={s.id}>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{s.plan_name}</td>
                          <td className="py-2.5 px-3 capitalize text-slate-600">{s.duration}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-sans">
                            {formatCurrency(s.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{formatDate(s.start_date)}</td>
                          <td className="py-2.5 px-3 text-slate-600">{formatDate(s.end_date)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                s.subscription_status === "active"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : s.subscription_status === "pending"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {s.subscription_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Transactions Ledger */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Payment Transactions Ledger ({payments.length})
                </h3>
                {payments.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No payment transactions recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                          <th className="py-2.5 px-3">Transaction ID</th>
                          <th className="py-2.5 px-3">Invoice No</th>
                          <th className="py-2.5 px-3">Method</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                          <th className="py-2.5 px-3">Payment Date</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payments.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-800">
                              {p.transaction_id || "PENDING"}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-emerald-800">
                              {p.invoice_number || `INV-${p.id}`}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">{p.payment_method || "N/A"}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-sans">
                              {formatCurrency(p.amount)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {formatDate(p.payment_date || p.created_at)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  p.payment_status === "paid"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : p.payment_status === "pending"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {p.payment_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

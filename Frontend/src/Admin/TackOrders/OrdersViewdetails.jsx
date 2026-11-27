import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, FileText, UserRound, Wallet } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api";
import { formatCurrency } from "../../utils/currency";

function parseCustomer(value) {
  const customer = typeof value === "string" ? JSON.parse(value) : value;
  if (!customer || typeof customer !== "object" || Array.isArray(customer)) {
    throw new TypeError("This order contains invalid customer details.");
  }
  return customer;
}

function parseItems(value) {
  const items = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(items)) {
    throw new TypeError("This order contains an invalid products list.");
  }
  return items;
}

function formatDateTime(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function StatusBadge({ label, value }) {
  const status = String(value || "Pending");
  const normalized = status.toLowerCase();
  const color = ["paid", "completed"].includes(normalized)
    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
    : ["partial", "ready", "confirmed"].includes(normalized)
      ? "bg-amber-50 text-amber-800 ring-amber-200"
      : "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <span className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${color}`}>
        {status}
      </span>
    </div>
  );
}

function DetailCard({ title, icon: Icon, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon size={17} className="text-emerald-700" aria-hidden="true" />
        <h2 className="text-sm font-extrabold text-slate-800">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-slate-800">{value || "—"}</dd>
    </div>
  );
}

export default function OrdersViewdetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState({ orderId: null, order: null, loading: true, error: "" });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.get(`/tack-orders/${id}`, { signal: controller.signal })
      .then(({ data }) => {
        if (!data || !data.id) throw new TypeError("The server returned invalid order details.");
        if (!controller.signal.aborted) {
          setDetails({
            orderId: id,
            order: {
              ...data,
              customer: parseCustomer(data.customer),
              items: parseItems(data.items)
            },
            loading: false,
            error: ""
          });
        }
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load tack order details:", loadError);
        setDetails({
          orderId: id,
          order: null,
          loading: false,
          error: loadError.response?.data?.message || loadError.message || "Could not load this order."
        });
      });

    return () => controller.abort();
  }, [id, retryCount]);

  const loading = details.orderId !== id || details.loading;
  const error = details.orderId === id ? details.error : "";
  const order = details.orderId === id ? details.order : null;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4" role="status" aria-label="Loading order details">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-52 animate-pulse rounded-2xl bg-white" />
        <div className="h-72 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm" role="alert">
        <h1 className="text-lg font-black text-rose-800">Unable to load order details</h1>
        <p className="mt-2 text-sm text-slate-600">{error || "Order not found."}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="rounded-lg bg-[#00695C] px-4 py-2 text-sm font-bold text-white hover:bg-[#00574d]">
            Try again
          </button>
          <button type="button" onClick={() => navigate("/admin/tackAllOrders")} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Back to orders
          </button>
        </div>
      </section>
    );
  }

  const customer = order.customer;
  const address = [
    customer.address,
    [customer.city, customer.district, customer.state, customer.pincode].filter(Boolean).join(", ")
  ].filter(Boolean).join(", ");
  const total = Number(order.total_amount || 0);
  const paid = Number.isFinite(Number(order.paid_amount))
    ? Number(order.paid_amount)
    : Number(order.advance_amount || 0);
  const balance = Number.isFinite(Number(order.balance_due))
    ? Number(order.balance_due)
    : Math.max(0, total - paid);
  const discountDescription = order.discount_type === "Percent"
    ? `${Number(order.discount_value || 0)}%`
    : formatCurrency(order.discount_value || 0);

  return (
    <main className="mx-auto max-w-6xl space-y-5 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#063f36] via-[#075348] to-[#0b6b5b] px-5 py-5 text-white shadow-sm sm:px-7">
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => navigate("/admin/tackAllOrders")} aria-label="Back to all tack orders" className="mt-0.5 rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-200">Tack order details</p>
            <h1 className="mt-1 break-all text-xl font-black tracking-tight sm:text-2xl">{order.order_no}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
              <CalendarDays size={14} aria-hidden="true" /> {formatDateTime(order.created_at)}
            </p>
          </div>
        </div>
        {order.order_status === "Ready" && (
          <button type="button" onClick={() => navigate("/admin/billings", { state: { tackOrderToBill: order } })} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#075348] shadow-sm transition hover:bg-emerald-50">
            <FileText size={16} aria-hidden="true" /> Create bill
          </button>
        )}
      </header>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5">
        <StatusBadge label="Order status" value={order.order_status} />
        <StatusBadge label="Payment status" value={order.payment_status} />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div className="space-y-4">
          <DetailCard title="Customer information" icon={UserRound}>
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Name" value={customer.name} />
              <DetailRow label="Phone" value={customer.phone} />
              <DetailRow label="Email" value={customer.email} />
              <DetailRow label="Address" value={address} />
            </dl>
          </DetailCard>

          <DetailCard title={`Products (${order.items.length})`} icon={FileText}>
            {order.items.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-2 py-3">Product</th>
                      <th className="px-2 py-3">Options</th>
                      <th className="px-2 py-3 text-right">Qty</th>
                      <th className="px-2 py-3 text-right">Unit price</th>
                      <th className="px-2 py-3 text-right">Line total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.items.map((item, index) => {
                      const quantity = Number(item.quantity || 0);
                      const price = item.price == null || item.price === ""
                        ? Number(item.total_price || 0) / (quantity || 1)
                        : Number(item.price);
                      const options = [
                        item.category,
                        item.metal_type,
                        item.purity,
                        item.variant_color,
                        item.variant_size,
                        item.net_gold_weight ? `${item.net_gold_weight} g` : ""
                      ].filter(Boolean).join(" · ");
                      return (
                        <tr key={`${item.product_id || "product"}-${index}`} className="align-top">
                          <td className="px-2 py-3">
                            <p className="font-bold text-slate-800">{item.product_name || "Unnamed product"}</p>
                            <p className="mt-0.5 text-xs text-slate-500">Product ID: {item.product_id || "—"}</p>
                          </td>
                          <td className="px-2 py-3 text-xs leading-5 text-slate-600">{options || "—"}</td>
                          <td className="px-2 py-3 text-right font-semibold text-slate-700">{quantity}</td>
                          <td className="px-2 py-3 text-right text-slate-700">{Number.isFinite(price) ? formatCurrency(price) : "—"}</td>
                          <td className="px-2 py-3 text-right font-bold text-slate-800">{formatCurrency(item.total_price || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No products were recorded for this order.</p>
            )}
          </DetailCard>
        </div>

        <div className="space-y-4">
          <DetailCard title="Order summary" icon={Wallet}>
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Subtotal" value={formatCurrency(order.sub_total || 0)} />
              <DetailRow label={`GST${order.gst_included ? ` (${Number(order.gst_rate || 0)}%)` : ""}`} value={formatCurrency(order.gst_amount || 0)} />
              <DetailRow label={`Discount (${discountDescription})`} value={`−${formatCurrency(order.discount_amount || 0)}`} />
              <DetailRow label="Advance received" value={formatCurrency(order.advance_amount || 0)} />
              <DetailRow label="Paid to date" value={formatCurrency(paid)} />
              <DetailRow label="Balance due" value={formatCurrency(balance)} />
              <div className="flex items-start justify-between gap-4 pt-3 text-base">
                <dt className="font-extrabold text-slate-800">Order total</dt>
                <dd className="font-black text-emerald-800">{formatCurrency(total)}</dd>
              </div>
            </dl>
          </DetailCard>
          <DetailCard title="Order reference" icon={CalendarDays}>
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Order number" value={order.order_no} />
              <DetailRow label="Order ID" value={order.id} />
              <DetailRow label="Created" value={formatDateTime(order.created_at)} />
              <DetailRow label="GST" value={order.gst_included ? "Applied to order" : "Not applied"} />
            </dl>
          </DetailCard>
        </div>
      </div>
    </main>
  );
}
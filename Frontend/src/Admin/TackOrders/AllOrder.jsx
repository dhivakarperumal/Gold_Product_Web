import CustomSelect from "../../Components/CustomSelect.jsx";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBox, FiCalendar, FiChevronRight, FiFileText, FiGrid, FiList, FiMapPin, FiPhone, FiPlus, FiSearch, FiUser, FiUsers } from "react-icons/fi";
import { FaCoins, FaGem, FaRupeeSign } from "react-icons/fa";
import { toast } from "react-hot-toast";
import api from "../../api";
import { formatCurrency } from "../../utils/currency";
import DateRangeFilter from "../Components/DateRangeFilter";
import { resolveDatePreset } from "../Components/dateRange";

const SUMMARY_CARDS = [
  {
    id: "total_customers",
    label: "Total Customers",
    icon: <FiUsers />,
    iconStyle: { backgroundColor: "#006D50", color: "#FFFFFF" },
    cardStyle: { backgroundColor: "#123B32", borderColor: "#2C6A55" },
    chartColor: "#6EE7B7",
    destination: "/admin/loans/customermanagement"
  },
  {
    id: "active_gold_loans",
    label: "Active Gold Loans",
    icon: <FaCoins />,
    iconStyle: { background: "linear-gradient(145deg, #F7C84B, #B87500)", color: "#FFFFFF" },
    cardStyle: { backgroundColor: "#3D3019", borderColor: "#8B6D2E" },
    chartColor: "#FCD36B",
    destination: "/admin/loans/allloans"
  },
  {
    id: "today_collection",
    label: "Today's Collection",
    icon: <FaRupeeSign />,
    iconStyle: { backgroundColor: "#006D50", color: "#FFFFFF" },
    cardStyle: { backgroundColor: "#14324A", borderColor: "#35719A" },
    chartColor: "#7DD3FC",
    destination: "/admin/loans/allloans"
  },
  {
    id: "gold_stock_value",
    label: "Gold Stock Value",
    icon: <FaGem />,
    iconStyle: { background: "linear-gradient(145deg, #F7C84B, #B87500)", color: "#FFFFFF" },
    cardStyle: { backgroundColor: "#482A24", borderColor: "#9A533D" },
    chartColor: "#FDBA9A",
    destination: "/admin/products/stock"
  }
];

const MANUAL_ORDER_STATUSES = ["Order Placed", "Confirmed", "Ready", "Billing Pending"];
const ORDER_STATUS_FILTERS = [...MANUAL_ORDER_STATUSES, "Completed"];

function getOrderStatus(order) {
  return order.order_status === "Bill Completed" ? "Completed" : order.order_status || "Order Placed";
}

function parseCustomer(value) {
  const customer = typeof value === "string" ? JSON.parse(value) : value;
  if (!customer || typeof customer !== "object" || Array.isArray(customer)) {
    throw new TypeError("An order contains invalid customer details.");
  }
  return customer;
}

function parseItems(value) {
  const items = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(items)) {
    throw new TypeError("An order contains an invalid products list.");
  }
  return items;
}

function formatOrderDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function formatWeight(value) {
  const weight = Number(value);
  return value == null || value === "" || !Number.isFinite(weight)
    ? ""
    : `${weight.toLocaleString("en-IN", { maximumFractionDigits: 3 })} g`;
}

function getOrderDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function getPaymentStatus(order) {
  if (order.payment_status === "Paid") return "PAID";
  if (order.payment_status === "Partial") return "PARTIAL";
  const balance = Number(order.balance_due);
  if (Number.isFinite(balance) && balance <= 0) return "PAID";
  const total = Number(order.total_amount);
  if (Number.isFinite(balance) && Number.isFinite(total) && balance < total) return "PARTIAL";
  return Number(order.advance_amount) > 0 ? "PARTIAL" : "UNPAID";
}

export default function AllTackOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [dashboardStats, setDashboardStats] = useState([]);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState(() => resolveDatePreset("today"));
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [orderStatusFilter, setOrderStatusFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState("list");
  const [retryCount, setRetryCount] = useState(0);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const updateOrderStatus = async (orderId, orderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const { data } = await api.patch(`/tack-orders/${orderId}/status`, { order_status: orderStatus });
      setOrders((currentOrders) => currentOrders.map((order) => (
        order.id === orderId ? { ...order, order_status: data.order_status } : order
      )));
      toast.success(`Order status changed to ${data.order_status}.`);
    } catch (statusError) {
      console.error("Failed to update tack order status:", statusError);
      toast.error(statusError.response?.data?.message || statusError.message || "Could not update order status.");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  useEffect(() => {
    let active = true;
    const loadDashboardStats = async () => {
      setMetricsLoading(true);
      setMetricsError(false);
      try {
        const { data } = await api.get("/dashboard", { params: { datePreset: "all" } });
        if (!Array.isArray(data?.stats)) {
          throw new TypeError("The server returned invalid dashboard metrics.");
        }
        if (active) setDashboardStats(data.stats);
      } catch (loadError) {
        console.error("Failed to load dashboard summary cards:", loadError);
        if (active) {
          setDashboardStats([]);
          setMetricsError(true);
        }
      } finally {
        if (active) setMetricsLoading(false);
      }
    };

    void loadDashboardStats();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadOrders = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/tack-orders");
        if (!Array.isArray(data)) throw new TypeError("The server returned an invalid tack-orders list.");
        const parsedOrders = data.map((order) => ({
          ...order,
          customer: parseCustomer(order.customer),
          items: parseItems(order.items)
        }));
        if (active) setOrders(parsedOrders);
      } catch (loadError) {
        console.error("Failed to load tack orders:", loadError);
        if (active) {
          const message = loadError.response?.data?.message || loadError.message || "Could not load tack orders.";
          setError(message);
          setOrders([]);
          toast.error(message);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    window.addEventListener("focus", loadOrders);
    void loadOrders();
    return () => {
      active = false;
      window.removeEventListener("focus", loadOrders);
    };
  }, [retryCount]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (orderStatusFilter !== "ALL" && getOrderStatus(order) !== orderStatusFilter) return false;
      if (paymentFilter !== "ALL" && getPaymentStatus(order) !== paymentFilter) return false;
      const orderDate = getOrderDateKey(order.created_at);
      if (dateRange.startDate && (!orderDate || orderDate < dateRange.startDate)) return false;
      if (dateRange.endDate && (!orderDate || orderDate > dateRange.endDate)) return false;
      if (!query) return true;
      return [
        order.order_no,
        order.customer.name,
        order.customer.phone,
        order.customer.city,
        order.customer.district,
        order.customer.state,
        ...order.items.map((item) => item.product_name)
      ].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [orders, search, dateRange, paymentFilter, orderStatusFilter]);

  return (
    <section className="min-h-full p-2 sm:p-2">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 grid grid-cols-1 gap-x-2 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
          {SUMMARY_CARDS.map((card) => {
            const stat = dashboardStats.find((item) => item.id === card.id);
            const value = stat?.value ?? (metricsLoading ? "Loading..." : metricsError ? "Unavailable" : "—");
            const trend = stat?.trend || (metricsError ? "Live metric unavailable" : "Dashboard metric");

            return (
              <article
                key={card.id}
                style={card.cardStyle}
                className="relative flex h-40 min-w-0 items-center gap-3 overflow-hidden rounded-xl border-l-4 border-y border-r p-3 shadow-[0_3px_12px_rgba(30,41,59,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div style={card.iconStyle} className="z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl shadow-md">
                  {card.icon}
                </div>
                <div className="relative z-10 min-w-0 self-center">
                  <p className="truncate text-[11px] font-semibold text-slate-200">{card.label}</p>
                  <p className="mt-1 truncate text-[19px] font-black leading-none tracking-tight text-white">
                    {card.id === "gold_stock_value" && Number.isFinite(Number(value))
                      ? formatCurrency(value)
                      : value}
                  </p>
                  <div className={`mt-2 flex items-center gap-1 text-[11px] font-extrabold ${
                    card.id === "today_collection" ? "text-amber-300" : metricsError ? "text-rose-300" : "text-emerald-300"
                  }`}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                    <span className="truncate">{trend}</span>
                  </div>
                  <p className="mt-0.5 text-[9px] font-medium text-slate-300">
                    {metricsLoading ? "Loading live API data..." : "Shared dashboard metric"}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`View ${card.label}`}
                  onClick={() => navigate(card.destination)}
                  className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-black/5 bg-white/65 text-[10px] text-slate-700 transition hover:bg-white"
                >
                  <FiChevronRight aria-hidden="true" />
                </button>
                <div style={{ color: card.chartColor }} className="absolute bottom-3 right-3 flex h-7 items-end gap-[3px]">
                  {[11, 17, 13, 23].map((height, index) => (
                    <span key={index} className="w-[4px] rounded-t-sm bg-current" style={{ height: `${height}px` }} />
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <section aria-label="Search and filter tack orders" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <label className="relative min-w-[220px] flex-1 sm:max-w-[480px]">
            <FiSearch aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search orders, customers, phone..."
              aria-label="Search tack orders"
              className="h-[52px] w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#00695C] focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            <DateRangeFilter
              onApply={setDateRange}
              initialPreset="today"
              showActiveRangeDetails={false}
              controlClassName="min-h-[52px] min-w-[170px] px-4"
            />
            <CustomSelect
              value={orderStatusFilter}
              onChange={(event) => setOrderStatusFilter(event.target.value)}
              aria-label="Filter tack orders by order status"
              className="h-[52px] min-w-[170px] rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm font-semibold text-slate-600 outline-none focus:border-[#00695C] focus:ring-2 focus:ring-emerald-100"
            >
              <option value="ALL">All Order Statuses</option>
              {ORDER_STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </CustomSelect>
            <CustomSelect
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value)}
              aria-label="Filter tack orders by payment status"
              className="h-[52px] min-w-[170px] rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm font-semibold text-slate-600 outline-none focus:border-[#00695C] focus:ring-2 focus:ring-emerald-100"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PARTIAL">Partially Paid</option>
              <option value="UNPAID">Unpaid</option>
            </CustomSelect>
            <div role="group" aria-label="Tack order view" className="flex h-[52px] items-center rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="Show tack orders as a list"
                aria-pressed={viewMode === "list"}
                className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${viewMode === "list" ? "bg-[#004D40] text-white shadow-sm" : "text-slate-500 hover:bg-white"}`}
              >
                <FiList size={19} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Show tack orders as cards"
                aria-pressed={viewMode === "grid"}
                className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${viewMode === "grid" ? "bg-[#004D40] text-white shadow-sm" : "text-slate-500 hover:bg-white"}`}
              >
                <FiGrid size={18} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigate("/admin/tack-orders")}
              className="inline-flex h-[52px] items-center gap-2 rounded-xl bg-[#004D40] px-5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(0,77,64,0.2)] transition hover:bg-[#00695C]"
            >
              <FiPlus size={18} /> New Tack Order
            </button>
          </div>
        </section>

        {error ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            <p className="font-semibold">{error}</p>
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="mt-3 font-bold underline"
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-48 animate-pulse rounded-2xl border border-orange-100 bg-white" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-orange-200 bg-white px-6 py-16 text-center">
            <FiBox className="mx-auto h-10 w-10 text-orange-300" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-bold text-slate-800">
              {orders.length ? "No tack orders match your filters" : "No tack orders yet"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {orders.length ? "Adjust your search or filters to see more orders." : "Orders you create will appear here."}
            </p>
          </div>
        ) : (
          <div className={viewMode === "list" ? "space-y-4" : "grid grid-cols-1 gap-4 xl:grid-cols-2"}>
            {filteredOrders.map((order) => {
              const customer = order.customer;
              const location = [customer.city, customer.district, customer.state, customer.pincode]
                .filter(Boolean)
                .join(", ");
              const itemCount = order.items.reduce((total, item) => total + Number(item.quantity || 0), 0);
              const orderStatus = order.order_status || "Order Placed";
              const paymentStatus = order.payment_status || "Pending";
              const paidAmount = Number.isFinite(Number(order.paid_amount))
                ? Number(order.paid_amount)
                : Math.max(0, Number(order.total_amount) - Number(order.balance_due));

              return (
                <article key={order.id} className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-white px-5 py-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Tack order</p>
                      <h2 className="mt-0.5 text-lg font-black text-slate-800">{order.order_no}</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CustomSelect
                        aria-label={`Order status for ${order.order_no}`}
                        value={orderStatus}
                        onChange={(event) => void updateOrderStatus(order.id, event.target.value)}
                        disabled={orderStatus === "Completed" || orderStatus === "Bill Completed" || updatingOrderId === order.id}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70 ${
                          orderStatus === "Completed" || orderStatus === "Bill Completed"
                            ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {!MANUAL_ORDER_STATUSES.includes(orderStatus) && orderStatus !== "Completed" && orderStatus !== "Bill Completed" && (
                          <option value={orderStatus}>{orderStatus}</option>
                        )}
                        {MANUAL_ORDER_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                        <option value="Completed" disabled={orderStatus !== "Completed" && orderStatus !== "Bill Completed"}>
                          Completed (automatic)
                        </option>
                      </CustomSelect>
                      <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                        paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        Payment: {paymentStatus}
                      </span>
                      <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">
                        <FiCalendar aria-hidden="true" />
                        {formatOrderDate(order.created_at)}
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate("/admin/billings", { state: { tackOrderToBill: order } })}
                        aria-label={`Create a bill from tack order ${order.order_no}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#00695C] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#008577]"
                      >
                        <FiFileText aria-hidden="true" />
                        Bill
                      </button>
                    </div>
                  </header>

                  <div className={`grid gap-5 p-5 ${viewMode === "list" ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_220px]" : "grid-cols-1"}`}>
                    <section>
                      <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-400">Customer</h3>
                      <p className="flex items-center gap-2 font-bold text-slate-800">
                        <FiUser className="shrink-0 text-orange-500" aria-hidden="true" />
                        {customer.name}
                      </p>
                      <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                        <FiPhone className="shrink-0 text-slate-400" aria-hidden="true" />
                        {customer.phone}
                      </p>
                      {customer.email && <p className="mt-2 break-all text-sm text-slate-600">{customer.email}</p>}
                      {(location || customer.address) && (
                        <p className="mt-2 flex items-start gap-2 text-sm text-slate-600">
                          <FiMapPin className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                          <span>{[customer.address, location].filter(Boolean).join(", ")}</span>
                        </p>
                      )}
                    </section>

                    <section>
                      <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-400">
                        Products · {itemCount} item{itemCount === 1 ? "" : "s"}
                      </h3>
                      <div className="space-y-2">
                        {order.items.map((item, index) => (
                          <div key={`${item.product_id}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-700">{item.product_name}</p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                Qty {item.quantity}
                                {[item.variant_color, item.variant_size].filter(Boolean).length > 0
                                  ? ` · ${[item.variant_color, item.variant_size].filter(Boolean).join(" / ")}`
                                  : ""}
                              </p>
                              {formatWeight(item.net_gold_weight) && (
                                <p className="mt-1 text-xs font-medium text-emerald-700">
                                  Net weight: {formatWeight(item.net_gold_weight)}
                                </p>
                              )}
                            </div>
                            <p className="shrink-0 text-sm font-bold text-slate-700">{formatCurrency(item.total_price)}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-xl bg-[#2c160c] p-4 text-white">
                      <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-orange-200">Payment summary</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-2 text-white/65">
                          <span>Subtotal</span><span>{formatCurrency(order.sub_total)}</span>
                        </div>
                        <div className="flex justify-between gap-2 text-white/65">
                          <span>GST amount</span><span>{formatCurrency(order.gst_amount)}</span>
                        </div>
                        <div className="flex justify-between gap-2 text-white/65">
                          <span>Discount</span><span>-{formatCurrency(order.discount_amount)}</span>
                        </div>
                        <div className="flex justify-between gap-2 text-white/65">
                          <span>Paid amount</span><span>{formatCurrency(paidAmount)}</span>
                        </div>
                        <div className="flex justify-between gap-2 border-t border-white/15 pt-2 font-extrabold text-orange-200">
                          <span>Balance due</span><span>{formatCurrency(order.balance_due)}</span>
                        </div>
                        <div className="flex justify-between gap-2 border-t border-white/15 pt-2 font-black">
                          <span>Total</span><span>{formatCurrency(order.total_amount)}</span>
                        </div>
                      </div>
                    </section>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
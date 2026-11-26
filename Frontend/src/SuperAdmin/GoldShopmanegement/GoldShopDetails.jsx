import CustomSelect from "../../Components/CustomSelect.jsx";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Clock3,
  CreditCard,
  Download,
  FileText,
  History,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Store,
  Wallet,
  X
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../../api";

const TABS = [
  { id: "overview", label: "Shop overview", icon: Store },
  { id: "subscription", label: "Subscriptions", icon: CreditCard },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "activity", label: "Activity history", icon: History }
];

const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  paid: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  inactive: "bg-stone-100 text-stone-700 ring-stone-200",
  unpaid: "bg-rose-50 text-rose-800 ring-rose-200",
  rejected: "bg-rose-50 text-rose-800 ring-rose-200",
  suspended: "bg-rose-50 text-rose-800 ring-rose-200",
  expired: "bg-orange-50 text-orange-800 ring-orange-200"
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value
  );
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatAmount(value) {
  return Number.isFinite(Number(value)) ? `₹${Number(value).toLocaleString("en-IN")}` : "—";
}

function StatusBadge({ value }) {
  const status = String(value || "pending").toLowerCase();
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ring-inset ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
      {status}
    </span>
  );
}

function InfoCard({ label, value, wide = false }) {
  return (
    <div className={`group rounded-2xl border border-stone-200/80 bg-white p-4 transition hover:border-amber-200 hover:shadow-sm ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-400">{label}</dt>
      <dd className="mt-2 break-words whitespace-pre-wrap text-sm font-semibold leading-6 text-stone-800">{value || "—"}</dd>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3 border-b border-stone-100 pb-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
        <Icon size={20} />
      </span>
      <div>
        <h2 className="text-lg font-bold tracking-tight text-stone-900 sm:text-xl">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-stone-500">{description}</p>
      </div>
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50/70 px-5 py-8 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-stone-400 shadow-sm"><FileText size={18} /></span>
      <p className="max-w-sm text-sm leading-6 text-stone-500">{children}</p>
    </div>
  );
}

export default function GoldShopDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState({ shopId: null, shop: null, loading: true, error: "" });
  const [activeTab, setActiveTab] = useState("overview");
  const [retryCount, setRetryCount] = useState(0);
  const [paymentToConfirm, setPaymentToConfirm] = useState(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ transactionId: "", paymentMethod: "upi" });

  useEffect(() => {
    const controller = new AbortController();
    api.get(`/super-admin/gold-shops/${id}`, { signal: controller.signal })
      .then(({ data }) => {
        if (!data?.shop) throw new TypeError("Gold shop details response is invalid");
        setDetails({ shopId: id, shop: data.shop, loading: false, error: "" });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load gold shop details:", error);
        setDetails({
          shopId: id,
          shop: null,
          loading: false,
          error: error.response?.data?.message || "Could not load this gold shop."
        });
      });
    return () => controller.abort();
  }, [id, retryCount]);

  const loading = details.shopId !== id || details.loading;
  const loadError = details.shopId === id ? details.error : "";
  const shop = details.shopId === id ? details.shop : null;

  const downloadDocument = async (document) => {
    try {
      const { data } = await api.get(
        `/super-admin/gold-shops/${id}/documents/${document.id}`,
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(data);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.original_name;
      link.click();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not download this document.");
    }
  };

  const openPaymentConfirmation = (payment) => {
    setPaymentForm({ transactionId: "", paymentMethod: "upi" });
    setPaymentToConfirm(payment);
  };

  const confirmPayment = async (event) => {
    event.preventDefault();
    if (!paymentToConfirm || paymentSubmitting) return;
    setPaymentSubmitting(true);
    try {
      const { data } = await api.post(
        `/super-admin/gold-shops/${id}/payments/${paymentToConfirm.id}/confirm`,
        paymentForm
      );
      if (!data?.shop) throw new TypeError("Payment confirmation response is invalid");
      setDetails((current) => ({ ...current, shop: data.shop }));
      setPaymentToConfirm(null);
      toast.success(data.message || "Subscription payment confirmed.");
    } catch (error) {
      console.error("Failed to confirm subscription payment:", error);
      toast.error(error.response?.data?.message || "Could not confirm this subscription payment.");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const approvalStatus = shop?.approval_status || (shop?.approved_at ? "approved" : "pending");
  const currentPayment = shop?.payments?.find(
    (payment) => Number(payment.subscription_id) === Number(shop.current_subscription_id)
  );

  return (
    <main className="mx-auto w-full max-w-[1480px] space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">Super Admin <span className="mx-1.5 text-stone-300">/</span> Gold shops</p>
          <p className="mt-1 text-sm font-semibold text-stone-600">Shop profile</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/superadmin/goldshop")}
          className="group inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50"
        >
          <ArrowLeft size={16} className="transition group-hover:-translate-x-0.5" /> Back to shops
        </button>
      </div>

      {loading ? (
        <div role="status" className="flex min-h-80 items-center justify-center rounded-3xl border border-stone-200 bg-white text-sm font-medium text-stone-500 shadow-sm">
          <LoaderCircle className="mr-2 h-5 w-5 animate-spin text-amber-600" /> Loading shop details…
        </div>
      ) : loadError ? (
        <div role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
          <p className="font-semibold text-rose-800">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setDetails({ shopId: null, shop: null, loading: true, error: "" });
              setRetryCount((count) => count + 1);
            }}
            className="mt-3 rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white"
          >
            Retry
          </button>
        </div>
      ) : shop ? (
        <>
          <header className="relative isolate overflow-hidden rounded-[28px] bg-[#123b32] px-5 py-6 text-white shadow-[0_18px_50px_-28px_rgba(18,59,50,0.75)] sm:px-8 sm:py-8">
            <div aria-hidden="true" className="absolute -right-16 -top-32 -z-10 h-80 w-80 rounded-full border-[34px] border-white/[0.035]" />
            <div aria-hidden="true" className="absolute -bottom-28 right-40 -z-10 h-56 w-56 rounded-full bg-amber-400/[0.08] blur-3xl" />
            <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-start">
              <div className="flex min-w-0 items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 to-amber-500 text-[#26342d] shadow-lg shadow-black/15">
                  <Building2 size={25} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-300">{shop.shop_code || "GOLD SHOP"}</p>
                    <span className="rounded-full border border-white/15 bg-white/[0.07] px-2.5 py-1 text-[10px] font-semibold text-white/70">SHOP PROFILE</span>
                  </div>
                  <h1 className="mt-2 break-words text-2xl font-extrabold tracking-tight sm:text-3xl">{shop.shop_name}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/70">
                    <span className="inline-flex items-center gap-1.5"><Store size={14} className="text-amber-300" />{shop.owner_name || "Owner not provided"}</span>
                    {(shop.city || shop.state) && <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-amber-300" />{[shop.city, shop.state].filter(Boolean).join(", ")}</span>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 lg:justify-end">
                <div className="min-w-36 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 backdrop-blur-sm">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-white/50"><ShieldCheck size={13} /> Approval</p>
                  <div className="mt-2"><StatusBadge value={approvalStatus} /></div>
                </div>
                <div className="min-w-36 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/50">Operational status</p>
                  <div className="mt-2"><StatusBadge value={shop.status} /></div>
                </div>
              </div>
            </div>
          </header>

          <div className="grid items-start gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
            <nav aria-label="Gold shop details" className="rounded-3xl border border-stone-200/80 bg-white p-3 shadow-[0_12px_35px_-28px_rgba(28,25,23,0.4)] lg:sticky lg:top-4">
              <div className="px-3 pb-3 pt-2">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-700">Management</p>
                <p className="mt-1 text-sm font-bold text-stone-800">Shop information</p>
              </div>
              <div role="tablist" aria-label="Gold shop detail sections" className="flex gap-1.5 overflow-x-auto border-t border-stone-100 pt-2 lg:flex-col">
                {TABS.map(({ id: tabId, label, icon: Icon }) => (
                  <button
                    key={tabId}
                    type="button"
                    role="tab"
                    id={`gold-shop-detail-tab-${tabId}`}
                    aria-selected={activeTab === tabId}
                    aria-controls={`gold-shop-detail-panel-${tabId}`}
                    onClick={() => setActiveTab(tabId)}
                    className={`group inline-flex min-w-max items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition lg:w-full ${activeTab === tabId ? "bg-[#123b32] text-white shadow-md shadow-emerald-950/10" : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"}`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${activeTab === tabId ? "bg-white/10 text-amber-300" : "bg-stone-100 text-stone-500 transition group-hover:bg-amber-50 group-hover:text-amber-700"}`}><Icon size={16} /></span>
                    <span>{label}</span>
                    {activeTab === tabId && <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-amber-300 lg:block" />}
                  </button>
                ))}
              </div>
            </nav>

            <section
              role="tabpanel"
              id={`gold-shop-detail-panel-${activeTab}`}
              aria-labelledby={`gold-shop-detail-tab-${activeTab}`}
              className="min-w-0 rounded-3xl border border-stone-200/80 bg-white p-5 shadow-[0_12px_35px_-28px_rgba(28,25,23,0.4)] sm:p-7"
            >
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <SectionHeading icon={Store} title="Shop overview" description="Owner, contact, location, and audit information." />
                  <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <InfoCard label="Shop code" value={shop.shop_code} />
                    <InfoCard label="Shop UUID" value={shop.shop_uuid} />
                    <InfoCard label="Owner name" value={shop.owner_name} />
                    <InfoCard label="Mobile" value={shop.mobile} />
                    <InfoCard label="Email" value={shop.email} />
                    <InfoCard label="Owner login username" value={shop.owner_username} />
                    <InfoCard label="GST number" value={shop.gst_number} />
                    <InfoCard label="City / State" value={[shop.city, shop.state].filter(Boolean).join(", ")} />
                    <InfoCard label="Pincode" value={shop.pincode} />
                    <InfoCard label="Address" value={shop.address} wide />
                    <InfoCard label="Maximum branches" value={shop.max_branches} />
                    <InfoCard label="Maximum staff" value={shop.max_staff} />
                    <InfoCard label="Approval status" value={<StatusBadge value={approvalStatus} />} />
                    <InfoCard label="Operational status" value={<StatusBadge value={shop.status} />} />
                    <InfoCard label="Created by" value={shop.created_by_name} />
                    <InfoCard label="Updated by" value={shop.updated_by_name} />
                    <InfoCard label="Created at" value={formatDate(shop.created_at)} />
                    <InfoCard label="Updated at" value={formatDate(shop.updated_at)} />
                    <InfoCard label="Admin notes" value={shop.notes} wide />
                  </dl>
                </div>
              )}

              {activeTab === "subscription" && (
                <div className="space-y-6">
                  <SectionHeading icon={CreditCard} title="Subscription history" description="Current plan details and previous renewals." />
                  {shop.subscriptions?.length ? (
                    <div className="overflow-x-auto rounded-2xl border border-stone-200">
                      <table className="w-full min-w-[700px] text-left text-sm">
                        <thead className="bg-[#f8f6f0] text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500">
                          <tr><th className="p-3">Plan</th><th className="p-3">Duration</th><th className="p-3">Amount</th><th className="p-3">Period</th><th className="p-3">Payment</th><th className="p-3">Status</th></tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 bg-white">
                          {shop.subscriptions.map((item) => (
                            <tr key={item.id} className="transition hover:bg-amber-50/30">
                              <td className="p-4 font-bold text-stone-800">{item.plan_name}</td>
                              <td className="p-4 capitalize text-stone-600">{item.duration?.replaceAll("_", " ") || "—"}</td>
                              <td className="p-4 font-semibold text-stone-800">{formatAmount(item.amount)}</td>
                              <td className="p-4 text-stone-600">{formatDate(item.start_date)} – {formatDate(item.end_date)}</td>
                              <td className="p-4"><StatusBadge value={item.payment_status} /></td>
                              <td className="p-4"><StatusBadge value={item.subscription_status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <EmptyState>No subscription history is recorded for this shop.</EmptyState>}
                </div>
              )}

              {activeTab === "payments" && (
                <div className="space-y-6">
                  <SectionHeading icon={Wallet} title="Payment history" description="Confirm a payment only after verifying that it was received." />
                  {shop.payments?.length ? (
                    <div className="overflow-x-auto rounded-2xl border border-stone-200">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="bg-[#f8f6f0] text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500">
                          <tr><th className="p-3">Transaction</th><th className="p-3">Amount</th><th className="p-3">Method</th><th className="p-3">Status</th><th className="p-3">Date</th><th className="p-3">Action</th></tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 bg-white">
                          {shop.payments.map((payment) => (
                            <tr key={payment.id} className="transition hover:bg-amber-50/30">
                              <td className="p-4 font-medium text-stone-700">{payment.transaction_id || "Awaiting confirmation"}</td>
                              <td className="p-4 font-bold text-stone-800">{formatAmount(payment.amount)}</td>
                              <td className="p-4 capitalize text-stone-600">{payment.payment_method?.replaceAll("_", " ") || "—"}</td>
                              <td className="p-4"><StatusBadge value={payment.payment_status} /></td>
                              <td className="p-4 text-stone-600">{formatDate(payment.payment_date || payment.created_at)}</td>
                              <td className="p-3">
                                {Number(payment.subscription_id) === Number(shop.current_subscription_id) && payment.payment_status !== "paid"
                                  ? <button type="button" onClick={() => openPaymentConfirmation(payment)} className="whitespace-nowrap rounded-xl bg-[#123b32] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#0d3029]">Confirm received</button>
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <EmptyState>No payments are recorded for this shop.</EmptyState>}
                  {currentPayment && (
                    <p className="text-xs text-stone-500">Current subscription payment: {formatAmount(currentPayment.amount)} · <StatusBadge value={currentPayment.payment_status} /></p>
                  )}
                </div>
              )}

              {activeTab === "documents" && (
                <div className="space-y-6">
                  <SectionHeading icon={FileText} title="Shop documents" description="Private files uploaded for this shop." />
                  {shop.documents?.length ? (
                    <ul className="space-y-3">
                      {shop.documents.map((document) => (
                        <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-amber-200 hover:shadow-sm sm:p-5">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><FileText size={19} /></span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-stone-800">{document.original_name}</p>
                              <p className="mt-1 text-xs capitalize text-stone-500">{document.document_type?.replaceAll("_", " ")} · {formatDate(document.created_at)}</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => downloadDocument(document)} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-700 transition hover:border-amber-300 hover:bg-amber-50">
                            <Download size={14} /> Download
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : <EmptyState>No documents have been uploaded for this shop.</EmptyState>}
                </div>
              )}

              {activeTab === "activity" && (
                <div className="space-y-6">
                  <SectionHeading icon={History} title="Activity history" description="Recent changes and actions for this shop." />
                  {shop.activity?.length ? (
                    <ol className="relative space-y-3 before:absolute before:bottom-5 before:left-[19px] before:top-5 before:w-px before:bg-stone-200">
                      {shop.activity.map((event) => (
                        <li key={event.id} className="relative flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 pl-14 transition hover:border-amber-200 hover:shadow-sm">
                          <span className="absolute left-2.5 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border-4 border-white bg-amber-100 text-amber-800"><Clock3 size={15} /></span>
                          <div>
                            <span className="font-semibold capitalize text-stone-800">{event.action.replaceAll(".", " ")}</span>
                            <p className="mt-1 text-xs text-stone-500">{event.actor_name || "System"}</p>
                          </div>
                          <time className="text-xs font-medium text-stone-500">{formatDate(event.created_at)}</time>
                        </li>
                      ))}
                    </ol>
                  ) : <EmptyState>No activity has been recorded for this shop.</EmptyState>}
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}

      {paymentToConfirm && shop && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="confirm-shop-payment-title" className="w-full max-w-xl overflow-hidden rounded-3xl bg-[#fbfaf7] shadow-2xl">
            <header className="flex items-center justify-between gap-4 bg-[#17241f] px-5 py-4 text-white">
              <h2 id="confirm-shop-payment-title" className="text-lg font-bold">Confirm subscription payment</h2>
              <button type="button" disabled={paymentSubmitting} onClick={() => setPaymentToConfirm(null)} aria-label="Close dialog" className="rounded-full p-2 text-white/70 hover:bg-white/10 disabled:opacity-50">
                <X size={19} />
              </button>
            </header>
            <form onSubmit={confirmPayment} className="space-y-4 p-5">
              <p className="text-sm text-stone-600">Confirm only after verifying the payment was received.</p>
              <div className="rounded-xl border border-stone-200 bg-white p-3">
                <p className="text-xs font-semibold text-stone-500">Amount received</p>
                <p className="mt-1 font-bold text-stone-800">{formatAmount(paymentToConfirm.amount)}</p>
              </div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">
                Transaction / reference ID
                <input
                  autoFocus
                  required
                  maxLength={120}
                  value={paymentForm.transactionId}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, transactionId: event.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm normal-case"
                  placeholder="Bank, UPI, or receipt reference"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">
                Payment method
                <CustomSelect
                  value={paymentForm.paymentMethod}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm normal-case"
                >
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </CustomSelect>
              </label>
              <div className="flex justify-end gap-2 border-t border-stone-200 pt-4">
                <button type="button" disabled={paymentSubmitting} onClick={() => setPaymentToConfirm(null)} className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-bold text-stone-700 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={paymentSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-[#00796B] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">
                  {paymentSubmitting && <LoaderCircle size={16} className="animate-spin" />}
                  {paymentSubmitting ? "Confirming…" : "Confirm payment received"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
import CustomSelect from "../CustomSelect.jsx";
import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../api";
import { formatCurrency } from "../../utils/currency";

let razorpayScriptPromise;

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => {
        razorpayScriptPromise = null;
        reject(new Error("Could not load Razorpay checkout."));
      };
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

const formatAmount = formatCurrency;

export default function SubscriptionCheckoutModal({
  token,
  onClose,
  onPaymentComplete,
  initialPlanId
}) {
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState("");
  const [duration, setDuration] = useState("monthly");
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const requestConfig = useMemo(
    () => token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    [token]
  );
  const selectedPlan = plans.find((plan) => String(plan.id) === String(planId));
  const price = selectedPlan ? Number(selectedPlan[`${duration}_price`]) : 0;

  useEffect(() => {
    const controller = new AbortController();
    api.get("/subscriptions/plans", { ...requestConfig, signal: controller.signal })
      .then(({ data }) => {
        if (!Array.isArray(data?.plans)) throw new TypeError("Subscription plans response is invalid");
        setPlans(data.plans);
        setPlanId(String(initialPlanId || data.plans[0]?.id || ""));
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("Failed to load subscription plans:", error);
          toast.error(error.response?.data?.message || "Could not load subscription plans.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPlans(false);
      });
    return () => controller.abort();
  }, [initialPlanId, requestConfig]);

  const startCheckout = async (event) => {
    event.preventDefault();
    if (!selectedPlan || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/subscriptions/orders", {
        planId: Number(planId),
        duration
      }, requestConfig);
      if (!data?.order?.orderId || !data.order.keyId || !Number.isSafeInteger(data.order.amount)) {
        throw new TypeError("Razorpay order response is invalid");
      }
      await loadRazorpayCheckout();
      const checkout = new window.Razorpay({
        key: data.order.keyId,
        amount: data.order.amount,
        currency: data.order.currency,
        name: "Sri Golds",
        description: `${data.order.planName} subscription`,
        order_id: data.order.orderId,
        prefill: data.order.prefill,
        theme: { color: "#00796B" },
        handler: async (paymentResponse) => {
          try {
            const { data: verification } = await api.post(
              "/subscriptions/verify",
              paymentResponse,
              requestConfig
            );
            toast.success(verification.message || "Subscription payment verified.");
            await onPaymentComplete?.();
          } catch (error) {
            console.error("Failed to verify subscription payment:", error);
            toast.error(error.response?.data?.message || "Could not verify the subscription payment.");
          } finally {
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => setSubmitting(false)
        }
      });
      checkout.on("payment.failed", (paymentError) => {
        toast.error(paymentError.error?.description || "Razorpay payment failed. You can try again.");
        setSubmitting(false);
      });
      checkout.open();
    } catch (error) {
      console.error("Could not start subscription checkout:", error);
      toast.error(error.response?.data?.message || error.message || "Could not start checkout.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-label="Subscribe to a plan" className="my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-[#153B35] px-5 py-4 text-white">
          <div>
            <h2 className="font-bold">Choose a subscription</h2>
            <p className="mt-1 text-xs text-white/70">Secure checkout powered by Razorpay</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close subscription checkout" className="rounded-full p-2 text-white/75 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={startCheckout} className="space-y-4 p-5">
          {loadingPlans ? (
            <div className="flex min-h-32 items-center justify-center text-sm text-slate-500">
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Loading plans…
            </div>
          ) : !plans.length ? (
            <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              No active subscription plans are available. Please contact the Super Admin.
            </p>
          ) : (
            <>
              <label className="block text-xs font-semibold text-slate-600">
                Plan
                <CustomSelect required value={planId} onChange={(event) => setPlanId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800">
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.plan_name}</option>
                  ))}
                </CustomSelect>
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Billing period
                <CustomSelect required value={duration} onChange={(event) => setDuration(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm capitalize text-slate-800">
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="half_yearly">Half-yearly</option>
                  <option value="yearly">Yearly</option>
                </CustomSelect>
              </label>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-xs font-semibold text-emerald-800">Amount due</p>
                <p className="mt-1 text-2xl font-black text-emerald-950">{formatAmount(price)}</p>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Your account switches to the paid plan after Razorpay confirms the payment.
              </p>
            </>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Cancel</button>
            <button type="submit" disabled={loadingPlans || !plans.length || !selectedPlan || submitting} className="inline-flex items-center gap-2 rounded-xl bg-[#00796B] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <LoaderCircle size={16} className="animate-spin" />}
              {submitting ? "Processing…" : "Subscribe and pay"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

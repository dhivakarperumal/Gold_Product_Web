import { useState, useContext } from "react";
import api from "../../api";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../PrivateRouter/AuthContext";
import { toast } from "react-hot-toast";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import SubscriptionCheckoutModal from "../Subscription/SubscriptionCheckoutModal";
import AuthLayout from "./AuthLayout";

const getPostLoginPath = (role) => {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (normalizedRole === "superadmin") return "/superadmin";
  if (normalizedRole === "admin") return "/admin";
  return "/";
};

function Login() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [showPassword, setShowPassword] = useState(false);
  const [expiredTrialAccount, setExpiredTrialAccount] = useState(null);
  const [subscriptionToken, setSubscriptionToken] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [subscriptionActionBusy, setSubscriptionActionBusy] = useState(false);
  const [assistanceRequested, setAssistanceRequested] = useState(false);

  const [form, setForm] = useState({
    identifier: "",
    password: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/auth/login", form);
      login(res.data.user, res.data.token);
      toast.success("Login successful!");
      navigate(getPostLoginPath(res.data.user.role));
    } catch (error) {
      console.error("Login Error:", error);
      if (["TRIAL_EXPIRED", "SUBSCRIPTION_REQUIRED"].includes(error.response?.data?.code)) {
        setExpiredTrialAccount(error.response.data.accountPlan || {});
        setSubscriptionToken("");
        setAssistanceRequested(false);
        return;
      }
      toast.error(error.response?.data?.message || "Login failed");
    }
  };

  const getSubscriptionToken = async () => {
    if (subscriptionToken) return subscriptionToken;
    const { data } = await api.post("/auth/subscription-access", form);
    if (!data?.checkoutToken) throw new TypeError("Subscription checkout access was not returned");
    setSubscriptionToken(data.checkoutToken);
    return data.checkoutToken;
  };

  const startSubscriptionCheckout = async () => {
    if (subscriptionActionBusy) return;
    setSubscriptionActionBusy(true);
    try {
      await getSubscriptionToken();
      setCheckoutOpen(true);
    } catch (error) {
      console.error("Could not start expired-trial subscription:", error);
      toast.error(error.response?.data?.message || "Could not open subscription checkout.");
    } finally {
      setSubscriptionActionBusy(false);
    }
  };

  const askSuperAdminForSubscription = async () => {
    if (subscriptionActionBusy || assistanceRequested) return;
    setSubscriptionActionBusy(true);
    try {
      const checkoutToken = await getSubscriptionToken();
      const { data } = await api.post("/subscriptions/requests", {}, {
        headers: { Authorization: `Bearer ${checkoutToken}` }
      });
      setAssistanceRequested(true);
      toast.success(data.message || "Your request was sent to the Super Admin.");
    } catch (error) {
      console.error("Could not request subscription assistance:", error);
      toast.error(error.response?.data?.message || "Could not send your request.");
    } finally {
      setSubscriptionActionBusy(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Administrator access"
      title="Welcome back"
      subtitle="Sign in to your gold shop management account."
      alternatePrompt="New gold shop?"
      alternateLabel="Register here"
      alternateTo="/register"
      contentClassName="mx-auto max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">

            {/* Email/Mobile */}
            <div>
              <label className="mb-1.5 ml-1 block text-sm font-semibold tracking-wide text-stone-700">
                Email / Mobile Number
              </label>
              <div className="relative group">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition-colors group-focus-within:text-emerald-800">
                  <UserRound className="h-5 w-5" aria-hidden="true" />
                </div>
                <input
                  name="identifier"
                  type="text"
                  placeholder="Enter your email or mobile number"
                  onChange={handleChange}
                  className="w-full rounded-xl border border-stone-200 bg-[#eaf1ff] p-3.5 pl-12 text-sm font-medium text-stone-800 outline-none transition-all focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/15"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 ml-1 block text-sm font-semibold tracking-wide text-stone-700">
                Password
              </label>
              <div className="relative group">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition-colors group-focus-within:text-emerald-800">
                  <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  onChange={handleChange}
                  className="w-full rounded-xl border border-stone-200 bg-[#eaf1ff] p-3.5 pl-12 pr-12 text-sm font-medium text-stone-800 outline-none transition-all focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/15"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 transition-colors hover:text-emerald-800"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="h-4 w-4 rounded border-stone-300 accent-emerald-900" />
                <span className="text-sm text-stone-600 transition-colors group-hover:text-emerald-900">Remember Me</span>
              </label>
              <a href="#" className="text-sm font-semibold text-emerald-800 transition-colors hover:text-emerald-950 hover:underline">
                Forgot Password?
              </a>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="group relative flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-950 to-emerald-700 py-3.5 font-semibold text-white shadow-lg shadow-emerald-900/20 transition-all hover:-translate-y-0.5 hover:from-emerald-900 hover:to-emerald-800"
            >
              <span className="relative z-10 flex items-center gap-2 tracking-wide">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                Secure Login
              </span>
              <div className="absolute inset-0 translate-y-full bg-white/20 transition-transform duration-300 group-hover:translate-y-0" />
            </button>

          </form>

      {expiredTrialAccount && !checkoutOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <section role="alertdialog" aria-modal="true" aria-labelledby="expired-trial-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
              {expiredTrialAccount.account_plan_type === "expired" ? "Free trial ended" : "Subscription required"}
            </p>
            <h2 id="expired-trial-title" className="mt-2 text-xl font-black text-slate-900">Subscribe to sign in</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {expiredTrialAccount.account_plan_type === "expired" && expiredTrialAccount.account_end_date
                ? `Your trial ended on ${new Date(`${expiredTrialAccount.account_end_date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}.`
                : expiredTrialAccount.account_plan_type === "expired"
                  ? "Your free trial has ended."
                  : "This shop does not have an active paid subscription."}
              {" "}Choose a paid plan to restore shop access, or ask the Super Admin for help.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={subscriptionActionBusy || assistanceRequested} onClick={askSuperAdminForSubscription} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">
                {assistanceRequested ? "Request sent" : "Ask Super Admin"}
              </button>
              <button type="button" disabled={subscriptionActionBusy} onClick={startSubscriptionCheckout} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00796B] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                {subscriptionActionBusy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                Subscribe now
              </button>
            </div>
            <button type="button" onClick={() => setExpiredTrialAccount(null)} className="mt-3 w-full rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50">
              Close
            </button>
          </section>
        </div>
      )}
      {checkoutOpen && subscriptionToken && (
        <SubscriptionCheckoutModal
          token={subscriptionToken}
          onClose={() => setCheckoutOpen(false)}
          onPaymentComplete={() => {
            setSubscriptionToken("");
            setCheckoutOpen(false);
            setExpiredTrialAccount(null);
            toast.success("Payment complete. Sign in again to continue.");
          }}
        />
      )}

    </AuthLayout>

  );
}

export default Login;

import { useState, useContext } from "react";
import api from "../../api";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../PrivateRouter/AuthContext";
import { toast } from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
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
      alternatePrompt="New gold shop?"
      alternateLabel="Register here"
      alternateTo="/register"
      contentClassName="flex flex-col items-center justify-center"
      fixedHeight
      hideHeader
    >
      <div className="mx-auto mb-4 w-full max-w-md">
        <h1 className="text-2xl font-bold tracking-tight text-[#172a23]">Login</h1>
        <p className="mt-1 text-sm text-stone-600">Sign in to your account to continue.</p>
      </div>
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
            {/* Email/Mobile */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1 tracking-wide">
                Email / Mobile Number
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 group-focus-within:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  name="identifier"
                  type="text"
                  placeholder="Enter your email or mobile number"
                  onChange={handleChange}
                  className="w-full rounded-xl border border-stone-200 bg-white p-3.5 pl-12 text-sm font-medium text-stone-800 outline-none transition-all focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1 tracking-wide">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 group-focus-within:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  onChange={handleChange}
                  className="w-full rounded-xl border border-stone-200 bg-white p-3.5 pl-12 pr-12 text-sm font-medium text-stone-800 outline-none transition-all focus:border-amber-600 focus:ring-2 focus:ring-amber-600/15"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-primary" />
                <span className="text-sm text-gray-600 group-hover:text-primary transition-colors">Remember Me</span>
              </label>
              <a href="#" className="text-sm font-semibold text-primary-light hover:text-primary hover:underline transition-colors">
                Forgot Password?
              </a>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl text-white font-semibold bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary transition-all flex items-center justify-center gap-2 relative overflow-hidden group shadow-lg shadow-primary/30 cursor-pointer hover:-translate-y-0.5"
            >
              <span className="relative z-10 flex items-center gap-2 tracking-wide">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure Login
              </span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
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

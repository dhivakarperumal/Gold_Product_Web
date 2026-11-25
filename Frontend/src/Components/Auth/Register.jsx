import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../../api";
import AuthLayout from "./AuthLayout";
import AddGoldShop from "../../SuperAdmin/GoldShopmanegement/AddGoldShop";

function Register() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api.get("/auth/registration-plans", { signal: controller.signal })
      .then(({ data }) => {
        if (!Array.isArray(data?.plans)) throw new TypeError("Registration plans response is invalid");
        setPlans(data.plans);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("Could not load registration plans:", error);
          setPlansError(error.response?.data?.message || "Could not load subscription plans.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPlansLoading(false);
      });
    return () => controller.abort();
  }, [retryCount]);

  const submitRegistration = async (payload) => {
    setSubmitting(true);
    try {
      const { subscription, credentials, documents, ...shop } = payload;
      const formData = new FormData();
      formData.append("payload", JSON.stringify({ ...shop, credentials, subscription }));
      if (documents?.profilePhoto) formData.append("profilePhoto", documents.profilePhoto);
      await api.post("/auth/shop-registration", formData);
      setSubmitted(true);
    } catch (error) {
      console.error("Could not submit shop registration.", { status: error.response?.status });
      toast.error(error.response?.data?.message || "Could not submit your registration.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <AuthLayout
        eyebrow="Application received"
        title="Registration submitted"
        subtitle="Your gold shop details are now with our review team."
        alternatePrompt="Already registered?"
        alternateLabel="Sign in"
        alternateTo="/login"
        contentClassName="mx-auto max-w-lg"
        splitLayout
        wideFormPanel
        fixedHeight
      >
        <section className="rounded-2xl border border-stone-200 bg-white p-7 text-center shadow-sm sm:p-9">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" aria-hidden="true" />
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Your gold shop details are waiting for Super Admin approval. You can sign in after your registration is approved.
          </p>
          <Link to="/login" className="mt-6 inline-flex rounded-xl bg-stone-900 px-5 py-3 text-sm font-bold text-white hover:bg-stone-800">
            Back to login
          </Link>
        </section>
      </AuthLayout>
    );
  }

  if (plansLoading || plansError || plans.length === 0) {
    return (
      <AuthLayout
        eyebrow="Shop registration"
        title="Register your gold shop"
        subtitle="Set up your shop profile and request an administrator account."
        alternatePrompt="Already have an account?"
        alternateLabel="Sign in"
        alternateTo="/login"
        contentClassName="mx-auto max-w-md"
        splitLayout
        wideFormPanel
        fixedHeight
      >
        <section className="rounded-2xl border border-stone-200 bg-white p-7 text-center shadow-sm">
          {plansLoading ? (
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-amber-700" aria-label="Loading subscription plans" />
          ) : (
            <p role={plansError ? "alert" : "status"} className="text-sm text-stone-700">
              {plansError || "Registration is currently unavailable because there are no active subscription plans."}
            </p>
          )}
          {plansError && (
            <button type="button" onClick={() => {
              setPlansLoading(true);
              setPlansError("");
              setRetryCount((count) => count + 1);
            }} className="mt-5 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-bold text-white">
              Try again
            </button>
          )}
          <button type="button" onClick={() => navigate("/login")} className="mt-5 block w-full text-sm font-semibold text-amber-800 hover:underline">
            Back to login
          </button>
        </section>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Gold shop registration"
      title="Create an account"
      subtitle="Register your gold shop to manage customers, products, and billing with ease."
      alternatePrompt="Already have an account?"
      alternateLabel="Sign in"
      alternateTo="/login"
      splitLayout
      wideFormPanel
      fixedHeight
    >
      <AddGoldShop
        mode="register"
        registrationMode
        plans={plans}
        submitting={submitting}
        onCancel={() => navigate("/login")}
        onSubmit={submitRegistration}
      />
    </AuthLayout>
  );
}

export default Register;

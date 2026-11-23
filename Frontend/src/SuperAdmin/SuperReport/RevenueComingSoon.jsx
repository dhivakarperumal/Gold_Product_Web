import { BarChart3, TrendingUp, ShieldCheck, Sparkles, ArrowRight, DollarSign, PieChart, FileText } from "lucide-react";

export default function RevenueComingSoon({ onSwitchToLive }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-emerald-900/10 bg-white p-8 sm:p-12 shadow-xl text-center">
        {/* Decorative Background Elements */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-100/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-amber-100/40 blur-3xl" />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-600/20 bg-emerald-50 px-4 py-1.5 text-xs font-bold tracking-wider uppercase text-[#07564B]">
          <Sparkles className="h-4 w-4 text-[#07564B]" />
          Super Admin Financial Intelligence
        </div>

        {/* Title */}
        <h1 className="mt-6 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
          Revenue Reports – <span className="text-[#07564B]">Coming Soon</span>
        </h1>

        {/* Description */}
        <p className="mx-auto mt-4 max-w-xl text-base text-slate-600 leading-relaxed">
          We are engineering a robust financial intelligence suite for the Gold Shop SaaS ecosystem.
          Track daily, monthly, and annual subscription revenue, analyze shop-wise performance, and export audit-ready financial statements in real time.
        </p>

        {/* Feature Highlights Grid */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:bg-slate-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#07564B]/10 text-[#07564B]">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-800">Real-Time Analytics</h3>
            <p className="mt-1 text-xs text-slate-500">Interactive daily, weekly, monthly, and yearly revenue growth charts.</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:bg-slate-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <PieChart className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-800">Plan & Shop Insights</h3>
            <p className="mt-1 text-xs text-slate-500">Granular subscription plan breakdown, active counts, and shop-wise dues.</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:bg-slate-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-800">Audit-Ready Exports</h3>
            <p className="mt-1 text-xs text-slate-500">One-click export to Excel, CSV, PDF, and high-resolution print invoices.</p>
          </div>
        </div>

        {/* Action Button */}
        {onSwitchToLive && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onSwitchToLive}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#07564B] to-[#0a6f62] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-950/20 transition hover:from-[#06473e] hover:to-[#08594e] active:scale-[0.98]"
            >
              <span>Launch Live Revenue Reports Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

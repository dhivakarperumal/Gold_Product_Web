import { Layers, Users, CheckCircle, XCircle, ArrowUpRight, TrendingUp } from "lucide-react";
import { formatCurrency } from "../../utils/currency";

export default function SubscriptionRevenueSection({
  subscriptionData = {},
  loading = false
}) {
  const items = subscriptionData.items || [];
  const totalAllRevenue = subscriptionData.totalAllRevenue || 0;

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="h-6 w-48 bg-slate-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="subscription-revenue-container">
      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((plan) => (
          <div
            key={plan.planId}
            className="group relative isolate overflow-hidden rounded-2xl border border-emerald-100 border-t-4 border-t-emerald-500 bg-gradient-to-br from-white via-white to-emerald-50 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span aria-hidden="true" className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-emerald-300/25 blur-2xl transition duration-300 group-hover:scale-125" />
            {/* Top Row: Plan Name & Badge */}
            <div className="relative flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm shadow-emerald-900/15">
                  <Layers className="h-4 w-4" />
                </span>
                <h4 className="text-sm font-extrabold text-slate-900">{plan.planName}</h4>
              </div>
              <span className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-[9px] font-extrabold uppercase text-slate-600">
                {formatCurrency(plan.monthlyPrice)} / mo
              </span>
            </div>

            {/* Total Revenue Big Metric */}
            <div className="relative mt-4">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Revenue Collected
              </span>
              <p className="mt-1 font-sans text-2xl font-black tracking-tight text-slate-900">
                {formatCurrency(plan.totalRevenue)}
              </p>
            </div>

            {/* Progress Bar of Revenue Share */}
            <div className="relative mt-4">
              <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                <span>Revenue Share</span>
                <span className="text-[#07564B] font-bold">{plan.percentageShare}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-emerald-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(2, plan.percentageShare))}%` }}
                />
              </div>
            </div>

            {/* Subscriber Breakdown */}
            <div className="relative mt-4 grid grid-cols-3 gap-2 border-t border-emerald-100 pt-3 text-center text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Subscribers</span>
                <p className="font-bold text-slate-800">{plan.subscribersCount}</p>
              </div>
              <div>
                <span className="text-[10px] text-emerald-600 font-medium">Active</span>
                <p className="font-bold text-emerald-700">{plan.activeSubscriptions}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Expired</span>
                <p className="font-bold text-slate-600">{plan.expiredSubscriptions}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Subscription Plans Revenue Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lg shadow-slate-900/[0.04]">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h3 className="flex items-center gap-3 text-base font-black tracking-tight text-slate-900">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                <Layers className="h-5 w-5" />
              </span>
              Subscription Plan Income Performance
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Comprehensive revenue and retention metrics aggregated by subscription plan tier
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-2 text-left sm:text-right">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Total Subscription Income</span>
            <p className="font-sans text-lg font-black text-emerald-900">
              {formatCurrency(totalAllRevenue)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto bg-slate-50/50 px-3 pb-2 sm:px-4">
          <table className="w-full border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-[#064E3B] via-[#08796B] to-[#0D776D] text-[10px] font-extrabold uppercase tracking-[0.08em] text-white">
                <th className="rounded-tl-xl py-3 px-4">Plan Name</th>
                <th className="py-3 px-4 text-right">Subscription Amount</th>
                <th className="py-3 px-4 text-center">Number of Subscribers</th>
                <th className="py-3 px-4 text-center">Active Subscriptions</th>
                <th className="py-3 px-4 text-center">Expired Subscriptions</th>
                <th className="py-3 px-4 text-right">Total Revenue</th>
                <th className="rounded-tr-xl py-3 px-4 text-right">Revenue Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((plan) => (
                <tr key={plan.planId} className="transition-colors hover:bg-emerald-50/45">
                  <td className="py-3.5 px-4">
                    <div className="text-sm font-extrabold text-slate-900">{plan.planName}</div>
                    <span className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-[9px] font-extrabold uppercase text-emerald-800">
                      Tier {plan.planId}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-bold text-slate-800 font-sans">
                    {formatCurrency(plan.monthlyPrice)}
                    <span className="text-[10px] text-slate-400 font-normal"> /mo</span>
                  </td>
                  <td className="py-4 px-4 text-center font-bold text-slate-800">
                    {plan.subscribersCount}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                      <CheckCircle className="h-3 w-3" /> {plan.activeSubscriptions}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {plan.expiredSubscriptions}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-black text-slate-900 font-sans text-sm">
                    {formatCurrency(plan.totalRevenue)}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="font-bold text-[#07564B] bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                      {plan.percentageShare}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

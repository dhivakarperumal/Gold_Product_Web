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
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-emerald-600/30"
          >
            {/* Top Row: Plan Name & Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-[#07564B]">
                  <Layers className="h-4 w-4" />
                </span>
                <h4 className="font-bold text-slate-900 text-sm">{plan.planName}</h4>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                {formatCurrency(plan.monthlyPrice)} / mo
              </span>
            </div>

            {/* Total Revenue Big Metric */}
            <div className="mt-4">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Revenue Collected
              </span>
              <p className="text-xl font-black text-slate-900 font-sans mt-0.5">
                {formatCurrency(plan.totalRevenue)}
              </p>
            </div>

            {/* Progress Bar of Revenue Share */}
            <div className="mt-3">
              <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                <span>Revenue Share</span>
                <span className="text-[#07564B] font-bold">{plan.percentageShare}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#07564B] to-[#10B981] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(2, plan.percentageShare))}%` }}
                />
              </div>
            </div>

            {/* Subscriber Breakdown */}
            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
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
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="h-5 w-5 text-[#07564B]" />
              Subscription Plan Income Performance
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive revenue and retention metrics aggregated by subscription plan tier
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-slate-500">Total Subscription Income</span>
            <p className="text-lg font-black text-emerald-800 font-sans">
              {formatCurrency(totalAllRevenue)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 text-slate-600 font-bold border-b border-slate-100 uppercase tracking-wider">
                <th className="py-3 px-4">Plan Name</th>
                <th className="py-3 px-4 text-right">Subscription Amount</th>
                <th className="py-3 px-4 text-center">Number of Subscribers</th>
                <th className="py-3 px-4 text-center">Active Subscriptions</th>
                <th className="py-3 px-4 text-center">Expired Subscriptions</th>
                <th className="py-3 px-4 text-right">Total Revenue</th>
                <th className="py-3 px-4 text-right">Revenue Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((plan) => (
                <tr key={plan.planId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 text-sm">{plan.planName}</div>
                    <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      Tier {plan.planId}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-800 font-sans">
                    {formatCurrency(plan.monthlyPrice)}
                    <span className="text-[10px] text-slate-400 font-normal"> /mo</span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                    {plan.subscribersCount}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                      <CheckCircle className="h-3 w-3" /> {plan.activeSubscriptions}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {plan.expiredSubscriptions}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-slate-900 font-sans text-sm">
                    {formatCurrency(plan.totalRevenue)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
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

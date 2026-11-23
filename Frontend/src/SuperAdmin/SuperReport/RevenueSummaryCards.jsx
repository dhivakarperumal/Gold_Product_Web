import { TrendingUp, TrendingDown, DollarSign, Calendar, Clock, AlertCircle, CheckCircle2, CreditCard } from "lucide-react";
import { formatCurrency } from "../../utils/currency";

export default function RevenueSummaryCards({ data = {}, loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-slate-200 rounded" />
              <div className="h-10 w-10 rounded-xl bg-slate-200" />
            </div>
            <div className="mt-4 h-7 w-32 bg-slate-200 rounded" />
            <div className="mt-2 h-3 w-20 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      id: "total_revenue",
      title: "Total Revenue",
      amount: data.totalRevenue ?? 0,
      subtext: `${data.paidTransactions || 0} Successful Transactions`,
      badge: "All Time",
      badgeType: "emerald",
      icon: DollarSign,
      color: "from-[#07564B] to-[#0A6F62]",
      iconBg: "bg-emerald-50 text-[#07564B]",
      borderColor: "border-emerald-600/30"
    },
    {
      id: "today_revenue",
      title: "Today's Revenue",
      amount: data.todayRevenue ?? 0,
      subtext: data.todayGrowth !== 0 ? `${data.todayGrowth > 0 ? "+" : ""}${data.todayGrowth}% vs yesterday` : "Same as yesterday",
      growth: data.todayGrowth,
      icon: Clock,
      iconBg: "bg-teal-50 text-teal-700",
      borderColor: "border-teal-500/20"
    },
    {
      id: "month_revenue",
      title: "This Month's Revenue",
      amount: data.thisMonthRevenue ?? 0,
      subtext: data.monthGrowth !== 0 ? `${data.monthGrowth > 0 ? "+" : ""}${data.monthGrowth}% vs last month` : "Calculated MTD",
      growth: data.monthGrowth,
      icon: Calendar,
      iconBg: "bg-sky-50 text-sky-700",
      borderColor: "border-sky-500/20"
    },
    {
      id: "year_revenue",
      title: "This Year's Revenue",
      amount: data.thisYearRevenue ?? 0,
      subtext: data.yearGrowth !== 0 ? `${data.yearGrowth > 0 ? "+" : ""}${data.yearGrowth}% vs last year` : "Calculated YTD",
      growth: data.yearGrowth,
      icon: TrendingUp,
      iconBg: "bg-indigo-50 text-indigo-700",
      borderColor: "border-indigo-500/20"
    },
    {
      id: "subscription_revenue",
      title: "Subscription Revenue",
      amount: data.totalSubscriptionRevenue ?? 0,
      subtext: `${data.activeSubscribers || 0} Active Gold Shops`,
      icon: CreditCard,
      iconBg: "bg-purple-50 text-purple-700",
      borderColor: "border-purple-500/20"
    },
    {
      id: "pending_payments",
      title: "Pending Payments",
      amount: data.pendingPaymentsAmount ?? 0,
      subtext: `${data.pendingPaymentsCount || 0} Invoices Pending`,
      badge: data.pendingPaymentsCount > 0 ? `${data.pendingPaymentsCount} Unpaid` : "Clear",
      badgeType: data.pendingPaymentsCount > 0 ? "amber" : "emerald",
      icon: AlertCircle,
      iconBg: data.pendingPaymentsCount > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700",
      borderColor: data.pendingPaymentsCount > 0 ? "border-amber-500/30" : "border-emerald-500/20"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const hasGrowth = card.growth !== undefined;
        const isPositive = (card.growth || 0) >= 0;

        return (
          <div
            key={card.id}
            className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${card.borderColor}`}
          >
            {/* Top Bar / Header */}
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase line-clamp-1">
                {card.title}
              </span>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>

            {/* Main Value */}
            <div className="mt-3">
              <p className="text-2xl font-black tracking-tight text-slate-900 font-sans">
                {formatCurrency(card.amount)}
              </p>
            </div>

            {/* Footer / Trend Info */}
            <div className="mt-3 flex items-center justify-between gap-1 text-xs">
              <div className="flex items-center gap-1 text-slate-500 font-medium truncate">
                {hasGrowth && (
                  <span
                    className={`inline-flex items-center gap-0.5 font-bold ${
                      isPositive ? "text-emerald-700" : "text-rose-600"
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                  </span>
                )}
                <span className="truncate">{card.subtext}</span>
              </div>

              {card.badge && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    card.badgeType === "amber"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {card.badge}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

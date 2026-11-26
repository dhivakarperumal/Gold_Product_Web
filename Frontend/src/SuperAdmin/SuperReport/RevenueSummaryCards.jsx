import { TrendingUp, TrendingDown, DollarSign, Calendar, Clock, AlertCircle, CreditCard } from "lucide-react";
import { formatCurrency } from "../../utils/currency";

const metricTones = {
  forest: {
    card: "border-emerald-100 border-t-4 border-t-emerald-500 bg-gradient-to-br from-white via-white to-emerald-50",
    icon: "bg-emerald-700 text-white shadow-emerald-900/15",
    detail: "text-emerald-700",
    dot: "bg-emerald-500",
    glow: "bg-emerald-300/35"
  },
  gold: {
    card: "border-amber-100 border-t-4 border-t-amber-500 bg-gradient-to-br from-white via-white to-amber-50",
    icon: "bg-amber-500 text-white shadow-amber-900/15",
    detail: "text-amber-700",
    dot: "bg-amber-500",
    glow: "bg-amber-300/35"
  },
  blue: {
    card: "border-sky-100 border-t-4 border-t-sky-500 bg-gradient-to-br from-white via-white to-sky-50",
    icon: "bg-sky-700 text-white shadow-sky-900/15",
    detail: "text-sky-700",
    dot: "bg-sky-500",
    glow: "bg-sky-300/35"
  },
  indigo: {
    card: "border-violet-100 border-t-4 border-t-violet-500 bg-gradient-to-br from-white via-white to-violet-50",
    icon: "bg-violet-600 text-white shadow-violet-900/15",
    detail: "text-violet-700",
    dot: "bg-violet-500",
    glow: "bg-violet-300/35"
  },
  teal: {
    card: "border-teal-100 border-t-4 border-t-teal-500 bg-gradient-to-br from-white via-white to-teal-50",
    icon: "bg-teal-700 text-white shadow-teal-900/15",
    detail: "text-teal-700",
    dot: "bg-teal-500",
    glow: "bg-teal-300/35"
  },
  rust: {
    card: "border-rose-100 border-t-4 border-t-rose-500 bg-gradient-to-br from-white via-white to-rose-50",
    icon: "bg-rose-600 text-white shadow-rose-900/15",
    detail: "text-rose-700",
    dot: "bg-rose-500",
    glow: "bg-rose-300/35"
  }
};

export default function RevenueSummaryCards({ data = {}, loading = false }) {
  const cards = [
    {
      id: "total_revenue",
      title: "Total Revenue",
      amount: data.totalRevenue ?? 0,
      subtext: `${data.paidTransactions || 0} Successful Transactions`,
      badge: "All Time",
      badgeType: "emerald",
      icon: DollarSign,
      tone: "forest"
    },
    {
      id: "today_revenue",
      title: "Today's Revenue",
      amount: data.todayRevenue ?? 0,
      subtext: data.todayGrowth !== 0 ? `${data.todayGrowth > 0 ? "+" : ""}${data.todayGrowth}% vs yesterday` : "Same as yesterday",
      growth: data.todayGrowth,
      icon: Clock,
      tone: "gold"
    },
    {
      id: "month_revenue",
      title: "This Month's Revenue",
      amount: data.thisMonthRevenue ?? 0,
      subtext: data.monthGrowth !== 0 ? `${data.monthGrowth > 0 ? "+" : ""}${data.monthGrowth}% vs last month` : "Calculated MTD",
      growth: data.monthGrowth,
      icon: Calendar,
      tone: "blue"
    },
    {
      id: "year_revenue",
      title: "This Year's Revenue",
      amount: data.thisYearRevenue ?? 0,
      subtext: data.yearGrowth !== 0 ? `${data.yearGrowth > 0 ? "+" : ""}${data.yearGrowth}% vs last year` : "Calculated YTD",
      growth: data.yearGrowth,
      icon: TrendingUp,
      tone: "indigo"
    },
    {
      id: "subscription_revenue",
      title: "Subscription Revenue",
      amount: data.totalSubscriptionRevenue ?? 0,
      subtext: `${data.activeSubscribers || 0} Active Gold Shops`,
      icon: CreditCard,
      tone: "teal"
    },
    {
      id: "pending_payments",
      title: "Pending Payments",
      amount: data.pendingPaymentsAmount ?? 0,
      subtext: `${data.pendingPaymentsCount || 0} Invoices Pending`,
      badge: data.pendingPaymentsCount > 0 ? `${data.pendingPaymentsCount} Unpaid` : "Clear",
      badgeType: data.pendingPaymentsCount > 0 ? "amber" : "emerald",
      icon: AlertCircle,
      tone: "rust"
    }
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const colors = metricTones[card.tone] || metricTones.forest;
        const hasGrowth = card.growth !== undefined;
        const isPositive = (card.growth || 0) >= 0;

        return (
          <div
            key={card.id}
            className={`group relative isolate flex min-h-36 min-w-0 items-center justify-between gap-3 overflow-hidden rounded-2xl border p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl sm:p-5 ${colors.card}`}
          >
            <span aria-hidden="true" className={`absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl transition duration-300 group-hover:scale-125 ${colors.glow}`} />
            <div className="relative min-w-0 flex-1">
              <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">{card.title}</p>
              {loading
                ? <div className="mt-2 h-8 w-32 animate-pulse rounded-lg bg-slate-200/80" />
                : <p title={formatCurrency(card.amount)} className="mt-2 truncate text-2xl font-black leading-none tracking-tight text-slate-900 sm:text-3xl">{formatCurrency(card.amount)}</p>}
              <div className={`mt-3 flex min-h-5 min-w-0 items-center gap-1.5 text-[10px] leading-4 sm:text-[11px] ${colors.detail}`}>
                {loading
                  ? <div className="h-3 w-28 animate-pulse rounded bg-slate-200/80" />
                  : (
                    <>
                      {hasGrowth
                        ? (
                          <span className={`shrink-0 ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          </span>
                        )
                        : <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} />}
                      <span className="min-w-0 flex-1 font-bold leading-4">{card.subtext}</span>
                    </>
                  )}
                {card.badge && !loading && (
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${card.badgeType === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-100 bg-emerald-50 text-emerald-800"}`}>
                    {card.badge}
                  </span>
                )}
              </div>
            </div>
            <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-lg sm:h-12 sm:w-12 ${colors.icon}`}>
              <Icon size={22} strokeWidth={2} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

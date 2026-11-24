import { TrendingUp, TrendingDown, DollarSign, Calendar, Clock, AlertCircle, CreditCard } from "lucide-react";
import { formatCurrency } from "../../utils/currency";

const metricTones = {
  forest: {
    card: "border-[#2F6B59] border-l-emerald-400 bg-[#123B32]",
    icon: "bg-[#08745D] text-white",
    label: "text-emerald-50/90",
    detail: "text-emerald-300",
    bars: "bg-emerald-300"
  },
  gold: {
    card: "border-[#8A702E] border-l-amber-400 bg-[#443719]",
    icon: "bg-[#C58B11] text-white",
    label: "text-amber-50/90",
    detail: "text-amber-300",
    bars: "bg-amber-300"
  },
  blue: {
    card: "border-[#3B7897] border-l-sky-400 bg-[#17364D]",
    icon: "bg-[#007A61] text-white",
    label: "text-sky-50/90",
    detail: "text-sky-300",
    bars: "bg-sky-300"
  },
  indigo: {
    card: "border-[#555E9C] border-l-violet-300 bg-[#292B50]",
    icon: "bg-[#7138E8] text-white",
    label: "text-violet-50/90",
    detail: "text-violet-200",
    bars: "bg-violet-300"
  },
  teal: {
    card: "border-[#34766D] border-l-teal-300 bg-[#153E3A]",
    icon: "bg-[#087D70] text-white",
    label: "text-teal-50/90",
    detail: "text-teal-200",
    bars: "bg-teal-300"
  },
  rust: {
    card: "border-[#905342] border-l-orange-300 bg-[#4A2B25]",
    icon: "bg-[#C58B11] text-white",
    label: "text-orange-50/90",
    detail: "text-orange-200",
    bars: "bg-orange-200"
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
            className={`relative flex min-h-[176px] min-w-0 items-center gap-4 overflow-hidden rounded-xl border border-l-4 p-4 shadow-md transition-shadow hover:shadow-lg sm:p-5 ${colors.card}`}
          >
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl shadow-inner ${colors.icon}`}>
              <Icon size={25} strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <p className={`truncate text-sm font-semibold ${colors.label}`}>{card.title}</p>
              {loading
                ? <div className="mt-2 h-8 w-28 animate-pulse rounded bg-white/15" />
                : <p className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-[28px]">{formatCurrency(card.amount)}</p>}
              <div className={`mt-2 flex min-h-5 min-w-0 items-center gap-1.5 text-xs ${colors.detail}`}>
                {loading
                  ? <div className="h-3 w-24 animate-pulse rounded bg-white/15" />
                  : (
                    <>
                      {hasGrowth
                        ? (
                          <span className={isPositive ? "text-emerald-300" : "text-rose-300"}>
                            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          </span>
                        )
                        : <span className={`h-2 w-2 shrink-0 rounded-full ${colors.bars}`} />}
                      <span className="min-w-0 flex-1 truncate font-semibold">{card.subtext}</span>
                    </>
                  )}
                {card.badge && !loading && (
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${card.badgeType === "amber" ? "border-amber-300/40 bg-amber-300/15 text-amber-100" : "border-white/15 bg-white/10 text-white/80"}`}>
                    {card.badge}
                  </span>
                )}
              </div>
            </div>
            <div aria-hidden="true" className={`absolute bottom-3 right-3 flex h-8 items-end gap-1 opacity-90 ${colors.detail}`}>
              <span className="h-3 w-1.5 rounded-t-sm bg-current" />
              <span className="h-5 w-1.5 rounded-t-sm bg-current" />
              <span className="h-4 w-1.5 rounded-t-sm bg-current" />
              <span className="h-7 w-1.5 rounded-t-sm bg-current" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

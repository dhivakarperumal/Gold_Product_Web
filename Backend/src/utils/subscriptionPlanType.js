function dateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value !== 'string') return null;
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === date ? date : null;
}

function dayNumber(value) {
  const date = dateOnly(value);
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}

function getSubscriptionAccountPlan(subscription) {
  if (!subscription?.plan_name) return null;

  const trialDays = Number(subscription.trial_days || 0);
  const isPaid = String(subscription.payment_status || '').toLowerCase() === 'paid';
  const today = dayNumber(subscription.database_date) ?? dayNumber(new Date());
  const trialStart = dayNumber(subscription.trial_start_date);
  const trialEnd = dayNumber(subscription.trial_end_date);
  const hasTrialDates = trialDays > 0 && trialStart != null && trialEnd != null;
  const trialActive = hasTrialDates
    && today >= trialStart && today <= trialEnd;
  const trialExpired = hasTrialDates && !isPaid && today > trialEnd;
  const paymentPending = !isPaid && !trialActive && !trialExpired;
  const showTrialPeriod = trialActive || trialExpired;

  return {
    ...Object.fromEntries(Object.entries(subscription).filter(([key]) => key !== 'database_date')),
    account_plan_type: trialActive ? 'trial' : trialExpired ? 'expired' : paymentPending ? 'pending' : 'live',
    trial_active: trialActive,
    trial_days_remaining: trialActive ? trialEnd - today + 1 : 0,
    account_start_date: showTrialPeriod ? subscription.trial_start_date : subscription.start_date,
    account_end_date: showTrialPeriod ? subscription.trial_end_date : subscription.end_date
  };
}

module.exports = {
  getSubscriptionAccountPlan
};

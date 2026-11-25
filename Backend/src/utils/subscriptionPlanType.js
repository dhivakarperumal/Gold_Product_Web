function getSubscriptionPlanType(planName) {
  if (!planName) return null;
  return /trial|trail/i.test(String(planName)) ? 'trial' : 'live';
}

module.exports = {
  getSubscriptionPlanType
};

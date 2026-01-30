const PLANS = {
  free_1: {
    id: "free_1",
    name: "Free",
    priceUsdMonthly: 0,
    maxCaregivers: 1,
    features: {
      viewLogs: true,
      dataManagement: false,
      missedPunchReview: true,
      printing: false,
    },
  },
  standard_10: {
    id: "standard_10",
    name: "Standard",
    priceUsdMonthly: 10,
    maxCaregivers: 10,
    features: {
      viewLogs: true,
      dataManagement: true,
      missedPunchReview: true,
      printing: false,
    },
  },
  pro_25: {
    id: "pro_25",
    name: "Pro",
    priceUsdMonthly: 15,
    maxCaregivers: 25,
    features: {
      viewLogs: true,
      dataManagement: true,
      missedPunchReview: true,
      printing: true,
    },
  },
};

function getPlan(planId) {
  return planId && PLANS[planId] ? PLANS[planId] : null;
}

function listPlans() {
  return Object.values(PLANS);
}

module.exports = {
  PLANS,
  getPlan,
  listPlans,
};

const PLANS = {
  free_1: {
    id: "free_1",
    name: "Free",
    priceUsdMonthly: 0,
    maxStaff: 2,
    features: {
      viewLogs: true,
      dataManagement: false,
      missedPunchReview: true,
      printing: false,
      payroll: false,
    },
  },
  standard_10: {
    id: "standard_10",
    name: "Standard",
    priceUsdMonthly: 35,
    maxStaff: 20,
    features: {
      viewLogs: true,
      dataManagement: true,
      missedPunchReview: true,
      printing: false,
      payroll: false,
    },
  },
  pro_25: {
    id: "pro_25",
    name: "Pro",
    priceUsdMonthly: 55,
    maxStaff: 40,
    features: {
      viewLogs: true,
      dataManagement: true,
      missedPunchReview: true,
      printing: true,
      payroll: true,
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

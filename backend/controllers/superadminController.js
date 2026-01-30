const Tenant = require("../models/Tenant");
const Caregiver = require("../models/caregiver");
const { getPlan } = require("../config/plans");

function serializePlan(plan) {
  if (!plan) return null;
  return {
    id: plan.id,
    name: plan.name,
    priceUsdMonthly: plan.priceUsdMonthly,
    maxCaregivers: plan.maxCaregivers,
    features: plan.features,
  };
}

function serializeFacility({ tenant, plan, caregiverCount }) {
  return {
    tenantCode: tenant.tenantCode || null,
    name: tenant.name || "",

    planSelected: Boolean(tenant.planSelected),
    planId: tenant.planId || null,
    plan: serializePlan(plan),

    caregiverCount: typeof caregiverCount === "number" ? caregiverCount : null,

    // Stripe-ready fields (nullable until Stripe is wired)
    subscriptionStatus: tenant.subscriptionStatus || null,
    currentPeriodEnd: tenant.currentPeriodEnd || null,
    stripeCustomerId: tenant.stripeCustomerId || null,
    stripeSubscriptionId: tenant.stripeSubscriptionId || null,
    stripePriceId: tenant.stripePriceId || null,
  };
}

// GET /api/superadmin/facilities
// Read-only: list all facilities (tenants) and plan/subscription info.
exports.listFacilities = async (req, res) => {
  try {
    const tenants = await Tenant.find({})
      .select(
        "name tenantCode planSelected planId subscriptionStatus currentPeriodEnd stripeCustomerId stripeSubscriptionId stripePriceId createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    const facilities = tenants.map((tenant) => {
      const plan = tenant.planSelected ? getPlan(tenant.planId) : null;
      return serializeFacility({ tenant, plan, caregiverCount: null });
    });

    return res.json({ facilities });
  } catch (err) {
    console.error("listFacilities failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/superadmin/facilities/:tenantCode/summary
// Read-only: show one facility by tenantCode, including caregiver count.
exports.getFacilitySummary = async (req, res) => {
  try {
    const tenantCode = (req.params.tenantCode || "").toString().trim().toUpperCase();
    if (!tenantCode) {
      return res.status(400).json({ message: "tenantCode is required" });
    }

    const tenant = await Tenant.findOne({ tenantCode })
      .select(
        "name tenantCode planSelected planId subscriptionStatus currentPeriodEnd stripeCustomerId stripeSubscriptionId stripePriceId"
      )
      .lean();

    if (!tenant) {
      return res.status(404).json({ message: "Facility not found" });
    }

    const plan = tenant.planSelected ? getPlan(tenant.planId) : null;
    const caregiverCount = await Caregiver.countDocuments({ tenantId: tenant._id, isActive: { $ne: false } });

    return res.json({ facility: serializeFacility({ tenant, plan, caregiverCount }) });
  } catch (err) {
    console.error("getFacilitySummary failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

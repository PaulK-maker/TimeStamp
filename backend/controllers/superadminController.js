const Tenant = require("../models/Tenant");
const Staff = require("../models/staff");
const { getPlan } = require("../config/plans");

function serializePlan(plan) {
  if (!plan) return null;
  return {
    id: plan.id,
    name: plan.name,
    priceUsdMonthly: plan.priceUsdMonthly,
    maxStaff: plan.maxStaff,
    features: plan.features,
  };
}

function serializeFacility({ tenant, plan, staffCount }) {
  return {
    tenantCode: tenant.tenantCode || null,
    name: tenant.name || "",

    planSelected: Boolean(tenant.planSelected),
    planId: tenant.planId || null,
    plan: serializePlan(plan),

    staffCount: typeof staffCount === "number" ? staffCount : null,

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
      return serializeFacility({ tenant, plan, staffCount: null });
    });

    return res.json({ facilities });
  } catch (err) {
    console.error("listFacilities failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/superadmin/facilities/:tenantCode/summary
// Read-only: show one facility by tenantCode, including staff count.
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
    const staffCount = await Staff.countDocuments({ tenantId: tenant._id, isActive: { $ne: false } });

    return res.json({ facility: serializeFacility({ tenant, plan, staffCount }) });
  } catch (err) {
    console.error("getFacilitySummary failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

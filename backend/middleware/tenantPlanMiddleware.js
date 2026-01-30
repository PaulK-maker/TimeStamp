const Tenant = require("../models/Tenant");
const { getPlan } = require("../config/plans");

async function loadTenantAndPlan(req) {
  if (!req.user) {
    const err = new Error("Not authenticated");
    err.statusCode = 401;
    throw err;
  }

  const tenantId = req.user.tenantId;
  if (!tenantId) {
    const err = new Error(
      "Tenant is not assigned for this account. Run the tenant backfill script."
    );
    err.statusCode = 403;
    err.code = "TENANT_REQUIRED";
    throw err;
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    const err = new Error("Tenant not found for this account");
    err.statusCode = 403;
    err.code = "TENANT_NOT_FOUND";
    throw err;
  }

  const plan = tenant.planSelected ? getPlan(tenant.planId) : null;

  req.tenant = tenant;
  req.plan = plan;

  return { tenant, plan };
}

function requirePlanSelected() {
  return async (req, res, next) => {
    try {
      const { tenant, plan } = await loadTenantAndPlan(req);
      if (!tenant.planSelected || !plan) {
        return res.status(403).json({
          message: "A pricing plan must be selected before using this feature.",
          code: "PLAN_REQUIRED",
        });
      }
      return next();
    } catch (e) {
      return res
        .status(e.statusCode || 500)
        .json({ message: e.message || "Server error", code: e.code });
    }
  };
}

function requireFeature(featureName) {
  return async (req, res, next) => {
    try {
      const { tenant, plan } = await loadTenantAndPlan(req);

      if (!tenant.planSelected || !plan) {
        return res.status(403).json({
          message: "A pricing plan must be selected before using this feature.",
          code: "PLAN_REQUIRED",
        });
      }

      const enabled = Boolean(plan.features && plan.features[featureName]);
      if (!enabled) {
        return res.status(403).json({
          message: "Your pricing plan does not include this feature.",
          code: "FEATURE_NOT_AVAILABLE",
          feature: featureName,
          planId: plan.id,
        });
      }

      return next();
    } catch (e) {
      return res
        .status(e.statusCode || 500)
        .json({ message: e.message || "Server error", code: e.code });
    }
  };
}

module.exports = {
  loadTenantAndPlan,
  requirePlanSelected,
  requireFeature,
};

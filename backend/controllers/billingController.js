const Tenant = require("../models/Tenant");
const { getPlan, listPlans } = require("../config/plans");

async function listAvailablePlans(req, res) {
  return res.json({ plans: listPlans() });
}

async function getMyBilling(req, res) {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    return res.status(403).json({
      message: "Tenant is not assigned for this account.",
      code: "TENANT_REQUIRED",
    });
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    return res.status(404).json({ message: "Tenant not found" });
  }

  const plan = tenant.planSelected ? getPlan(tenant.planId) : null;

  return res.json({
    tenant: {
      id: tenant._id.toString(),
      name: tenant.name,
      tenantCode: tenant.tenantCode || null,
      planSelected: tenant.planSelected,
      planId: tenant.planId,
    },
    plan,
  });
}

async function selectPlan(req, res) {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    return res.status(403).json({
      message: "Tenant is not assigned for this account.",
      code: "TENANT_REQUIRED",
    });
  }

  const { planId } = req.body || {};
  const plan = getPlan(planId);
  if (!plan) {
    return res.status(400).json({ message: "Invalid planId" });
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    return res.status(404).json({ message: "Tenant not found" });
  }

  tenant.planId = plan.id;
  tenant.planSelected = true;
  await tenant.save();

  return res.json({
    message: "Plan selected",
    tenant: {
      id: tenant._id.toString(),
      name: tenant.name,
      tenantCode: tenant.tenantCode || null,
      planSelected: tenant.planSelected,
      planId: tenant.planId,
    },
    plan,
  });
}

module.exports = {
  listAvailablePlans,
  getMyBilling,
  selectPlan,
};

const mongoose = require("mongoose");
const Tenant = require("../models/Tenant");
const Caregiver = require("../models/caregiver");

function normalizeTenantCode(value) {
  return (value || "")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

async function loadCurrentCaregiver(req) {
  const id = req.user?.id;
  if (id && mongoose.Types.ObjectId.isValid(id)) {
    return Caregiver.findById(id);
  }

  const clerkUserId = req.user?.clerkUserId;
  if (clerkUserId) {
    return Caregiver.findOne({ clerkUserId });
  }

  return null;
}

function serializeTenant(tenant) {
  if (!tenant) return null;
  return {
    id: tenant._id.toString(),
    name: tenant.name,
    tenantCode: tenant.tenantCode || null,
    planSelected: Boolean(tenant.planSelected),
    planId: tenant.planId || null,
  };
}

// POST /api/tenant/bootstrap
// Admin-only. If the current admin has no tenantId, create one and bind them to it.
exports.bootstrapTenant = async (req, res) => {
  try {
    const caregiver = await loadCurrentCaregiver(req);
    if (!caregiver) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (caregiver.tenantId) {
      const existing = await Tenant.findById(caregiver.tenantId);
      return res.json({
        message: "Tenant already assigned",
        tenant: serializeTenant(existing),
      });
    }

    const desiredName = (req.body?.name || "").toString().trim();
    const tenantName = desiredName || "My Facility";

    const tenant = await Tenant.create({
      name: tenantName,
      planSelected: false,
    });

    // Bind caregiver to tenant, but only if still unassigned (prevents race/overwrites).
    const bound = await Caregiver.findOneAndUpdate(
      {
        _id: caregiver._id,
        $or: [{ tenantId: { $exists: false } }, { tenantId: null }],
      },
      { $set: { tenantId: tenant._id } },
      { new: true }
    );

    if (!bound) {
      // Someone else assigned it; return the newly created tenant anyway (it exists).
      return res.status(409).json({
        message: "Tenant assignment race: caregiver is no longer unassigned",
        code: "TENANT_ALREADY_ASSIGNED",
        tenant: serializeTenant(tenant),
      });
    }

    return res.status(201).json({
      message: "Tenant created and assigned",
      tenant: serializeTenant(tenant),
    });
  } catch (err) {
    console.error("bootstrapTenant failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


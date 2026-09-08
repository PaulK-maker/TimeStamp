const mongoose = require("mongoose");
const Tenant = require("../models/Tenant");
const Staff = require("../models/staff");
const {
  sendFacilitySignupNotification,
} = require("../utils/mailer");

function normalizeTenantCode(value) {
  return (value || "")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

async function loadCurrentStaff(req) {
  const id = req.user?.id;
  if (id && mongoose.Types.ObjectId.isValid(id)) {
    return Staff.findById(id);
  }

  const clerkUserId = req.user?.clerkUserId;
  if (clerkUserId) {
    return Staff.findOne({ clerkUserId });
  }

  return null;
}

function serializeTenant(tenant) {
  if (!tenant) return null;
  return {
    id: tenant._id.toString(),
    name: tenant.name,
    businessTagline: tenant.businessTagline || "",
    tenantCode: tenant.tenantCode || null,
    planSelected: Boolean(tenant.planSelected),
    planId: tenant.planId || null,
  };
}

// POST /api/tenant/bootstrap
// Admin-only. If the current admin has no tenantId, create one and bind them to it.
exports.bootstrapTenant = async (req, res) => {
  try {
    const staffMember = await loadCurrentStaff(req);
    if (!staffMember) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (staffMember.tenantId) {
      const existing = await Tenant.findById(staffMember.tenantId);
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

    // Bind staff member to tenant and promote to admin (they are the facility owner).
    const bound = await Staff.findOneAndUpdate(
      {
        _id: staffMember._id,
        $or: [{ tenantId: { $exists: false } }, { tenantId: null }],
      },
      { $set: { tenantId: tenant._id, role: "admin", payrollRunAccess: true } },
      { new: true }
    );

    if (!bound) {
      // Someone else assigned it; return the newly created tenant anyway (it exists).
      return res.status(409).json({
        message: "Tenant assignment race: staff member is no longer unassigned",
        code: "TENANT_ALREADY_ASSIGNED",
        tenant: serializeTenant(tenant),
      });
    }

      try {
        await sendFacilitySignupNotification({
          tenant,
          createdBy: staffMember,
          source: "tenantController.bootstrapTenant",
        });
      } catch (notificationError) {
        console.warn("Facility signup notification failed:", notificationError);
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

// PUT /api/tenant/profile
// Admin-only. Lets the facility owner set the company name and tagline shown on estimates/invoices.
exports.updateProfile = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant required" });

    const { name, businessTagline } = req.body;

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    if (name !== undefined) tenant.name = name.trim() || tenant.name;
    if (businessTagline !== undefined) tenant.businessTagline = businessTagline.trim();

    await tenant.save();
    return res.json({ message: "Company profile updated", tenant: serializeTenant(tenant) });
  } catch (err) {
    console.error("updateProfile failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


const TimeEntry = require("../models/TimeEntry");
const Staff = require("../models/staff");
const TimeEntryCorrection = require("../models/TimeEntryCorrection");

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function isSameId(a, b) {
  return String(a || "") === String(b || "");
}

async function resolveStaff({ tenantId, staffId, email }) {
  const normalizedEmail = normalizeEmail(email);

  if (staffId) {
    const byId = await Staff.findOne({ _id: staffId, tenantId });
    if (byId) return byId;
  }

  if (normalizedEmail) {
    const byEmail = await Staff.findOne({ email: normalizedEmail, tenantId });
    if (byEmail) return byEmail;
  }

  return null;
}

async function ensureNotLastAdmin(staffMember, tenantId) {
  if (!staffMember || staffMember.role !== "admin") return;
  const adminCount = await Staff.countDocuments({
    role: "admin",
    isActive: true,
    tenantId,
  });
  if (adminCount <= 1) {
    const err = new Error("Cannot remove the last active admin");
    err.statusCode = 400;
    throw err;
  }
}

/**
 * GET /api/admin/timelogs
 * Admin-only: Get all time entries
 * Optional query params:
 *   staffId - filter by staff member
 *   startDate / endDate - filter by date range
 */
exports.getAllTimeLogs = async (req, res) => {
  try {
    const { staffId, startDate, endDate } = req.query;

    const adminTenantId = req.user?.tenantId;
    if (!adminTenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    let query = { tenantId: adminTenantId };

    if (staffId) {
      const staffMember = await Staff.findOne({
        _id: staffId,
        tenantId: adminTenantId,
      }).select("_id");

      if (!staffMember) {
        return res.status(403).json({
          message: "Access denied: cross-tenant access blocked",
          code: "CROSS_TENANT_BLOCKED",
        });
      }

      query.staff = staffId;
    }

    if (startDate || endDate) {
      query.punchIn = {};
      if (startDate) query.punchIn.$gte = new Date(startDate);
      if (endDate) query.punchIn.$lte = new Date(endDate);
    }

    const logs = await TimeEntry.find(query)
      .populate("staff", "firstName lastName email role")
      .sort({ punchIn: -1 });

    const entryIds = logs.map((l) => l._id);
    const corrections = await TimeEntryCorrection.find({
      tenantId: adminTenantId,
      timeEntry: { $in: entryIds },
    })
      .select("timeEntry effectivePunchIn effectivePunchOut")
      .lean();

    const correctionByEntryId = new Map(
      corrections.map((c) => [String(c.timeEntry), c])
    );

    const logsWithEffective = logs.map((log) => {
      const obj = log.toObject({ virtuals: true });
      const correction = correctionByEntryId.get(String(log._id));
      return {
        ...obj,
        effectivePunchIn: correction?.effectivePunchIn || obj.punchIn,
        effectivePunchOut:
          correction?.effectivePunchOut !== undefined
            ? correction.effectivePunchOut
            : obj.punchOut,
      };
    });

    res.json({ count: logsWithEffective.length, logs: logsWithEffective });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/admin/promote
 * Admin-only: Promote an existing staff member to admin by email.
 * Body: { email: string }
 */
exports.promoteStaffToAdmin = async (req, res) => {
  try {
    const adminTenantId = req.user?.tenantId;
    if (!adminTenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const staffId = (req.body?.staffId || "").trim();
    const email = normalizeEmail(req.body?.email);

    if (!staffId && !email) {
      return res.status(400).json({ message: "staffId or email is required" });
    }

    const staffMember = await resolveStaff({
      tenantId: adminTenantId,
      staffId,
      email,
    });
    if (!staffMember) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    if (!staffMember.isActive) {
      return res.status(400).json({ message: "Cannot promote an inactive user" });
    }

    // Option A: Clerk publicMetadata.role is the source of truth.
    // If this staff member is linked to Clerk, update Clerk metadata too.
    if (process.env.CLERK_SECRET_KEY && staffMember.clerkUserId) {
      try {
        const { clerkClient } = require("@clerk/express");
        await clerkClient.users.updateUserMetadata(staffMember.clerkUserId, {
          publicMetadata: { role: "admin" },
        });
      } catch (e) {
        console.warn("Failed to update Clerk user metadata for promotion", {
          clerkUserId: staffMember.clerkUserId,
          email: staffMember.email,
          error: e?.message || String(e),
        });
      }
    }

    if (staffMember.role !== "admin") {
      staffMember.role = "admin";
      await staffMember.save();
    }

    return res.json({
      message: "Staff member promoted to admin",
      staff: {
        id: staffMember._id.toString(),
        email: staffMember.email,
        role: staffMember.role,
        isActive: staffMember.isActive,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/admin/demote
 * Admin-only: Demote an existing admin back to staff.
 * Body: { staffId?: string, email?: string }
 */
exports.demoteAdminToStaff = async (req, res) => {
  try {
    const adminTenantId = req.user?.tenantId;
    if (!adminTenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const staffId = (req.body?.staffId || "").trim();
    const email = normalizeEmail(req.body?.email);

    if (!staffId && !email) {
      return res.status(400).json({ message: "staffId or email is required" });
    }

    const staffMember = await resolveStaff({
      tenantId: adminTenantId,
      staffId,
      email,
    });
    if (!staffMember) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    // Prevent self-demotion (lockout protection)
    if (isSameId(staffMember._id, req.user?.staffId || req.user?.id)) {
      return res.status(400).json({ message: "You cannot demote your own account" });
    }

    if (!staffMember.isActive) {
      return res.status(400).json({ message: "Cannot demote an inactive user" });
    }

    if (staffMember.role !== "admin") {
      return res.status(400).json({ message: "User is not an admin" });
    }

    await ensureNotLastAdmin(staffMember, adminTenantId);

    if (process.env.CLERK_SECRET_KEY && staffMember.clerkUserId) {
      try {
        const { clerkClient } = require("@clerk/express");
        await clerkClient.users.updateUserMetadata(staffMember.clerkUserId, {
          publicMetadata: { role: "staff" },
        });
      } catch (e) {
        console.warn("Failed to update Clerk user metadata for demotion", {
          clerkUserId: staffMember.clerkUserId,
          email: staffMember.email,
          error: e?.message || String(e),
        });
      }
    }

    if (staffMember.role !== "staff") {
      staffMember.role = "staff";
      await staffMember.save();
    }

    return res.json({
      message: "Admin demoted to staff",
      staff: {
        id: staffMember._id.toString(),
        email: staffMember.email,
        role: staffMember.role,
        isActive: staffMember.isActive,
      },
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error(error);
    res.status(status).json({ message: error?.message || "Server error" });
  }
};

/**
 * DELETE /api/admin/users/:staffId
 * Admin-only: Deprovision a user.
 * - Deletes the user in Clerk (if linked).
 * - Marks the local staff record as inactive (keeps TimeEntry history intact).
 */
exports.deleteUser = async (req, res) => {
  try {
    const adminTenantId = req.user?.tenantId;
    if (!adminTenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const staffId = (req.params?.staffId || "").trim();
    if (!staffId) {
      return res.status(400).json({ message: "staffId is required" });
    }

    const staffMember = await Staff.findOne({
      _id: staffId,
      tenantId: adminTenantId,
    });
    if (!staffMember) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    // Prevent self-delete (lockout protection)
    if (isSameId(staffMember._id, req.user?.staffId || req.user?.id)) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    // If deleting an active admin, ensure at least one active admin remains.
    if (staffMember.isActive) {
      await ensureNotLastAdmin(staffMember, adminTenantId);
    }

    // 1) Delete from Clerk (source of login)
    if (process.env.CLERK_SECRET_KEY && staffMember.clerkUserId) {
      try {
        const { clerkClient } = require("@clerk/express");
        await clerkClient.users.deleteUser(staffMember.clerkUserId);
      } catch (e) {
        // If the Clerk user is already gone, continue. Otherwise, fail fast.
        const message = e?.message || String(e);
        const status = e?.status || e?.statusCode;
        const isNotFound = status === 404 || /not\s*found/i.test(message);
        if (!isNotFound) {
          return res.status(502).json({
            message: "Failed to delete user from Clerk",
            detail: process.env.NODE_ENV !== "production" ? message : undefined,
          });
        }
      }
    }

    // 2) Soft-delete locally to preserve time logs
    staffMember.isActive = false;
    staffMember.role = "staff";
    await staffMember.save();

    return res.json({
      message: "User deleted",
      staff: {
        id: staffMember._id.toString(),
        email: staffMember.email,
        role: staffMember.role,
        isActive: staffMember.isActive,
      },
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error(error);
    res.status(status).json({ message: error?.message || "Server error" });
  }
};

const TimeEntry = require("../models/TimeEntry");
const Staff = require("../models/staff");
const TimeEntryCorrection = require("../models/TimeEntryCorrection");
const Tenant = require("../models/Tenant");
const { isMailerConfigured, sendMail } = require("../utils/mailer");

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

async function ensureNotLastPayrollRunAccessHolder(staffMember, tenantId) {
  if (!staffMember || !staffMember.payrollRunAccess) return;
  const holderCount = await Staff.countDocuments({
    tenantId,
    isActive: true,
    payrollRunAccess: true,
  });
  if (holderCount <= 1) {
    const err = new Error(
      "Cannot revoke payroll run access from the last admin who has it"
    );
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
      .populate("job", "name gustoJobUuid isActive")
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
 * POST /api/admin/payroll-access/grant
 * Payroll-run-access-only: Grant another admin the ability to create/submit
 * payroll runs (not just view them). Requires the caller to already have
 * payrollRunAccess themselves (enforced by requirePayrollRunAccess middleware).
 * Body: { staffId?: string, email?: string }
 */
exports.grantPayrollRunAccess = async (req, res) => {
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

    if (staffMember.role !== "admin") {
      return res.status(400).json({
        message: "Only admins can be granted payroll run access",
      });
    }

    if (!staffMember.isActive) {
      return res.status(400).json({
        message: "Cannot grant payroll run access to an inactive user",
      });
    }

    if (!staffMember.payrollRunAccess) {
      staffMember.payrollRunAccess = true;
      await staffMember.save();
    }

    return res.json({
      message: "Payroll run access granted",
      staff: {
        id: staffMember._id.toString(),
        email: staffMember.email,
        role: staffMember.role,
        payrollRunAccess: staffMember.payrollRunAccess,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/admin/payroll-access/revoke
 * Payroll-run-access-only: Revoke another admin's ability to create/submit
 * payroll runs. They keep view access via the base "admin" role.
 * Body: { staffId?: string, email?: string }
 */
exports.revokePayrollRunAccess = async (req, res) => {
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

    await ensureNotLastPayrollRunAccessHolder(staffMember, adminTenantId);

    if (staffMember.payrollRunAccess) {
      staffMember.payrollRunAccess = false;
      await staffMember.save();
    }

    return res.json({
      message: "Payroll run access revoked",
      staff: {
        id: staffMember._id.toString(),
        email: staffMember.email,
        role: staffMember.role,
        payrollRunAccess: staffMember.payrollRunAccess,
      },
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error(error);
    res.status(status).json({ message: error?.message || "Server error" });
  }
};

/**
 * PATCH /api/admin/shift-length
 * Admin-only: Set the facility's standard shift length (8 or 12 hours).
 * Used to derive a "shifts worked" summary from total hours worked.
 * Body: { shiftLengthHours: 8 | 12 }
 */
exports.updateShiftLength = async (req, res) => {
  try {
    const adminTenantId = req.user?.tenantId;
    if (!adminTenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const shiftLengthHours = Number(req.body?.shiftLengthHours);
    if (![8, 12].includes(shiftLengthHours)) {
      return res.status(400).json({ message: "shiftLengthHours must be 8 or 12" });
    }

    const tenant = await Tenant.findByIdAndUpdate(
      adminTenantId,
      { shiftLengthHours },
      { new: true, runValidators: true }
    );
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    return res.json({
      message: "Shift length updated",
      shiftLengthHours: tenant.shiftLengthHours,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PATCH /api/admin/geofence
 * Admin-only: configure the facility's approved location and geofence radius,
 * and toggle enforcement on/off for punch in/out.
 */
exports.updateGeofenceSettings = async (req, res) => {
  try {
    const adminTenantId = req.user?.tenantId;
    if (!adminTenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const tenant = await Tenant.findById(adminTenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const { geofenceEnabled, facilityLatitude, facilityLongitude, geofenceRadiusMeters } =
      req.body || {};

    if (facilityLatitude !== undefined) {
      const lat = Number(facilityLatitude);
      if (Number.isNaN(lat) || lat < -90 || lat > 90) {
        return res.status(400).json({ message: "facilityLatitude must be between -90 and 90" });
      }
      tenant.facilityLatitude = lat;
    }

    if (facilityLongitude !== undefined) {
      const lng = Number(facilityLongitude);
      if (Number.isNaN(lng) || lng < -180 || lng > 180) {
        return res.status(400).json({ message: "facilityLongitude must be between -180 and 180" });
      }
      tenant.facilityLongitude = lng;
    }

    if (geofenceRadiusMeters !== undefined) {
      const radius = Number(geofenceRadiusMeters);
      if (Number.isNaN(radius) || radius < 20 || radius > 5000) {
        return res.status(400).json({ message: "geofenceRadiusMeters must be between 20 and 5000" });
      }
      tenant.geofenceRadiusMeters = radius;
    }

    if (geofenceEnabled !== undefined) {
      const enabled = Boolean(geofenceEnabled);
      if (enabled && (tenant.facilityLatitude == null || tenant.facilityLongitude == null)) {
        return res.status(400).json({
          message: "Set a facility location before enabling geofencing.",
          code: "GEOFENCE_LOCATION_REQUIRED",
        });
      }
      tenant.geofenceEnabled = enabled;
    }

    await tenant.save();

    return res.json({
      message: "Geofence settings updated",
      geofenceEnabled: tenant.geofenceEnabled,
      facilityLatitude: tenant.facilityLatitude,
      facilityLongitude: tenant.facilityLongitude,
      geofenceRadiusMeters: tenant.geofenceRadiusMeters,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

function escapeCsvField(value) {
  const str = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvHours(value) {
  return typeof value === "number" && !Number.isNaN(value) ? value.toFixed(2) : "0.00";
}

function csvAmount(value) {
  return typeof value === "number" && !Number.isNaN(value) ? value.toFixed(2) : "0.00";
}

function buildHoursSummaryCsv(rows, { facilityName, periodStart, periodEnd } = {}) {
  const lines = [];

  if (facilityName) {
    lines.push(escapeCsvField(`Facility: ${facilityName}`));
  }
  lines.push(escapeCsvField(`Period Start: ${periodStart || "-"}`));
  lines.push(escapeCsvField(`Period End: ${periodEnd || "-"}`));
  lines.push(
    escapeCsvField(
      "DISCLAIMER: These hours are unverified and preview-only. Confirm all totals with the facility admin before running payroll or issuing payment based on this report."
    )
  );
  lines.push("");

  const header = [
    "Staff Name",
    "Email",
    "Total Hours",
    "Overtime Hours",
    "PTO Hours",
    "Bonus Amount",
    "Manual Overtime Hours",
  ];
  lines.push(header.map(escapeCsvField).join(","));

  rows.forEach((row) => {
    lines.push(
      [
        row.name || "",
        row.email || "",
        csvHours(row.totalHours),
        csvHours(row.overtimeHours),
        csvHours(row.ptoHours),
        csvAmount(row.bonusAmount),
        csvHours(row.manualOvertimeHours),
      ]
        .map(escapeCsvField)
        .join(",")
    );
  });

  return lines.join("\r\n");
}

/**
 * POST /api/admin/reports/hours-summary
 * Admin-only: email a CSV hours-per-staff summary to any address, so a
 * facility can hand off to an external payroll provider (or process pay
 * themselves) before/without using this app's built-in payroll integration.
 */
exports.emailHoursSummaryReport = async (req, res) => {
  try {
    const adminTenantId = req.user?.tenantId;
    if (!adminTenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    if (!isMailerConfigured()) {
      return res.status(503).json({
        message: "Email is not configured for this server yet. Contact support to enable it.",
        code: "MAIL_NOT_CONFIGURED",
      });
    }

    const recipientEmail = normalizeEmail(req.body?.recipientEmail);
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return res.status(400).json({ message: "A valid recipientEmail is required." });
    }

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) {
      return res.status(400).json({ message: "At least one report row is required." });
    }
    if (rows.length > 500) {
      return res.status(400).json({ message: "Too many rows in one report (max 500)." });
    }

    const periodStart = String(req.body?.periodStart || "").trim();
    const periodEnd = String(req.body?.periodEnd || "").trim();
    if (!periodStart || !periodEnd) {
      return res.status(400).json({ message: "periodStart and periodEnd are required." });
    }
    const periodLabel = `${periodStart} to ${periodEnd}`;

    const tenant = await Tenant.findById(adminTenantId).select("name").lean();
    const facilityName = tenant?.name || "your facility";

    const csv = buildHoursSummaryCsv(rows, { facilityName, periodStart, periodEnd });
    const filename = `hours-report-${periodStart}-to-${periodEnd}.csv`;

    await sendMail({
      to: recipientEmail,
      subject: `Hours summary report — ${facilityName} (${periodLabel})`,
      text:
        `Attached is an hours summary report for ${facilityName}, covering ${periodLabel}.\n\n` +
        `This report was generated from TimeStamp and is provided as-is for payroll processing outside the app.\n\n` +
        `DISCLAIMER: These hours are unverified and preview-only. Please confirm all totals with the ` +
        `facility admin (${facilityName}) before running payroll or issuing payment based on this report.`,
      attachments: [
        {
          filename,
          content: csv,
          contentType: "text/csv",
        },
      ],
    });

    return res.json({ message: "Report sent", recipientEmail });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
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

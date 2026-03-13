const TimeEntry = require("../models/TimeEntry");
const mongoose = require("mongoose");
const Staff = require("../models/staff");
const TimeEntryCorrection = require("../models/TimeEntryCorrection");

const resolveStaffObjectId = async (req) => {
  const candidate = req.user?.staffId || req.user?.id;
  if (!candidate) return null;

  if (mongoose.Types.ObjectId.isValid(candidate)) return candidate;

  // Clerk user ids look like "user_..."; map them to a Staff record.
  const staffMember = await Staff.findOne({ clerkUserId: candidate }).select(
    "_id"
  );
  return staffMember?._id?.toString() || null;
};

// @desc   Punch IN
// @route  POST /api/timeclock/punch-in
// @access Private (staff)
const punchIn = async (req, res) => {
  try {
    const staffId = await resolveStaffObjectId(req);
    if (!staffId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }
    const { notes } = req.body;

    // Check for active shift
    const activeShift = await TimeEntry.findOne({
      tenantId,
      staff: staffId,
      punchOut: null,
    });

    if (activeShift) {
      return res.status(400).json({
        message: "Staff member already punched in",
      });
    }

    const entry = await TimeEntry.create({
      tenantId,
      staff: staffId,
      punchIn: new Date(),
      notes,
    });

    res.status(201).json(entry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// @desc   Punch OUT
// @route  POST /api/timeclock/punch-out
// @access Private (staff)
const punchOut = async (req, res) => {
  try {
    const staffId = await resolveStaffObjectId(req);
    if (!staffId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const activeShift = await TimeEntry.findOne({
      tenantId,
      staff: staffId,
      punchOut: null,
    });

    if (!activeShift) {
      return res.status(400).json({
        message: "No active shift found",
      });
    }

    activeShift.punchOut = new Date();
    await activeShift.save();

    res.json(activeShift);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// @desc   Get staff time entries (for the logged-in staff member)
// @route  GET /api/timeclock/my-logs
// @access Private (staff)
const getMyTimeEntries = async (req, res) => {
  try {
    const staffId = await resolveStaffObjectId(req);
    if (!staffId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const query = { tenantId, staff: staffId };

    const entries = await TimeEntry.find(query).sort({ punchIn: -1 });

    const entryIds = entries.map((e) => e._id);
    const corrections = await TimeEntryCorrection.find({
      timeEntry: { $in: entryIds },
      tenantId,
    })
      .select("timeEntry effectivePunchIn effectivePunchOut")
      .lean();

    const correctionByEntryId = new Map(
      corrections.map((c) => [String(c.timeEntry), c])
    );

    const logs = entries.map((entry) => {
      const obj = entry.toObject();
      const correction = correctionByEntryId.get(String(entry._id));
      return {
        ...obj,
        effectivePunchIn: correction?.effectivePunchIn || obj.punchIn,
        effectivePunchOut:
          correction?.effectivePunchOut !== undefined
            ? correction.effectivePunchOut
            : obj.punchOut,
      };
    });

    res.json({ logs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Existing admin-style endpoints can stay if you still need them
// @desc   Get time entries by staffId (admin)
// @route  GET /api/timeclock/:staffId
const getTimeEntries = async (req, res) => {
  try {
    const adminTenantId = req.user?.tenantId;
    if (!adminTenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const staffMember = await Staff.findById(req.params.staffId).select(
      "tenantId"
    );
    if (!staffMember) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    if (!staffMember.tenantId || String(staffMember.tenantId) !== String(adminTenantId)) {
      return res.status(403).json({
        message: "Access denied: cross-tenant access blocked",
        code: "CROSS_TENANT_BLOCKED",
      });
    }

    const entries = await TimeEntry.find({
      tenantId: adminTenantId,
      staff: req.params.staffId,
    }).sort({ punchIn: -1 });

    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Get total hours worked for a staff member (admin)
// @route  GET /api/timeclock/:staffId/total-hours
const getTotalHours = async (req, res) => {
  try {
    const adminTenantId = req.user?.tenantId;
    if (!adminTenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const staffMember = await Staff.findById(req.params.staffId).select(
      "tenantId"
    );
    if (!staffMember) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    if (!staffMember.tenantId || String(staffMember.tenantId) !== String(adminTenantId)) {
      return res.status(403).json({
        message: "Access denied: cross-tenant access blocked",
        code: "CROSS_TENANT_BLOCKED",
      });
    }

    const entries = await TimeEntry.find({
      tenantId: adminTenantId,
      staff: req.params.staffId,
      punchOut: { $ne: null },
    });

    let totalMilliseconds = 0;

    entries.forEach((entry) => {
      const duration = entry.punchOut - entry.punchIn;
      totalMilliseconds += duration;
    });

    const totalHours = totalMilliseconds / (1000 * 60 * 60);

    res.json({
      staffId: req.params.staffId,
      totalHours: Number(totalHours.toFixed(2)),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  punchIn,
  punchOut,
  getMyTimeEntries,
  getTimeEntries,
  getTotalHours,
};
const mongoose = require("mongoose");
const TrainingRecord = require("../models/TrainingRecord");
const Staff = require("../models/staff");

function computeStatus(record) {
  if (!record.expirationDate) return "valid";
  const daysUntil = Math.ceil(
    (new Date(record.expirationDate) - new Date()) / 86400000
  );
  if (daysUntil <= 0) return "expired";
  if (daysUntil <= (record.renewalReminderDays || 30)) return "expiring_soon";
  return "valid";
}

async function requireTenantId(req, res) {
  const { tenantId } = req.user || {};
  if (!tenantId) {
    res
      .status(403)
      .json({ message: "Tenant is not assigned for this account.", code: "TENANT_REQUIRED" });
    return null;
  }
  return tenantId;
}

async function resolveCurrentStaff(req) {
  const candidate = req.user?.staffId || req.user?.id;
  if (!candidate) return null;
  if (mongoose.Types.ObjectId.isValid(candidate)) {
    return Staff.findById(candidate).select("_id tenantId").lean();
  }
  return Staff.findOne({ clerkUserId: candidate }).select("_id tenantId").lean();
}

async function listTraining(req, res) {
  try {
    const tenantId = await requireTenantId(req, res);
    if (!tenantId) return;

    const filter = { tenantId };

    if (req.user?.role !== "admin") {
      const staff = await resolveCurrentStaff(req);
      if (!staff) return res.status(403).json({ message: "Staff record not found." });
      filter.staffId = staff._id;
    } else if (req.query.staffId) {
      filter.staffId = req.query.staffId;
    }

    const records = await TrainingRecord.find(filter)
      .populate("staffId", "firstName lastName email")
      .sort({ expirationDate: 1, title: 1 })
      .lean();

    return res.json({
      count: records.length,
      records: records.map((r) => ({ ...r, status: computeStatus(r) })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

async function createTraining(req, res) {
  try {
    const tenantId = await requireTenantId(req, res);
    if (!tenantId) return;

    const { staffId, title, issuingOrganization, dateReceived, expirationDate, renewalReminderDays, notes } =
      req.body;

    if (!staffId || !title?.trim() || !dateReceived) {
      return res
        .status(400)
        .json({ message: "staffId, title, and dateReceived are required." });
    }

    const staff = await Staff.findOne({ _id: staffId, tenantId }).lean();
    if (!staff)
      return res.status(404).json({ message: "Staff member not found in this tenant." });

    const record = await TrainingRecord.create({
      tenantId,
      staffId,
      title: title.trim(),
      issuingOrganization: issuingOrganization?.trim() || null,
      dateReceived: new Date(dateReceived),
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      renewalReminderDays: renewalReminderDays != null ? Number(renewalReminderDays) : 30,
      notes: notes?.trim() || null,
    });

    return res.status(201).json({ record });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

async function updateTraining(req, res) {
  try {
    const tenantId = await requireTenantId(req, res);
    if (!tenantId) return;

    const record = await TrainingRecord.findOne({ _id: req.params.id, tenantId });
    if (!record) return res.status(404).json({ message: "Training record not found." });

    const allowed = [
      "title",
      "issuingOrganization",
      "dateReceived",
      "expirationDate",
      "renewalReminderDays",
      "notes",
    ];
    for (const key of allowed) {
      if (key in req.body) record[key] = req.body[key] === "" ? null : req.body[key];
    }

    await record.save();
    return res.json({ record });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

async function deleteTraining(req, res) {
  try {
    const tenantId = await requireTenantId(req, res);
    if (!tenantId) return;

    const record = await TrainingRecord.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!record) return res.status(404).json({ message: "Training record not found." });

    return res.json({ message: "Record deleted." });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

module.exports = { listTraining, createTraining, updateTraining, deleteTraining };

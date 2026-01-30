const mongoose = require("mongoose");
const Caregiver = require("../models/caregiver");
const TimeEntry = require("../models/TimeEntry");
const MissedPunchRequest = require("../models/MissedPunchRequest");
const TimeEntryCorrection = require("../models/TimeEntryCorrection");

async function resolveCaregiverObjectId(req) {
  const candidate = req.user?.caregiverId || req.user?.id;
  if (!candidate) return null;

  if (mongoose.Types.ObjectId.isValid(candidate)) return candidate;

  const caregiver = await Caregiver.findOne({ clerkUserId: candidate }).select(
    "_id"
  );
  return caregiver?._id?.toString() || null;
}

function parseDate(value) {
  const dt = new Date(value);
  if (!value || Number.isNaN(dt.getTime())) return null;
  return dt;
}

// POST /api/missed-punch/requests
exports.createMissedPunchRequest = async (req, res) => {
  try {
    const caregiverId = await resolveCaregiverObjectId(req);
    if (!caregiverId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const timeEntryId = (req.body?.timeEntryId || "").trim();
    const missingField = (req.body?.missingField || "").trim();
    const requestedTime = parseDate(req.body?.requestedTime);
    const reason = (req.body?.reason || "").toString();

    if (!timeEntryId) {
      return res.status(400).json({ message: "timeEntryId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(timeEntryId)) {
      return res.status(400).json({ message: "Invalid timeEntryId" });
    }

    if (!missingField || !["punchOut", "punchIn"].includes(missingField)) {
      return res
        .status(400)
        .json({ message: "missingField must be 'punchOut' or 'punchIn'" });
    }

    // For initial implementation, we only support requesting a missing punchOut.
    if (missingField !== "punchOut") {
      return res
        .status(400)
        .json({ message: "Only missed punchOut requests are supported right now" });
    }

    if (!requestedTime) {
      return res.status(400).json({ message: "requestedTime is required" });
    }

    const entry = await TimeEntry.findOne({
      _id: timeEntryId,
      tenantId,
      caregiver: caregiverId,
    });

    if (!entry) {
      return res.status(404).json({ message: "Time entry not found" });
    }

    // At least one punch must exist
    if (!entry.punchIn && !entry.punchOut) {
      return res
        .status(400)
        .json({ message: "At least one punch must exist for this entry" });
    }

    // Only allow requesting missing punchOut if it's actually missing.
    if (entry.punchOut) {
      return res.status(400).json({ message: "This entry already has a punch out" });
    }

    // Basic sanity: requested punch-out can't be before punch-in.
    if (entry.punchIn && requestedTime < entry.punchIn) {
      return res
        .status(400)
        .json({ message: "requestedTime cannot be earlier than punchIn" });
    }

    const existingPending = await MissedPunchRequest.findOne({
      tenantId,
      caregiver: caregiverId,
      timeEntry: entry._id,
      missingField,
      status: "pending",
    });

    if (existingPending) {
      return res.status(400).json({
        message: "A pending request already exists for this entry",
        requestId: existingPending._id,
      });
    }

    const request = await MissedPunchRequest.create({
      tenantId,
      caregiver: caregiverId,
      timeEntry: entry._id,
      missingField,
      requestedTime,
      reason,
      status: "pending",
    });

    return res.status(201).json({ request });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/missed-punch/requests/mine
exports.getMyMissedPunchRequests = async (req, res) => {
  try {
    const caregiverId = await resolveCaregiverObjectId(req);
    if (!caregiverId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const requests = await MissedPunchRequest.find({
      tenantId,
      caregiver: caregiverId,
    })
      .populate({
        path: "timeEntry",
        select: "punchIn punchOut",
      })
      .sort({ createdAt: -1 });

    return res.json({ requests });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/missed-punch/requests/:id/cancel
exports.cancelMyMissedPunchRequest = async (req, res) => {
  try {
    const caregiverId = await resolveCaregiverObjectId(req);
    if (!caregiverId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const requestId = (req.params?.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "Invalid request id" });
    }

    const request = await MissedPunchRequest.findOne({
      _id: requestId,
      tenantId,
      caregiver: caregiverId,
    });

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Only pending requests can be cancelled" });
    }

    request.status = "cancelled";
    await request.save();

    return res.json({ request });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/admin/missed-punch-requests
exports.adminListMissedPunchRequests = async (req, res) => {
  try {
    const adminTenantId = req.user?.tenantId;
    if (!adminTenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const status = (req.query?.status || "pending").toString().trim();
    const allowed = new Set(["pending", "approved", "rejected", "cancelled", "all"]);

    const query = {};
    if (allowed.has(status) && status !== "all") {
      query.status = status;
    }

    query.tenantId = adminTenantId;

    const requests = await MissedPunchRequest.find(query)
      .populate({
        path: "caregiver",
        select: "firstName lastName email",
      })
      .populate({
        path: "timeEntry",
        select: "punchIn punchOut",
      })
      .sort({ createdAt: -1 });

    return res.json({ count: requests.length, requests });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/admin/missed-punch-requests/:id/approve
exports.adminApproveMissedPunchRequest = async (req, res) => {
  try {
    const adminTenantId = req.user?.tenantId;
    if (!adminTenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const requestId = (req.params?.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "Invalid request id" });
    }

    const request = await MissedPunchRequest.findOne({
      _id: requestId,
      tenantId: adminTenantId,
    });
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Request is not pending (status=${request.status})` });
    }

    const entry = await TimeEntry.findById(request.timeEntry);
    if (!entry) {
      request.status = "rejected";
      request.adminNote = "Time entry no longer exists";
      request.reviewedAt = new Date();
      request.reviewedBy = req.user?.caregiverId || req.user?.id || null;
      await request.save();
      return res.status(404).json({ message: "Time entry not found" });
    }

    // Only support punchOut for now
    if (request.missingField !== "punchOut") {
      return res.status(400).json({ message: "Unsupported missingField" });
    }

    if (entry.punchOut) {
      return res
        .status(400)
        .json({ message: "Cannot approve: entry already has a punch out" });
    }

    const approvedBy =
      mongoose.Types.ObjectId.isValid(req.user?.caregiverId || req.user?.id)
        ? req.user?.caregiverId || req.user?.id
        : null;

    const correction = await TimeEntryCorrection.findOneAndUpdate(
      { timeEntry: entry._id, tenantId: adminTenantId },
      {
        $set: {
          tenantId: adminTenantId,
          caregiver: entry.caregiver,
          effectivePunchOut: request.requestedTime,
          sourceRequest: request._id,
          approvedBy,
        },
      },
      { upsert: true, new: true }
    );

    request.status = "approved";
    request.reviewedAt = new Date();
    request.reviewedBy = approvedBy;
    request.adminNote = (req.body?.adminNote || "").toString();
    await request.save();

    return res.json({ request, correction });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/admin/missed-punch-requests/:id/reject
exports.adminRejectMissedPunchRequest = async (req, res) => {
  try {
    const adminTenantId = req.user?.tenantId;
    if (!adminTenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const requestId = (req.params?.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "Invalid request id" });
    }

    const request = await MissedPunchRequest.findOne({
      _id: requestId,
      tenantId: adminTenantId,
    });
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Request is not pending (status=${request.status})` });
    }

    const reviewedBy =
      mongoose.Types.ObjectId.isValid(req.user?.caregiverId || req.user?.id)
        ? req.user?.caregiverId || req.user?.id
        : null;

    request.status = "rejected";
    request.reviewedAt = new Date();
    request.reviewedBy = reviewedBy;
    request.adminNote = (req.body?.adminNote || "").toString();
    await request.save();

    return res.json({ request });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

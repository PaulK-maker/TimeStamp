const mongoose = require("mongoose");

const Job = require("../models/Job");
const Staff = require("../models/staff");

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

async function resolveCurrentStaff(req) {
  const candidate = req.user?.staffId || req.user?.id;
  if (!candidate) return null;

  if (mongoose.Types.ObjectId.isValid(candidate)) {
    return Staff.findById(candidate).select("_id defaultJob tenantId");
  }

  return Staff.findOne({ clerkUserId: candidate }).select("_id defaultJob tenantId");
}

async function requireTenantId(req, res) {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    res.status(403).json({
      message: "Tenant is not assigned for this account.",
      code: "TENANT_REQUIRED",
    });
    return null;
  }
  return tenantId;
}

async function listJobs(req, res) {
  try {
    const tenantId = await requireTenantId(req, res);
    if (!tenantId) return;

    const includeInactive =
      req.user?.role === "admin" && String(req.query?.includeInactive || "").trim() === "true";

    const jobs = await Job.find({
      tenantId,
      ...(includeInactive ? {} : { isActive: true }),
    })
      .sort({ isActive: -1, name: 1 })
      .lean();

    return res.json({ count: jobs.length, jobs });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

async function listMyJobs(req, res) {
  try {
    const tenantId = await requireTenantId(req, res);
    if (!tenantId) return;

    const [staffMember, jobs] = await Promise.all([
      resolveCurrentStaff(req),
      Job.find({ tenantId, isActive: true }).sort({ name: 1 }).lean(),
    ]);

    return res.json({
      count: jobs.length,
      jobs,
      defaultJobId: staffMember?.defaultJob ? String(staffMember.defaultJob) : null,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

async function createJob(req, res) {
  try {
    const tenantId = await requireTenantId(req, res);
    if (!tenantId) return;

    const name = normalizeOptionalString(req.body?.name);
    if (!name) {
      return res.status(400).json({ message: "Job name is required" });
    }

    const job = await Job.create({
      tenantId,
      name,
      description: normalizeOptionalString(req.body?.description),
      gustoJobUuid: normalizeOptionalString(req.body?.gustoJobUuid),
      isActive: req.body?.isActive !== false,
    });

    return res.status(201).json({ job });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "A job with this name already exists" });
    }
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

async function updateJob(req, res) {
  try {
    const tenantId = await requireTenantId(req, res);
    if (!tenantId) return;

    const jobId = (req.params?.jobId || "").trim();
    if (!jobId) {
      return res.status(400).json({ message: "jobId is required" });
    }

    const job = await Job.findOne({ _id: jobId, tenantId });
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (req.body?.name !== undefined) {
      const name = normalizeOptionalString(req.body?.name);
      if (!name) {
        return res.status(400).json({ message: "Job name is required" });
      }
      job.name = name;
    }

    if (req.body?.description !== undefined) {
      job.description = normalizeOptionalString(req.body?.description);
    }

    if (req.body?.gustoJobUuid !== undefined) {
      job.gustoJobUuid = normalizeOptionalString(req.body?.gustoJobUuid);
    }

    if (req.body?.isActive !== undefined) {
      job.isActive = Boolean(req.body.isActive);
    }

    await job.save();

    return res.json({ job });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "A job with this name already exists" });
    }
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

module.exports = {
  listJobs,
  listMyJobs,
  createJob,
  updateJob,
};
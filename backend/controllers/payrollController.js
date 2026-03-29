const PayrollRun = require("../models/PayrollRun");
const PayrollRunItem = require("../models/PayrollRunItem");
const PayrollWebhookEvent = require("../models/PayrollWebhookEvent");
const Staff = require("../models/staff");
const TimeEntry = require("../models/TimeEntry");
const TimeEntryCorrection = require("../models/TimeEntryCorrection");

function parseDateInput(value, { endOfDay = false } = {}) {
  if (!value) return null;

  const isDateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (isDateOnly) {
    const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
    const parsed = new Date(`${value}${suffix}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function roundCurrency(value) {
  if (value === null || value === undefined) return null;
  return Math.round(value * 100) / 100;
}

function buildGrossPayPreview(profile, approvedMinutes) {
  const hours = approvedMinutes / 60;
  if (profile?.compensationType === "salary") {
    return profile.salaryAmount ?? null;
  }

  if (
    profile?.compensationType === "hourly" ||
    profile?.compensationType === "contractor"
  ) {
    if (typeof profile.payRate !== "number") return null;
    return roundCurrency(profile.payRate * hours);
  }

  return null;
}

function calculateApprovedMinutes(timeEntry, correctionByEntryId) {
  const correction = correctionByEntryId.get(String(timeEntry._id));
  const effectivePunchIn = correction?.effectivePunchIn || timeEntry.punchIn;
  const effectivePunchOut =
    correction && Object.prototype.hasOwnProperty.call(correction, "effectivePunchOut")
      ? correction.effectivePunchOut
      : timeEntry.punchOut;

  if (!effectivePunchIn || !effectivePunchOut) return 0;

  const durationMs = new Date(effectivePunchOut).getTime() - new Date(effectivePunchIn).getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 0;

  return Math.round(durationMs / 60000);
}

async function buildPayrollRunItems({ tenantId, payPeriodStart, payPeriodEnd }) {
  const staffMembers = await Staff.find({
    tenantId,
    isActive: true,
    "payrollProfile.payrollEligible": true,
  }).select("firstName lastName email payrollProfile");

  if (!staffMembers.length) {
    return {
      items: [],
      workerCount: 0,
      approvedMinutes: 0,
      grossPayPreview: null,
    };
  }

  const staffIds = staffMembers.map((staffMember) => staffMember._id);

  const timeEntries = await TimeEntry.find({
    tenantId,
    staff: { $in: staffIds },
    punchIn: { $gte: payPeriodStart, $lte: payPeriodEnd },
  }).select("staff punchIn punchOut");

  const corrections = await TimeEntryCorrection.find({
    tenantId,
    timeEntry: { $in: timeEntries.map((entry) => entry._id) },
  })
    .select("timeEntry effectivePunchIn effectivePunchOut")
    .lean();

  const correctionByEntryId = new Map(
    corrections.map((correction) => [String(correction.timeEntry), correction])
  );

  const approvedMinutesByStaffId = new Map();
  for (const entry of timeEntries) {
    const minutes = calculateApprovedMinutes(entry, correctionByEntryId);
    if (!minutes) continue;

    const key = String(entry.staff);
    approvedMinutesByStaffId.set(key, (approvedMinutesByStaffId.get(key) || 0) + minutes);
  }

  let totalApprovedMinutes = 0;
  let totalGrossPreview = 0;
  let hasGrossPreview = false;

  const items = staffMembers.map((staffMember) => {
    const approvedMinutes = approvedMinutesByStaffId.get(String(staffMember._id)) || 0;
    const grossPayPreview = buildGrossPayPreview(
      staffMember.payrollProfile || {},
      approvedMinutes
    );

    totalApprovedMinutes += approvedMinutes;
    if (grossPayPreview !== null) {
      totalGrossPreview += grossPayPreview;
      hasGrossPreview = true;
    }

    return {
      tenantId,
      staff: staffMember._id,
      providerEmployeeId:
        staffMember.payrollProfile?.payrollProviderEmployeeId || null,
      compensationTypeSnapshot:
        staffMember.payrollProfile?.compensationType || null,
      workerClassificationSnapshot:
        staffMember.payrollProfile?.workerClassification || null,
      payRateSnapshot:
        typeof staffMember.payrollProfile?.payRate === "number"
          ? staffMember.payrollProfile.payRate
          : null,
      salaryAmountSnapshot:
        typeof staffMember.payrollProfile?.salaryAmount === "number"
          ? staffMember.payrollProfile.salaryAmount
          : null,
      approvedMinutes,
      grossPayPreview,
      status: "pending",
    };
  });

  return {
    items,
    workerCount: items.length,
    approvedMinutes: totalApprovedMinutes,
    grossPayPreview: hasGrossPreview ? roundCurrency(totalGrossPreview) : null,
  };
}

async function listPayrollRuns(req, res) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const payrollRuns = await PayrollRun.find({ tenantId })
      .populate("createdBy", "firstName lastName email role")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ count: payrollRuns.length, payrollRuns });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

async function createPayrollRun(req, res) {
  try {
    const tenantId = req.user?.tenantId;
    const createdBy = req.user?.staffId || req.user?.id || null;
    if (!tenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const payPeriodStart = parseDateInput(req.body?.payPeriodStart);
    const payPeriodEnd = parseDateInput(req.body?.payPeriodEnd, { endOfDay: true });

    if (!payPeriodStart || !payPeriodEnd) {
      return res.status(400).json({
        message: "payPeriodStart and payPeriodEnd are required and must be valid dates",
      });
    }

    if (payPeriodEnd < payPeriodStart) {
      return res.status(400).json({
        message: "payPeriodEnd cannot be earlier than payPeriodStart",
      });
    }

    const summary = await buildPayrollRunItems({
      tenantId,
      payPeriodStart,
      payPeriodEnd,
    });

    const payrollRun = await PayrollRun.create({
      tenantId,
      provider: "gusto",
      payPeriodStart,
      payPeriodEnd,
      status: "draft",
      createdBy,
      totalsSummary: {
        workerCount: summary.workerCount,
        approvedMinutes: summary.approvedMinutes,
        grossPayPreview: summary.grossPayPreview,
      },
    });

    if (summary.items.length) {
      await PayrollRunItem.insertMany(
        summary.items.map((item) => ({
          ...item,
          payrollRun: payrollRun._id,
        }))
      );
    }

    const createdItems = await PayrollRunItem.find({ payrollRun: payrollRun._id })
      .populate("staff", "firstName lastName email payrollProfile")
      .sort({ createdAt: 1 })
      .lean();

    return res.status(201).json({
      message: "Payroll run created",
      payrollRun,
      items: createdItems,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

async function listPayrollWebhookEvents(req, res) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const events = await PayrollWebhookEvent.find({ tenantId })
      .sort({ receivedAt: -1, createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({ count: events.length, events });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

module.exports = {
  createPayrollRun,
  listPayrollRuns,
  listPayrollWebhookEvents,
};
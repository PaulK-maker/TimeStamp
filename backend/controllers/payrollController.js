const PayrollRun = require("../models/PayrollRun");
const PayrollRunItem = require("../models/PayrollRunItem");
const PayrollWebhookEvent = require("../models/PayrollWebhookEvent");
const Staff = require("../models/staff");
const TimeEntry = require("../models/TimeEntry");
const TimeEntryCorrection = require("../models/TimeEntryCorrection");
const {
  PayrollProviderError,
  isVerificationWebhook,
  parseWebhookPayload,
  sanitizeWebhookPayload,
  submitPayrollRun: submitPayrollRunToProvider,
  verifyPayrollWebhookSignature,
} = require("../config/gustoProvider");

function mapRunStatus(eventType) {
  const normalized = (eventType || "").toString().trim().toLowerCase();
  if (normalized === "payroll.submitted") return "submitted";
  if (["payroll.calculated", "payroll.processed"].includes(normalized)) return "processing";
  if (normalized === "payroll.paid") return "completed";
  if (normalized === "payroll.processing_failed") return "failed";
  if (["payroll.cancelled", "payroll.reversed"].includes(normalized)) return "cancelled";
  if (normalized === "payroll.partially_reversed") return "failed";
  return null;
}

function mapItemStatus(eventType) {
  const normalized = (eventType || "").toString().trim().toLowerCase();
  if (["payroll.submitted", "payroll.calculated", "payroll.processed"].includes(normalized)) {
    return "submitted";
  }
  if (normalized === "payroll.paid") return "completed";
  if (["payroll.processing_failed", "payroll.partially_reversed"].includes(normalized)) {
    return "failed";
  }
  if (["payroll.cancelled", "payroll.reversed"].includes(normalized)) return "skipped";
  return null;
}

async function findPayrollRunForWebhook(payload) {
  const providerPayrollId = (payload.entity_uuid || payload.providerPayrollId || payload.payrollId || "")
    .toString()
    .trim();

  if (providerPayrollId) {
    const byProviderId = await PayrollRun.findOne({ providerPayrollId });
    if (byProviderId) return byProviderId;
  }

  return null;
}

async function reconcilePayrollRunFromWebhook(payrollRun, payload) {
  const nextRunStatus = mapRunStatus(payload.event_type);
  if (nextRunStatus) {
    payrollRun.status = nextRunStatus;
  }

  if (payload.entity_uuid && !payrollRun.providerPayrollId) {
    payrollRun.providerPayrollId = payload.entity_uuid;
  }

  if (payrollRun.status === "completed") {
    payrollRun.completedAt = payload.timestamp ? new Date(Number(payload.timestamp) * 1000) : new Date();
    payrollRun.lastError = null;
  }

  if (payrollRun.status === "failed") {
    payrollRun.lastError =
      payload.event_type === "payroll.partially_reversed"
        ? "Gusto reported a partially reversed payroll. Manual review is required."
        : payrollRun.lastError || "Gusto reported payroll processing failure";
  }

  if (payrollRun.status === "cancelled") {
    payrollRun.lastError = null;
  }

  payrollRun.providerMetadata = {
    ...(payrollRun.providerMetadata || {}),
    lastWebhookEventType: payload.event_type || null,
    lastWebhookEntityType: payload.entity_type || null,
    lastWebhookEntityUuid: payload.entity_uuid || null,
    lastWebhookResourceUuid: payload.resource_uuid || null,
    lastWebhookReceivedAt: payload.timestamp ? new Date(Number(payload.timestamp) * 1000) : new Date(),
  };

  await payrollRun.save();
}

async function reconcilePayrollItemsFromWebhook(payrollRun, payload) {
  const items = await PayrollRunItem.find({ payrollRun: payrollRun._id, tenantId: payrollRun.tenantId });

  for (const localItem of items) {
    const nextItemStatus = mapItemStatus(payload.event_type);
    if (nextItemStatus) {
      localItem.status = nextItemStatus;
    }

    if (["payroll.processing_failed", "payroll.partially_reversed"].includes(payload.event_type)) {
      localItem.errorDetails = payrollRun.lastError || "Gusto payroll processing failed";
    } else if (["payroll.cancelled", "payroll.reversed", "payroll.paid"].includes(payload.event_type)) {
      localItem.errorDetails = null;
    }

    await localItem.save();
  }
}

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

function getPayrollProfileIssues(profile = {}, payPeriodStart, payPeriodEnd) {
  const issues = [];

  if (!profile.payrollEligible) {
    issues.push("payrollEligible must be true");
  }

  if (profile.employmentStatus && profile.employmentStatus !== "active") {
    issues.push("employmentStatus must be active");
  }

  if (!profile.compensationType) {
    issues.push("compensationType is required");
  }

  if (
    (profile.compensationType === "hourly" ||
      profile.compensationType === "contractor") &&
    typeof profile.payRate !== "number"
  ) {
    issues.push("payRate is required for hourly and contractor staff");
  }

  if (
    profile.compensationType === "salary" &&
    typeof profile.salaryAmount !== "number"
  ) {
    issues.push("salaryAmount is required for salary staff");
  }

  if (
    profile.payrollStartDate &&
    new Date(profile.payrollStartDate).getTime() > payPeriodEnd.getTime()
  ) {
    issues.push("payrollStartDate is after this pay period");
  }

  if (
    profile.payrollEndDate &&
    new Date(profile.payrollEndDate).getTime() < payPeriodStart.getTime()
  ) {
    issues.push("payrollEndDate is before this pay period");
  }

  return issues;
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

function getEffectiveTimeRange(timeEntry, correctionByEntryId) {
  const correction = correctionByEntryId.get(String(timeEntry._id));
  const effectivePunchIn = correction?.effectivePunchIn || timeEntry.punchIn;
  const effectivePunchOut =
    correction && Object.prototype.hasOwnProperty.call(correction, "effectivePunchOut")
      ? correction.effectivePunchOut
      : timeEntry.punchOut;

  if (!effectivePunchIn || !effectivePunchOut) {
    return null;
  }

  const start = new Date(effectivePunchIn);
  const end = new Date(effectivePunchOut);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }

  return { start, end };
}

function startOfUtcDay(value) {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function getAnchoredWeekStartMs(value, anchorStartMs) {
  const currentDayMs = startOfUtcDay(value);
  const dayOffset = Math.floor((currentDayMs - anchorStartMs) / 86400000);
  const normalizedDayOffset = dayOffset >= 0 ? dayOffset : dayOffset - 6;
  const weekOffset = Math.floor(normalizedDayOffset / 7);
  return anchorStartMs + weekOffset * 7 * 86400000;
}

function addWeeklyDurationMs(weeklyDurationMs, start, end, anchorStartMs) {
  let cursorMs = start.getTime();
  const endMs = end.getTime();

  while (cursorMs < endMs) {
    const weekStartMs = getAnchoredWeekStartMs(new Date(cursorMs), anchorStartMs);
    const weekEndMs = weekStartMs + 7 * 86400000;
    const segmentEndMs = Math.min(endMs, weekEndMs);
    const weekKey = new Date(weekStartMs).toISOString().slice(0, 10);
    weeklyDurationMs.set(weekKey, (weeklyDurationMs.get(weekKey) || 0) + (segmentEndMs - cursorMs));
    cursorMs = segmentEndMs;
  }
}

function splitRangeIntoAnchoredWeekSegments(start, end, anchorStartMs) {
  const segments = [];
  let cursorMs = start.getTime();
  const endMs = end.getTime();

  while (cursorMs < endMs) {
    const weekStartMs = getAnchoredWeekStartMs(new Date(cursorMs), anchorStartMs);
    const weekEndMs = weekStartMs + 7 * 86400000;
    const segmentEndMs = Math.min(endMs, weekEndMs);
    segments.push({
      weekKey: new Date(weekStartMs).toISOString().slice(0, 10),
      startMs: cursorMs,
      endMs: segmentEndMs,
    });
    cursorMs = segmentEndMs;
  }

  return segments;
}

function getTimeEntryJobContext(timeEntry) {
  const snapshot = timeEntry?.jobSnapshot || {};
  const fallbackJob = timeEntry?.job || {};
  const jobId = snapshot.jobId || fallbackJob._id || timeEntry?.job || null;

  return {
    jobId: jobId ? String(jobId) : null,
    name: snapshot.name || fallbackJob.name || null,
    gustoJobUuid: snapshot.gustoJobUuid || fallbackJob.gustoJobUuid || null,
  };
}

function getJobBucketKey(jobContext = {}) {
  if (jobContext.gustoJobUuid) {
    return `gusto:${jobContext.gustoJobUuid}`;
  }

  if (jobContext.jobId) {
    return `local:${jobContext.jobId}`;
  }

  return "legacy:unmapped";
}

function addMinutesToJobBucket(jobBucketsByKey, jobContext, regularMinutes, overtimeMinutes) {
  const safeRegular = Math.max(regularMinutes || 0, 0);
  const safeOvertime = Math.max(overtimeMinutes || 0, 0);
  const totalMinutes = safeRegular + safeOvertime;
  if (!totalMinutes) return;

  const bucketKey = getJobBucketKey(jobContext);
  const existing = jobBucketsByKey.get(bucketKey) || {
    jobId: jobContext.jobId || null,
    name: jobContext.name || (jobContext.jobId ? null : "Unmapped legacy hours"),
    gustoJobUuid: jobContext.gustoJobUuid || null,
    totalMinutes: 0,
    regularMinutes: 0,
    overtimeMinutes: 0,
    doubleOvertimeMinutes: 0,
  };

  existing.totalMinutes += totalMinutes;
  existing.regularMinutes += safeRegular;
  existing.overtimeMinutes += safeOvertime;
  jobBucketsByKey.set(bucketKey, existing);
}

async function buildGustoHourDistributionContext({ tenantId, payrollRun, items }) {
  if (!items.length) {
    return { byEmployeeId: {} };
  }

  const staffIds = items.map((item) => item.staff?._id || item.staff).filter(Boolean);
  const payPeriodStart = payrollRun.payPeriodStart;
  const payPeriodEnd = payrollRun.payPeriodEnd;

  const timeEntries = await TimeEntry.find({
    tenantId,
    staff: { $in: staffIds },
    punchIn: { $gte: payPeriodStart, $lte: payPeriodEnd },
  })
    .select("staff punchIn punchOut job jobSnapshot")
    .populate("job", "name gustoJobUuid");

  const corrections = await TimeEntryCorrection.find({
    tenantId,
    timeEntry: { $in: timeEntries.map((entry) => entry._id) },
  })
    .select("timeEntry effectivePunchIn effectivePunchOut")
    .lean();

  const correctionByEntryId = new Map(
    corrections.map((correction) => [String(correction.timeEntry), correction])
  );

  const anchorStartMs = startOfUtcDay(payPeriodStart);
  const entriesByStaffId = new Map();

  for (const entry of timeEntries) {
    const effectiveRange = getEffectiveTimeRange(entry, correctionByEntryId);
    if (!effectiveRange) continue;

    const staffId = String(entry.staff);
    const existingEntries = entriesByStaffId.get(staffId) || [];
    existingEntries.push({
      start: effectiveRange.start,
      end: effectiveRange.end,
      jobContext: getTimeEntryJobContext(entry),
    });
    entriesByStaffId.set(staffId, existingEntries);
  }

  for (const staffEntries of entriesByStaffId.values()) {
    staffEntries.sort((left, right) => left.start.getTime() - right.start.getTime());
  }

  const byEmployeeId = {};

  for (const item of items) {
    const employeeId = String(item.providerEmployeeId || "").trim();
    if (!employeeId) continue;

    const staffId = String(item.staff?._id || item.staff);
    const staffEntries = entriesByStaffId.get(staffId) || [];
    const weeklyMinutesByWeekKey = new Map();
    const weeklyBreakdownByWeekKey = new Map();
    const jobBucketsByKey = new Map();
    let totalMinutes = 0;
    let regularMinutes = 0;
    let overtimeMinutes = 0;

    for (const entry of staffEntries) {
      const weeklySegments = splitRangeIntoAnchoredWeekSegments(
        entry.start,
        entry.end,
        anchorStartMs
      );

      for (const segment of weeklySegments) {
        const segmentMinutes = Math.round((segment.endMs - segment.startMs) / 60000);
        if (!segmentMinutes) continue;

        const priorWeekMinutes = weeklyMinutesByWeekKey.get(segment.weekKey) || 0;
        const regularRemaining = Math.max(40 * 60 - priorWeekMinutes, 0);
        const segmentRegularMinutes = Math.min(segmentMinutes, regularRemaining);
        const segmentOvertimeMinutes = Math.max(segmentMinutes - segmentRegularMinutes, 0);

        weeklyMinutesByWeekKey.set(segment.weekKey, priorWeekMinutes + segmentMinutes);

        const weeklyBreakdown = weeklyBreakdownByWeekKey.get(segment.weekKey) || {
          weekStart: segment.weekKey,
          totalMinutes: 0,
          regularMinutes: 0,
          overtimeMinutes: 0,
        };

        weeklyBreakdown.totalMinutes += segmentMinutes;
        weeklyBreakdown.regularMinutes += segmentRegularMinutes;
        weeklyBreakdown.overtimeMinutes += segmentOvertimeMinutes;
        weeklyBreakdownByWeekKey.set(segment.weekKey, weeklyBreakdown);

        totalMinutes += segmentMinutes;
        regularMinutes += segmentRegularMinutes;
        overtimeMinutes += segmentOvertimeMinutes;

        addMinutesToJobBucket(
          jobBucketsByKey,
          entry.jobContext,
          segmentRegularMinutes,
          segmentOvertimeMinutes
        );
      }
    }

    if (!staffEntries.length) {
      totalMinutes = item.approvedMinutes || 0;
      regularMinutes = item.approvedMinutes || 0;
      overtimeMinutes = 0;
    }

    byEmployeeId[employeeId] = {
      totalMinutes,
      regularMinutes,
      overtimeMinutes,
      doubleOvertimeMinutes: 0,
      weeklyBreakdown: Array.from(weeklyBreakdownByWeekKey.values()),
      jobBuckets: Array.from(jobBucketsByKey.values()).sort((left, right) => {
        const leftName = String(left.name || left.gustoJobUuid || left.jobId || "");
        const rightName = String(right.name || right.gustoJobUuid || right.jobId || "");
        return leftName.localeCompare(rightName);
      }),
    };
  }

  return { byEmployeeId };
}

async function buildPayrollRunItems({ tenantId, payPeriodStart, payPeriodEnd }) {
  const staffMembers = await Staff.find({
    tenantId,
    isActive: true,
    "payrollProfile.payrollEligible": true,
  }).select("firstName lastName email payrollProfile");

  const invalidStaff = [];
  const eligibleStaffMembers = [];

  for (const staffMember of staffMembers) {
    const issues = getPayrollProfileIssues(
      staffMember.payrollProfile || {},
      payPeriodStart,
      payPeriodEnd
    );

    if (issues.length) {
      invalidStaff.push({
        staffId: staffMember._id,
        firstName: staffMember.firstName,
        lastName: staffMember.lastName,
        email: staffMember.email,
        issues,
      });
      continue;
    }

    eligibleStaffMembers.push(staffMember);
  }

  if (!eligibleStaffMembers.length) {
    return {
      items: [],
      workerCount: 0,
      approvedMinutes: 0,
      grossPayPreview: null,
      invalidStaff,
    };
  }

  const staffIds = eligibleStaffMembers.map((staffMember) => staffMember._id);

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

  const items = eligibleStaffMembers.map((staffMember) => {
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
    invalidStaff,
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

async function submitPayrollRun(req, res) {
  try {
    const tenantId = req.user?.tenantId;
    const submittedBy = req.user?.staffId || req.user?.id || null;
    const runId = (req.params?.runId || "").trim();

    if (!tenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    if (!runId) {
      return res.status(400).json({ message: "runId is required" });
    }

    const payrollRun = await PayrollRun.findOne({ _id: runId, tenantId });
    if (!payrollRun) {
      return res.status(404).json({ message: "Payroll run not found" });
    }

    if (payrollRun.status !== "draft") {
      return res.status(409).json({
        message: "Only draft payroll runs can be submitted",
        currentStatus: payrollRun.status,
      });
    }

    const items = await PayrollRunItem.find({ payrollRun: payrollRun._id, tenantId })
      .populate("staff", "firstName lastName email")
      .sort({ createdAt: 1 });

    if (!items.length) {
      return res.status(400).json({
        message: "Payroll run has no items to submit",
      });
    }

    const blockingItems = items
      .filter((item) => !item.providerEmployeeId)
      .map((item) => ({
        payrollRunItemId: item._id.toString(),
        staffId: item.staff?._id ? item.staff._id.toString() : String(item.staff),
        firstName: item.staff?.firstName || null,
        lastName: item.staff?.lastName || null,
        email: item.staff?.email || null,
        issue: "providerEmployeeId is required before provider submission",
      }));

    if (blockingItems.length) {
      return res.status(400).json({
        message: "Resolve payroll item provider linkage before submission",
        blockingItems,
      });
    }

    const gustoHourDistribution = await buildGustoHourDistributionContext({
      tenantId,
      payrollRun,
      items,
    });

    const providerResult = await submitPayrollRunToProvider(payrollRun, items, {
      gustoHourDistribution,
    });

    payrollRun.status = "submitted";
    payrollRun.providerPayrollId = providerResult.providerPayrollId;
    payrollRun.submittedAt = providerResult.submittedAt;
    payrollRun.lastError = null;
    payrollRun.providerMetadata = {
      ...(payrollRun.providerMetadata || {}),
      lastSubmittedBy: submittedBy,
      ...providerResult.providerMetadata,
    };
    await payrollRun.save();

    const itemResultById = new Map(
      (providerResult.itemResults || []).map((itemResult) => [
        itemResult.payrollRunItemId,
        itemResult,
      ])
    );

    for (const item of items) {
      const itemResult = itemResultById.get(item._id.toString());
      item.status = "submitted";
      item.errorDetails = null;
      if (itemResult?.providerPayItemId) {
        item.providerPayItemId = itemResult.providerPayItemId;
      }
      await item.save();
    }

    const updatedItems = await PayrollRunItem.find({ payrollRun: payrollRun._id, tenantId })
      .populate("staff", "firstName lastName email")
      .sort({ createdAt: 1 })
      .lean();

    return res.status(202).json({
      message: "Payroll run submitted to provider",
      payrollRun,
      items: updatedItems,
    });
  } catch (error) {
    if (error instanceof PayrollProviderError) {
      return res.status(error.statusCode || 500).json({
        message: error.message,
        code: error.code,
        details: error.details,
      });
    }

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

    const existingPayrollRun = await PayrollRun.findOne({
      tenantId,
      payPeriodStart,
      payPeriodEnd,
    })
      .select("_id status createdAt")
      .lean();

    if (existingPayrollRun) {
      return res.status(409).json({
        message: "A payroll run already exists for this pay period",
        existingPayrollRun,
      });
    }

    const summary = await buildPayrollRunItems({
      tenantId,
      payPeriodStart,
      payPeriodEnd,
    });

    if (summary.invalidStaff.length) {
      return res.status(400).json({
        message:
          "Resolve staff payroll profile issues before creating a payroll draft",
        invalidStaff: summary.invalidStaff,
      });
    }

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
      message: "Draft payroll run created",
      payrollRun,
      items: createdItems,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "A payroll run already exists for this pay period",
      });
    }

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

async function handlePayrollWebhook(req, res) {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const parsedPayload = parseWebhookPayload(rawBody);

    if (isVerificationWebhook(parsedPayload)) {
      const token = parsedPayload.verification_token || "";
      // Only log the token if GUSTO_WEBHOOK_VERIFICATION_TOKEN is not yet configured —
      // once it is set, logging it would expose the HMAC secret to anyone with log access.
      if (!process.env.GUSTO_WEBHOOK_VERIFICATION_TOKEN) {
        console.log("=== GUSTO WEBHOOK VERIFICATION TOKEN ===");
        console.log(token);
        console.log("========================================");
        console.log("Copy the token above and set it as GUSTO_WEBHOOK_VERIFICATION_TOKEN in Render environment variables.");
      } else {
        console.log("Gusto webhook verification ping received — token already configured, not logging.");
      }
      return res.status(200).json({
        message: "Gusto webhook verification token received",
      });
    }

    verifyPayrollWebhookSignature(rawBody, req.headers);

    if (parsedPayload.entity_type !== "Payroll") {
      return res.status(200).json({
        message: "Gusto webhook ignored because entity_type is not Payroll",
      });
    }

    const sanitizedPayload = sanitizeWebhookPayload(parsedPayload);
    const payrollRun = await findPayrollRunForWebhook(parsedPayload);

    const tenantId = payrollRun?.tenantId || null;
    if (!tenantId) {
      return res.status(400).json({
        message: "Unable to resolve tenant for Gusto payroll webhook event",
      });
    }

    const eventType = sanitizedPayload.eventType || "unknown";
    const providerEventId = sanitizedPayload.uuid;

    if (!providerEventId) {
      return res.status(400).json({
        message: "Gusto payroll webhook did not include uuid",
      });
    }

    let webhookEvent;
    try {
      webhookEvent = await PayrollWebhookEvent.create({
        tenantId,
        provider: "gusto",
        eventType,
        providerEventId,
        status: "received",
        linkedPayrollRunIds: payrollRun ? [payrollRun._id] : [],
        sanitizedPayload,
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(200).json({ message: "Duplicate payroll webhook ignored" });
      }
      throw error;
    }

    if (payrollRun) {
      await reconcilePayrollRunFromWebhook(payrollRun, parsedPayload);
      await reconcilePayrollItemsFromWebhook(payrollRun, parsedPayload);
    }

    webhookEvent.status = payrollRun ? "processed" : "ignored";
    webhookEvent.lastError = payrollRun ? null : "Payroll run was not found for this webhook event";
    await webhookEvent.save();

    return res.status(200).json({
      message: payrollRun ? "Gusto payroll webhook processed" : "Gusto payroll webhook recorded without matching payroll run",
    });
  } catch (error) {
    if (error instanceof PayrollProviderError) {
      return res.status(error.statusCode || 500).json({
        message: error.message,
        code: error.code,
        details: error.details,
      });
    }

    return res.status(500).json({ message: error.message || "Server error" });
  }
}

module.exports = {
  createPayrollRun,
  handlePayrollWebhook,
  listPayrollRuns,
  listPayrollWebhookEvents,
  submitPayrollRun,
};
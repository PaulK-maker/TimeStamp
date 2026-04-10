const axios = require("axios");
const crypto = require("crypto");

class PayrollProviderError extends Error {
  constructor(message, { statusCode = 500, code = "PAYROLL_PROVIDER_ERROR", details = null } = {}) {
    super(message);
    this.name = "PayrollProviderError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function getPayrollProviderMode() {
  return (process.env.PAYROLL_PROVIDER_MODE || "disabled").trim().toLowerCase();
}

function getGustoProviderConfig() {
  return {
    mode: getPayrollProviderMode(),
    apiBaseUrl: (process.env.GUSTO_API_BASE_URL || "https://api.gusto-demo.com").trim(),
    companyAccessToken: (
      process.env.GUSTO_COMPANY_ACCESS_TOKEN ||
      process.env.GUSTO_API_TOKEN ||
      ""
    ).trim(),
    companyId: (process.env.GUSTO_COMPANY_ID || "").trim() || null,
    webhookVerificationToken: (
      process.env.GUSTO_WEBHOOK_VERIFICATION_TOKEN ||
      process.env.PAYROLL_WEBHOOK_SECRET ||
      ""
    ).trim(),
  };
}

function getWebhookSignature(headers = {}) {
  return headers["x-gusto-signature"] || headers["X-Gusto-Signature"] || null;
}

function parseWebhookPayload(rawBody) {
  try {
    return JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody || "{}"));
  } catch (error) {
    throw new PayrollProviderError("Invalid Gusto webhook JSON payload.", {
      statusCode: 400,
      code: "GUSTO_WEBHOOK_INVALID_JSON",
    });
  }
}

function isVerificationWebhook(payload = {}) {
  return Boolean(payload && typeof payload.verification_token === "string" && payload.verification_token.trim());
}

function verifyPayrollWebhookSignature(rawBody, headers = {}) {
  const config = getGustoProviderConfig();
  const signature = getWebhookSignature(headers);

  if (config.mode === "mock" && !config.webhookVerificationToken) {
    return true;
  }

  if (!config.webhookVerificationToken) {
    throw new PayrollProviderError(
      "Gusto webhook verification token is not configured.",
      { statusCode: 503, code: "GUSTO_WEBHOOK_VERIFICATION_TOKEN_MISSING" }
    );
  }

  if (!signature) {
    throw new PayrollProviderError(
      "Gusto webhook signature is missing.",
      { statusCode: 401, code: "GUSTO_WEBHOOK_SIGNATURE_MISSING" }
    );
  }

  const digest = crypto
    .createHmac("sha256", config.webhookVerificationToken)
    .update(rawBody)
    .digest("hex");

  const provided = String(signature).trim().toLowerCase();
  const normalizedProvided = provided.startsWith("sha256=")
    ? provided.slice("sha256=".length)
    : provided;

  const expectedBuffer = Buffer.from(digest, "hex");
  const providedBuffer = Buffer.from(normalizedProvided, "hex");

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw new PayrollProviderError(
      "Gusto webhook signature verification failed.",
      { statusCode: 401, code: "GUSTO_WEBHOOK_SIGNATURE_INVALID" }
    );
  }

  return true;
}

function sanitizeWebhookPayload(payload = {}) {
  return {
    uuid: payload.uuid || null,
    eventType: payload.event_type || null,
    resourceType: payload.resource_type || null,
    resourceUuid: payload.resource_uuid || null,
    entityType: payload.entity_type || null,
    entityUuid: payload.entity_uuid || null,
    timestamp: payload.timestamp || null,
  };
}

function buildSubmissionPayload(payrollRun, items, config) {
  return {
    companyId: config.companyId,
    externalPayrollRunId: payrollRun._id.toString(),
    payPeriodStart: payrollRun.payPeriodStart,
    payPeriodEnd: payrollRun.payPeriodEnd,
    workerCount: items.length,
    approvedMinutes: payrollRun.totalsSummary?.approvedMinutes ?? 0,
    grossPayPreview: payrollRun.totalsSummary?.grossPayPreview ?? null,
    workers: items.map((item) => ({
      payrollRunItemId: item._id.toString(),
      staffId: item.staff?._id ? item.staff._id.toString() : String(item.staff),
      providerEmployeeId: item.providerEmployeeId,
      compensationType: item.compensationTypeSnapshot,
      workerClassification: item.workerClassificationSnapshot,
      approvedMinutes: item.approvedMinutes,
      grossPayPreview: item.grossPayPreview,
      payRate: item.payRateSnapshot,
      salaryAmount: item.salaryAmountSnapshot,
    })),
  };
}

function formatDateOnly(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new PayrollProviderError("Invalid payroll date for Gusto request.", {
      statusCode: 400,
      code: "GUSTO_INVALID_PAY_PERIOD",
      details: { value },
    });
  }

  return parsed.toISOString().slice(0, 10);
}

function formatHoursFromMinutes(minutes) {
  const normalized = Number(minutes || 0) / 60;
  return normalized.toFixed(3);
}

function parseHoursToUnits(hours) {
  const numeric = Number.parseFloat(hours || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric * 1000);
}

function formatUnitsToHours(units) {
  return (Math.max(0, units) / 1000).toFixed(3);
}

function getGustoHeaders(config, extraHeaders = {}) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${config.companyAccessToken}`,
    ...extraHeaders,
  };
}

function getGustoPollingConfig() {
  const timeoutMs = Number(process.env.GUSTO_PROCESSING_TIMEOUT_MS || 45000);
  const intervalMs = Number(process.env.GUSTO_PROCESSING_POLL_INTERVAL_MS || 1500);

  return {
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 45000,
    intervalMs: Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 1500,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flattenGustoErrors(errors = []) {
  const messages = [];

  for (const error of errors) {
    if (error?.message) {
      messages.push(error.message);
    }
    if (Array.isArray(error?.errors) && error.errors.length) {
      messages.push(...flattenGustoErrors(error.errors));
    }
  }

  return messages.filter(Boolean);
}

function getGustoProcessingStatus(payroll = {}) {
  return payroll?.processing_request?.status || null;
}

function getGustoProcessingErrors(payroll = {}) {
  return Array.isArray(payroll?.processing_request?.errors)
    ? payroll.processing_request.errors
    : [];
}

function distributeUnitsAcrossRows(totalUnits, rows) {
  if (!rows.length) return [];
  if (rows.length === 1) return [totalUnits];

  const sourceWeights = rows.map((row) => parseHoursToUnits(row?.hours));
  const weightSum = sourceWeights.reduce((sum, value) => sum + value, 0);
  const effectiveWeights = weightSum > 0 ? sourceWeights : rows.map(() => 1);
  const effectiveWeightSum = effectiveWeights.reduce((sum, value) => sum + value, 0);

  const allocations = rows.map((_, index) => {
    const raw = (totalUnits * effectiveWeights[index]) / effectiveWeightSum;
    return {
      index,
      units: Math.floor(raw),
      remainder: raw - Math.floor(raw),
    };
  });

  let remainingUnits = totalUnits - allocations.reduce((sum, entry) => sum + entry.units, 0);
  allocations
    .slice()
    .sort((left, right) => right.remainder - left.remainder)
    .forEach((entry) => {
      if (remainingUnits <= 0) return;
      allocations[entry.index].units += 1;
      remainingUnits -= 1;
    });

  return allocations.map((entry) => entry.units);
}

function applyDistributedHours(rows, totalHoursString) {
  const totalUnits = parseHoursToUnits(totalHoursString);
  const allocations = distributeUnitsAcrossRows(totalUnits, rows);
  return rows.map((row, index) => ({
    ...row,
    hours: formatUnitsToHours(allocations[index] || 0),
  }));
}

function zeroOutRows(rows) {
  return rows.map((row) => ({
    ...row,
    hours: "0.000",
  }));
}

function getHourlyRowsByName(hourlyCompensations, name) {
  return hourlyCompensations.filter((entry) => entry?.name === name);
}

function getHourlyRowsByJobUuid(hourlyCompensations, jobUuid) {
  return hourlyCompensations.filter(
    (entry) => String(entry?.job_uuid || "").trim() === String(jobUuid || "").trim()
  );
}

function replaceHourlyRows(hourlyCompensations, replacementsByReference) {
  return hourlyCompensations.map((entry) => replacementsByReference.get(entry) || entry);
}

function buildCompanyPayrollsUrl(companyUuid, config, query = "") {
  const baseUrl = (config.apiBaseUrl || "https://api.gusto-demo.com").replace(/\/+$/, "");
  return `${baseUrl}/v1/companies/${encodeURIComponent(companyUuid)}/payrolls${query}`;
}

function buildSinglePayrollUrl(companyUuid, payrollUuid, config, query = "") {
  return `${buildCompanyPayrollsUrl(companyUuid, config)}/${encodeURIComponent(payrollUuid)}${query}`;
}

function getLinkedGustoPayrollUuid(payrollRun) {
  return (
    payrollRun?.providerMetadata?.gustoPayrollUuid ||
    payrollRun?.providerPayrollId ||
    null
  );
}

function getLinkedGustoCompanyUuid(payrollRun, config) {
  return (
    payrollRun?.providerMetadata?.gustoCompanyUuid ||
    config.companyId ||
    null
  );
}

function buildGustoSubmitPayrollUrl(companyUuid, payrollUuid, config) {
  return `${buildSinglePayrollUrl(companyUuid, payrollUuid, config)}/submit`;
}

function buildGustoPreparePayrollUrl(companyUuid, payrollUuid, config) {
  return `${buildSinglePayrollUrl(companyUuid, payrollUuid, config)}/prepare`;
}

function buildGustoCalculatePayrollUrl(companyUuid, payrollUuid, config) {
  return `${buildSinglePayrollUrl(companyUuid, payrollUuid, config)}/calculate`;
}

function extractGustoErrorMessage(error) {
  const data = error?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length) {
    const nestedMessage = data.errors
      .flatMap((entry) => {
        if (Array.isArray(entry?.errors) && entry.errors.length) {
          return entry.errors.map((nested) => nested?.message).filter(Boolean);
        }
        return [entry?.message].filter(Boolean);
      })
      .filter(Boolean)
      .join("; ");

    if (nestedMessage) return nestedMessage;
  }

  return data?.message || data?.error || error?.message || "Gusto payroll submission failed";
}

function buildLiveSubmissionMetadata(response, companyUuid, payrollUuid) {
  return {
    mode: "live",
    gustoCompanyUuid: companyUuid,
    gustoPayrollUuid: payrollUuid,
    responseStatus: response.status,
    processed: response.data?.processed ?? null,
    processedDate: response.data?.processed_date ?? null,
    calculatedAt: response.data?.calculated_at ?? null,
    checkDate: response.data?.check_date ?? null,
    payrollDeadline: response.data?.payroll_deadline ?? null,
    payrollStatusMeta: response.data?.payroll_status_meta ?? null,
    processingRequest: response.data?.processing_request ?? null,
    response: response.data || null,
  };
}

async function listMatchingGustoPayrolls(companyUuid, payrollRun, config) {
  const startDate = formatDateOnly(payrollRun.payPeriodStart);
  const endDate = formatDateOnly(payrollRun.payPeriodEnd);
  const query = `?processing_statuses=unprocessed&payroll_types=regular,off_cycle&start_date=${encodeURIComponent(
    startDate
  )}&end_date=${encodeURIComponent(endDate)}`;

  const response = await axios.get(buildCompanyPayrollsUrl(companyUuid, config, query), {
    headers: getGustoHeaders(config),
    timeout: 30000,
  });

  const payrolls = Array.isArray(response.data) ? response.data : [];
  return payrolls.filter((payroll) => {
    const upstreamStart = payroll?.pay_period?.start_date || null;
    const upstreamEnd = payroll?.pay_period?.end_date || null;
    return upstreamStart === startDate && upstreamEnd === endDate;
  });
}

async function resolveGustoPayrollForRun(payrollRun, config) {
  const companyUuid = getLinkedGustoCompanyUuid(payrollRun, config);
  const linkedPayrollUuid = getLinkedGustoPayrollUuid(payrollRun);

  if (!companyUuid) {
    throw new PayrollProviderError("Gusto company UUID is required for live payroll orchestration.", {
      statusCode: 503,
      code: "GUSTO_COMPANY_UUID_MISSING",
    });
  }

  if (linkedPayrollUuid) {
    return {
      companyUuid,
      payrollUuid: linkedPayrollUuid,
      matchedBy: "stored-link",
    };
  }

  const matchingPayrolls = await listMatchingGustoPayrolls(companyUuid, payrollRun, config);

  if (!matchingPayrolls.length) {
    throw new PayrollProviderError(
      "No unprocessed Gusto payroll was found for the requested pay period.",
      {
        statusCode: 404,
        code: "GUSTO_PAYROLL_NOT_FOUND",
        details: {
          companyUuid,
          payPeriodStart: formatDateOnly(payrollRun.payPeriodStart),
          payPeriodEnd: formatDateOnly(payrollRun.payPeriodEnd),
        },
      }
    );
  }

  if (matchingPayrolls.length > 1) {
    throw new PayrollProviderError(
      "Multiple Gusto payrolls matched this pay period. Link the exact payroll_uuid before retrying.",
      {
        statusCode: 409,
        code: "GUSTO_PAYROLL_AMBIGUOUS",
        details: {
          companyUuid,
          matches: matchingPayrolls.map((payroll) => ({
            payroll_uuid: payroll.payroll_uuid,
            payroll_type: payroll.payroll_type || null,
            pay_period: payroll.pay_period || null,
            payroll_deadline: payroll.payroll_deadline || null,
          })),
        },
      }
    );
  }

  return {
    companyUuid,
    payrollUuid: matchingPayrolls[0].payroll_uuid,
    matchedBy: "pay-period-lookup",
    lookupResult: matchingPayrolls[0],
  };
}

async function prepareGustoPayroll(companyUuid, payrollUuid, config) {
  const response = await axios.put(
    buildGustoPreparePayrollUrl(companyUuid, payrollUuid, config),
    null,
    {
      headers: getGustoHeaders(config, { "Content-Type": "application/json" }),
      timeout: 30000,
    }
  );

  return response.data;
}

function buildUpdatedEmployeeCompensations(preparedPayroll, items, options = {}) {
  const employeeCompensations = Array.isArray(preparedPayroll?.employee_compensations)
    ? preparedPayroll.employee_compensations
    : [];
  const gustoHourDistributionByEmployeeId =
    options?.gustoHourDistribution?.byEmployeeId || {};

  if (!employeeCompensations.length) {
    throw new PayrollProviderError("Gusto prepare response did not include employee compensations.", {
      statusCode: 502,
      code: "GUSTO_PREPARE_MISSING_EMPLOYEE_COMPENSATIONS",
    });
  }

  const itemByEmployeeUuid = new Map();
  const duplicateEmployeeIds = [];
  for (const item of items) {
    const employeeUuid = String(item.providerEmployeeId || "").trim();
    if (!employeeUuid) continue;
    if (itemByEmployeeUuid.has(employeeUuid)) {
      duplicateEmployeeIds.push(employeeUuid);
      continue;
    }
    itemByEmployeeUuid.set(employeeUuid, item);
  }

  if (duplicateEmployeeIds.length) {
    throw new PayrollProviderError(
      "Duplicate Gusto employee UUIDs were found in this payroll run.",
      {
        statusCode: 400,
        code: "GUSTO_DUPLICATE_EMPLOYEE_UUIDS",
        details: { duplicateEmployeeIds },
      }
    );
  }

  const unsupportedEmployees = [];
  const matchedEmployeeUuids = new Set();

  const updatedCompensations = employeeCompensations.map((compensation) => {
    const employeeUuid = String(compensation.employee_uuid || "").trim();
    const localItem = itemByEmployeeUuid.get(employeeUuid);

    if (!localItem) {
      return {
        ...compensation,
        excluded: true,
      };
    }

    matchedEmployeeUuids.add(employeeUuid);

    if (localItem.compensationTypeSnapshot === "contractor") {
      unsupportedEmployees.push({
        employeeUuid,
        payrollRunItemId: localItem._id.toString(),
        reason: "Contractors are not supported in Gusto regular payroll employee_compensations flows.",
      });
      return compensation;
    }

    if (localItem.compensationTypeSnapshot !== "hourly") {
      return {
        ...compensation,
        excluded: false,
      };
    }

    const hourlyCompensations = Array.isArray(compensation.hourly_compensations)
      ? compensation.hourly_compensations
      : [];
    const regularRows = getHourlyRowsByName(hourlyCompensations, "Regular Hours");
    const overtimeRows = getHourlyRowsByName(hourlyCompensations, "Overtime");
    const doubleOvertimeRows = getHourlyRowsByName(hourlyCompensations, "Double overtime");
    const hasEditableRegularHours = regularRows.length > 0;

    if (!hasEditableRegularHours) {
      unsupportedEmployees.push({
        employeeUuid,
        payrollRunItemId: localItem._id.toString(),
        reason: "Hourly employee is missing a Gusto 'Regular Hours' compensation row.",
      });
      return compensation;
    }

    const localDistribution = gustoHourDistributionByEmployeeId[employeeUuid] || {
      totalMinutes: localItem.approvedMinutes || 0,
      regularMinutes: localItem.approvedMinutes || 0,
      overtimeMinutes: 0,
      doubleOvertimeMinutes: 0,
    };

    const jobBuckets = Array.isArray(localDistribution.jobBuckets)
      ? localDistribution.jobBuckets.filter((bucket) => (bucket?.totalMinutes || 0) > 0)
      : [];
    const hasExactJobBuckets = jobBuckets.length > 0;

    if (hasExactJobBuckets) {
      const unmappedJobBuckets = jobBuckets.filter((bucket) => !bucket?.gustoJobUuid);
      if (unmappedJobBuckets.length) {
        unsupportedEmployees.push({
          employeeUuid,
          payrollRunItemId: localItem._id.toString(),
          reason: "Local hours include jobs that are not linked to a Gusto job_uuid.",
          details: {
            jobBuckets: unmappedJobBuckets,
          },
        });
        return compensation;
      }

      const replacements = new Map();
      zeroOutRows(regularRows).forEach((row, index) => {
        replacements.set(regularRows[index], row);
      });
      zeroOutRows(overtimeRows).forEach((row, index) => {
        replacements.set(overtimeRows[index], row);
      });
      zeroOutRows(doubleOvertimeRows).forEach((row, index) => {
        replacements.set(doubleOvertimeRows[index], row);
      });

      for (const bucket of jobBuckets) {
        const bucketRegularRows = getHourlyRowsByJobUuid(regularRows, bucket.gustoJobUuid);
        const bucketOvertimeRows = getHourlyRowsByJobUuid(overtimeRows, bucket.gustoJobUuid);
        const bucketDoubleOvertimeRows = getHourlyRowsByJobUuid(
          doubleOvertimeRows,
          bucket.gustoJobUuid
        );

        if ((bucket.regularMinutes || 0) > 0 && !bucketRegularRows.length) {
          unsupportedEmployees.push({
            employeeUuid,
            payrollRunItemId: localItem._id.toString(),
            reason: "Prepared Gusto payroll is missing a Regular Hours row for a linked job_uuid.",
            details: bucket,
          });
          return compensation;
        }

        if ((bucket.overtimeMinutes || 0) > 0 && !bucketOvertimeRows.length) {
          unsupportedEmployees.push({
            employeeUuid,
            payrollRunItemId: localItem._id.toString(),
            reason: "Prepared Gusto payroll is missing an Overtime row for a linked job_uuid.",
            details: bucket,
          });
          return compensation;
        }

        if ((bucket.doubleOvertimeMinutes || 0) > 0 && !bucketDoubleOvertimeRows.length) {
          unsupportedEmployees.push({
            employeeUuid,
            payrollRunItemId: localItem._id.toString(),
            reason: "Prepared Gusto payroll is missing a Double overtime row for a linked job_uuid.",
            details: bucket,
          });
          return compensation;
        }

        applyDistributedHours(
          bucketRegularRows,
          formatHoursFromMinutes(bucket.regularMinutes || 0)
        ).forEach((row, index) => {
          replacements.set(bucketRegularRows[index], row);
        });

        applyDistributedHours(
          bucketOvertimeRows,
          formatHoursFromMinutes(bucket.overtimeMinutes || 0)
        ).forEach((row, index) => {
          replacements.set(bucketOvertimeRows[index], row);
        });

        applyDistributedHours(
          bucketDoubleOvertimeRows,
          formatHoursFromMinutes(bucket.doubleOvertimeMinutes || 0)
        ).forEach((row, index) => {
          replacements.set(bucketDoubleOvertimeRows[index], row);
        });
      }

      return {
        ...compensation,
        excluded: false,
        hourly_compensations: replaceHourlyRows(hourlyCompensations, replacements),
      };
    }

    const overtimeHours = formatHoursFromMinutes(localDistribution.overtimeMinutes || 0);
    const doubleOvertimeHours = formatHoursFromMinutes(
      localDistribution.doubleOvertimeMinutes || 0
    );

    if ((localDistribution.overtimeMinutes || 0) > 0 && !overtimeRows.length) {
      unsupportedEmployees.push({
        employeeUuid,
        payrollRunItemId: localItem._id.toString(),
        reason: "Local overtime hours were detected but the prepared Gusto payroll does not include an 'Overtime' row.",
        details: localDistribution,
      });
      return compensation;
    }

    const regularHours = formatHoursFromMinutes(
      Math.max(
        localDistribution.totalMinutes -
          (localDistribution.overtimeMinutes || 0) -
          (localDistribution.doubleOvertimeMinutes || 0),
        0
      )
    );

    const replacements = new Map();
    applyDistributedHours(regularRows, regularHours).forEach((row, index) => {
      replacements.set(regularRows[index], row);
    });
    applyDistributedHours(overtimeRows, overtimeHours).forEach((row, index) => {
      replacements.set(overtimeRows[index], row);
    });
    zeroOutRows(doubleOvertimeRows).forEach((row, index) => {
      replacements.set(doubleOvertimeRows[index], row);
    });

    return {
      ...compensation,
      excluded: false,
      hourly_compensations: replaceHourlyRows(hourlyCompensations, replacements),
    };
  });

  const unmatchedItems = items
    .filter((item) => !matchedEmployeeUuids.has(String(item.providerEmployeeId || "").trim()))
    .map((item) => ({
      payrollRunItemId: item._id.toString(),
      providerEmployeeId: item.providerEmployeeId,
    }));

  if (unsupportedEmployees.length || unmatchedItems.length) {
    throw new PayrollProviderError(
      "This payroll run cannot be mapped cleanly into Gusto employee compensations.",
      {
        statusCode: 400,
        code: "GUSTO_EMPLOYEE_COMPENSATION_MAPPING_FAILED",
        details: {
          unsupportedEmployees,
          unmatchedItems,
        },
      }
    );
  }

  return updatedCompensations;
}

async function updateGustoPayroll(companyUuid, payrollUuid, employeeCompensations, config) {
  const response = await axios.put(
    buildSinglePayrollUrl(companyUuid, payrollUuid, config),
    {
      employee_compensations: employeeCompensations,
    },
    {
      headers: getGustoHeaders(config, { "Content-Type": "application/json" }),
      timeout: 30000,
    }
  );

  return response.data;
}

async function calculateGustoPayroll(companyUuid, payrollUuid, config) {
  const response = await axios.put(
    buildGustoCalculatePayrollUrl(companyUuid, payrollUuid, config),
    null,
    {
      headers: getGustoHeaders(config),
      timeout: 30000,
      validateStatus(status) {
        return status >= 200 && status < 300;
      },
    }
  );

  if (response.status !== 202) {
    throw new PayrollProviderError("Gusto calculate payroll did not return the expected 202 Accepted response.", {
      statusCode: 502,
      code: "GUSTO_CALCULATE_UNEXPECTED_RESPONSE",
      details: {
        status: response.status,
        data: response.data || null,
      },
    });
  }

  return response.data || null;
}

async function getGustoPayroll(companyUuid, payrollUuid, config) {
  const response = await axios.get(
    buildSinglePayrollUrl(
      companyUuid,
      payrollUuid,
      config,
      "?include=taxes,benefits,deductions"
    ),
    {
      headers: getGustoHeaders(config),
      timeout: 30000,
    }
  );

  return response.data;
}

async function waitForGustoPayrollCalculation(companyUuid, payrollUuid, config) {
  const { timeoutMs, intervalMs } = getGustoPollingConfig();
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const payroll = await getGustoPayroll(companyUuid, payrollUuid, config);
    const processingStatus = getGustoProcessingStatus(payroll);

    if (processingStatus === "processing_failed") {
      throw new PayrollProviderError("Gusto payroll calculation failed.", {
        statusCode: 422,
        code: "GUSTO_CALCULATION_FAILED",
        details: {
          processing_request: payroll.processing_request || null,
          errors: getGustoProcessingErrors(payroll),
        },
      });
    }

    if (processingStatus === "calculate_success" || payroll?.calculated_at) {
      if (Array.isArray(payroll?.submission_blockers) && payroll.submission_blockers.length) {
        throw new PayrollProviderError("Gusto payroll has submission blockers.", {
          statusCode: 422,
          code: "GUSTO_SUBMISSION_BLOCKERS",
          details: {
            submission_blockers: payroll.submission_blockers,
          },
        });
      }

      return payroll;
    }

    await sleep(intervalMs);
  }

  throw new PayrollProviderError("Timed out waiting for Gusto payroll calculation to complete.", {
    statusCode: 504,
    code: "GUSTO_CALCULATION_TIMEOUT",
    details: {
      companyUuid,
      payrollUuid,
      timeoutMs,
    },
  });
}

async function submitPayrollRun(payrollRun, items, options = {}) {
  const config = getGustoProviderConfig();
  const payload = buildSubmissionPayload(payrollRun, items, config);

  if (config.mode === "disabled") {
    throw new PayrollProviderError(
      "Payroll provider submission is not configured. Set PAYROLL_PROVIDER_MODE to mock or live.",
      { statusCode: 503, code: "PAYROLL_PROVIDER_DISABLED" }
    );
  }

  if (config.mode === "mock") {
    const submittedAt = new Date();
    return {
      providerPayrollId: `mock-payroll-${payrollRun._id}-${submittedAt.getTime()}`,
      submittedAt,
      providerMetadata: {
        mode: "mock",
        submittedWorkerCount: items.length,
        requestPreview: payload,
      },
      itemResults: items.map((item) => ({
        payrollRunItemId: item._id.toString(),
        providerPayItemId: `mock-item-${item._id}`,
      })),
    };
  }

  if (!config.companyAccessToken) {
    throw new PayrollProviderError(
      "Missing Gusto live submission prerequisites. A company access token is required.",
      {
        statusCode: 503,
        code: "GUSTO_SUBMIT_CONFIG_MISSING",
        details: {
          hasCompanyAccessToken: Boolean(config.companyAccessToken),
        },
      }
    );
  }

  try {
    const resolvedPayroll = await resolveGustoPayrollForRun(payrollRun, config);
    const companyUuid = resolvedPayroll.companyUuid;
    const payrollUuid = resolvedPayroll.payrollUuid;
    const preparedPayroll = await prepareGustoPayroll(companyUuid, payrollUuid, config);
    const updatedEmployeeCompensations = buildUpdatedEmployeeCompensations(
      preparedPayroll,
      items,
      options
    );
    const updatedPayroll = await updateGustoPayroll(
      companyUuid,
      payrollUuid,
      updatedEmployeeCompensations,
      config
    );
    await calculateGustoPayroll(companyUuid, payrollUuid, config);
    const calculatedPayroll = await waitForGustoPayrollCalculation(companyUuid, payrollUuid, config);

    const submitUrl = buildGustoSubmitPayrollUrl(companyUuid, payrollUuid, config);
    const response = await axios.put(submitUrl, null, {
      headers: {
        ...getGustoHeaders(config),
      },
      timeout: 30000,
      validateStatus(status) {
        return status >= 200 && status < 300;
      },
    });

    if (response.status !== 202) {
      throw new PayrollProviderError(
        "Gusto submit payroll did not return the expected 202 Accepted response.",
        {
          statusCode: 502,
          code: "GUSTO_SUBMIT_UNEXPECTED_RESPONSE",
          details: {
            status: response.status,
            data: response.data || null,
          },
        }
      );
    }

    return {
      providerPayrollId: payrollUuid,
      submittedAt: new Date(),
      providerMetadata: {
        ...buildLiveSubmissionMetadata(response, companyUuid, payrollUuid),
        matchedBy: resolvedPayroll.matchedBy,
        lookupResult: resolvedPayroll.lookupResult || null,
        preparedPayroll: {
          payroll_uuid: preparedPayroll?.payroll_uuid || payrollUuid,
          company_uuid: preparedPayroll?.company_uuid || companyUuid,
          payroll_status_meta: preparedPayroll?.payroll_status_meta || null,
          processing_request: preparedPayroll?.processing_request || null,
        },
        updatedPayroll: {
          payroll_uuid: updatedPayroll?.payroll_uuid || payrollUuid,
          company_uuid: updatedPayroll?.company_uuid || companyUuid,
        },
        calculatedPayroll: {
          payroll_uuid: calculatedPayroll?.payroll_uuid || payrollUuid,
          company_uuid: calculatedPayroll?.company_uuid || companyUuid,
          calculated_at: calculatedPayroll?.calculated_at || null,
          totals: calculatedPayroll?.totals || null,
          submission_blockers: calculatedPayroll?.submission_blockers || [],
          processing_request: calculatedPayroll?.processing_request || null,
        },
      },
      itemResults: [],
    };
  } catch (error) {
    if (error instanceof PayrollProviderError) {
      throw error;
    }

    const statusCode = error.response?.status || 502;
    const message = extractGustoErrorMessage(error);

    throw new PayrollProviderError(message, {
      statusCode,
      code: "GUSTO_SUBMIT_FAILED",
      details: error.response?.data || null,
    });
  }
}

module.exports = {
  PayrollProviderError,
  getGustoProviderConfig,
  isVerificationWebhook,
  parseWebhookPayload,
  submitPayrollRun,
  sanitizeWebhookPayload,
  verifyPayrollWebhookSignature,
};
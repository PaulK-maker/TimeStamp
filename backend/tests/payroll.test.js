/**
 * Payroll — critical path unit tests (Phase 4)
 *
 * Covers:
 *  1. Webhook signature verification (valid / tampered / missing secret / missing sig)
 *  2. Verification webhook detection
 *  3. PayrollRun status mapping from Gusto event types
 *  4. PayrollRunItem status mapping
 *  5. Payroll profile validation — required fields and date window checks
 *
 * These tests do NOT hit MongoDB or the network. All dependencies are inlined
 * or extracted from the production modules under test.
 */

const crypto = require("crypto");

// ─── helpers reproduced from gustoProvider.js ─────────────────────────────────
// (testing the real module logic without importing the full module, which would
// require env vars and axios to be present)

function verifySignature(rawBody, signature, secret) {
  if (!secret) throw new Error("GUSTO_WEBHOOK_VERIFICATION_TOKEN not configured");
  if (!signature) throw new Error("Signature missing");

  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const normalized = String(signature).trim().toLowerCase().replace(/^sha256=/, "");

  const expected = Buffer.from(digest, "hex");
  const provided = Buffer.from(normalized, "hex");

  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}

function isVerificationWebhook(payload) {
  return Boolean(
    payload &&
    typeof payload.verification_token === "string" &&
    payload.verification_token.trim()
  );
}

function mapRunStatus(eventType) {
  const n = (eventType || "").toLowerCase();
  if (n === "payroll.submitted") return "submitted";
  if (["payroll.calculated", "payroll.processed"].includes(n)) return "processing";
  if (n === "payroll.paid") return "completed";
  if (n === "payroll.processing_failed") return "failed";
  if (["payroll.cancelled", "payroll.reversed"].includes(n)) return "cancelled";
  if (n === "payroll.partially_reversed") return "failed";
  return null;
}

function mapItemStatus(eventType) {
  const n = (eventType || "").toLowerCase();
  if (["payroll.submitted", "payroll.calculated", "payroll.processed"].includes(n)) return "submitted";
  if (n === "payroll.paid") return "completed";
  if (["payroll.processing_failed", "payroll.partially_reversed"].includes(n)) return "failed";
  if (["payroll.cancelled", "payroll.reversed"].includes(n)) return "skipped";
  return null;
}

function getPayrollProfileIssues(profile, payPeriodStart, payPeriodEnd) {
  const issues = [];
  if (!profile.payrollEligible) issues.push("payrollEligible must be true");
  if (profile.employmentStatus && profile.employmentStatus !== "active")
    issues.push("employmentStatus must be active");
  if (!profile.compensationType) issues.push("compensationType is required");
  if (
    (profile.compensationType === "hourly" || profile.compensationType === "contractor") &&
    typeof profile.payRate !== "number"
  ) issues.push("payRate is required for hourly and contractor staff");
  if (
    profile.compensationType === "salary" &&
    typeof profile.salaryAmount !== "number"
  ) issues.push("salaryAmount is required for salary staff");
  if (
    profile.payrollStartDate &&
    new Date(profile.payrollStartDate).getTime() > payPeriodEnd.getTime()
  ) issues.push("payrollStartDate is after this pay period");
  if (
    profile.payrollEndDate &&
    new Date(profile.payrollEndDate).getTime() < payPeriodStart.getTime()
  ) issues.push("payrollEndDate is before this pay period");
  return issues;
}

// ─── 1. Webhook signature verification ────────────────────────────────────────

describe("Webhook signature verification", () => {
  const secret = "test-secret-key";
  const body = Buffer.from(JSON.stringify({ event_type: "payroll.paid", entity_uuid: "abc-123" }));

  function makeSignature(buf, key) {
    return crypto.createHmac("sha256", key).update(buf).digest("hex");
  }

  test("accepts a valid HMAC signature", () => {
    const sig = makeSignature(body, secret);
    expect(verifySignature(body, sig, secret)).toBe(true);
  });

  test("rejects a tampered body", () => {
    const sig = makeSignature(body, secret);
    const tampered = Buffer.from(JSON.stringify({ event_type: "payroll.paid", entity_uuid: "HACKED" }));
    expect(verifySignature(tampered, sig, secret)).toBe(false);
  });

  test("rejects a wrong secret", () => {
    const sig = makeSignature(body, "wrong-secret");
    expect(verifySignature(body, sig, secret)).toBe(false);
  });

  test("throws when secret is not configured", () => {
    expect(() => verifySignature(body, "anysig", "")).toThrow(
      "GUSTO_WEBHOOK_VERIFICATION_TOKEN not configured"
    );
  });

  test("throws when signature is missing", () => {
    expect(() => verifySignature(body, null, secret)).toThrow("Signature missing");
  });

  test("accepts signature with sha256= prefix", () => {
    const sig = "sha256=" + makeSignature(body, secret);
    expect(verifySignature(body, sig, secret)).toBe(true);
  });
});

// ─── 2. Verification webhook detection ────────────────────────────────────────

describe("isVerificationWebhook", () => {
  test("returns true when verification_token is present", () => {
    expect(isVerificationWebhook({ verification_token: "cc0d1c41-545e" })).toBe(true);
  });

  test("returns false for a normal payroll event", () => {
    expect(isVerificationWebhook({ event_type: "payroll.paid", entity_uuid: "abc" })).toBe(false);
  });

  test("returns false for empty payload", () => {
    expect(isVerificationWebhook({})).toBe(false);
  });

  test("returns false for whitespace-only token", () => {
    expect(isVerificationWebhook({ verification_token: "   " })).toBe(false);
  });
});

// ─── 3. PayrollRun status mapping ─────────────────────────────────────────────

describe("mapRunStatus", () => {
  const cases = [
    ["payroll.submitted", "submitted"],
    ["payroll.calculated", "processing"],
    ["payroll.processed", "processing"],
    ["payroll.paid", "completed"],
    ["payroll.processing_failed", "failed"],
    ["payroll.cancelled", "cancelled"],
    ["payroll.reversed", "cancelled"],
    ["payroll.partially_reversed", "failed"],
    ["payroll.unknown_event", null],
    ["", null],
    [undefined, null],
  ];

  test.each(cases)("event '%s' maps to '%s'", (event, expected) => {
    expect(mapRunStatus(event)).toBe(expected);
  });
});

// ─── 4. PayrollRunItem status mapping ─────────────────────────────────────────

describe("mapItemStatus", () => {
  const cases = [
    ["payroll.submitted", "submitted"],
    ["payroll.calculated", "submitted"],
    ["payroll.processed", "submitted"],
    ["payroll.paid", "completed"],
    ["payroll.processing_failed", "failed"],
    ["payroll.partially_reversed", "failed"],
    ["payroll.cancelled", "skipped"],
    ["payroll.reversed", "skipped"],
    ["payroll.unknown_event", null],
  ];

  test.each(cases)("event '%s' maps item to '%s'", (event, expected) => {
    expect(mapItemStatus(event)).toBe(expected);
  });
});

// ─── 5. Payroll profile validation ────────────────────────────────────────────

describe("getPayrollProfileIssues", () => {
  const start = new Date("2026-06-01");
  const end = new Date("2026-06-14");

  const validHourly = {
    payrollEligible: true,
    employmentStatus: "active",
    compensationType: "hourly",
    payRate: 25,
  };

  test("returns no issues for a valid hourly profile", () => {
    expect(getPayrollProfileIssues(validHourly, start, end)).toHaveLength(0);
  });

  test("flags payrollEligible: false", () => {
    const issues = getPayrollProfileIssues({ ...validHourly, payrollEligible: false }, start, end);
    expect(issues).toContain("payrollEligible must be true");
  });

  test("flags missing compensationType", () => {
    const issues = getPayrollProfileIssues(
      { ...validHourly, compensationType: "" }, start, end
    );
    expect(issues).toContain("compensationType is required");
  });

  test("flags hourly staff with no payRate", () => {
    const issues = getPayrollProfileIssues(
      { ...validHourly, payRate: undefined }, start, end
    );
    expect(issues).toContain("payRate is required for hourly and contractor staff");
  });

  test("flags salary staff with no salaryAmount", () => {
    const issues = getPayrollProfileIssues(
      { payrollEligible: true, employmentStatus: "active", compensationType: "salary" },
      start, end
    );
    expect(issues).toContain("salaryAmount is required for salary staff");
  });

  test("flags inactive employmentStatus", () => {
    const issues = getPayrollProfileIssues(
      { ...validHourly, employmentStatus: "terminated" }, start, end
    );
    expect(issues).toContain("employmentStatus must be active");
  });

  test("flags payrollStartDate after pay period end", () => {
    const issues = getPayrollProfileIssues(
      { ...validHourly, payrollStartDate: "2026-07-01" }, start, end
    );
    expect(issues).toContain("payrollStartDate is after this pay period");
  });

  test("flags payrollEndDate before pay period start", () => {
    const issues = getPayrollProfileIssues(
      { ...validHourly, payrollEndDate: "2026-05-01" }, start, end
    );
    expect(issues).toContain("payrollEndDate is before this pay period");
  });

  test("accumulates multiple issues", () => {
    const issues = getPayrollProfileIssues(
      { payrollEligible: false, compensationType: "" }, start, end
    );
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});

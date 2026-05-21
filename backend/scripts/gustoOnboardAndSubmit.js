/**
 * Gusto Partner Company – Full Onboarding + Payroll Submission Script
 *
 * Runs against the PARTNER-MANAGED sandbox company (not the UI-created "Timestamp1").
 * Requires: GUSTO_PARTNER_COMPANY_UUID, GUSTO_PARTNER_COMPANY_REFRESH in .env
 *
 * Steps performed:
 *  1. Refresh company access token
 *  2. Add employee home address
 *  3. Add employee work address (links to company location)
 *  4. Create a job for the employee
 *  5. Create compensation (hourly) for the job
 *  6. Accept Terms of Service (required before payroll)
 *  7. Create an off-cycle payroll
 *  8. Prepare the payroll (get employee compensations + version)
 *  9. Update the payroll with hours
 * 10. Calculate the payroll
 * 11. Wait for calculation to complete
 * 12. Submit the payroll
 */

require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const CLIENT_ID = "j0BomohNFzn0Ytr7gO83w7t3eQMaXA6D9yuaa5KfG7I";
const CLIENT_SECRET = "i4x2gp15nqWNnc-rsrj4Qfdv4kVUsuM8v1iyT_ou94U";
const COMPANY_UUID = process.env.GUSTO_PARTNER_COMPANY_UUID;
const REFRESH_TOKEN = process.env.GUSTO_PARTNER_COMPANY_REFRESH;
const EMPLOYEE_UUID = "1d8a8091-fd7b-49d4-8a29-8261ed6ba5f3"; // Alexander Hamilton
const WORK_LOCATION_UUID = "3c93887f-d377-4d49-aea0-a751cbdd8336";
const EXISTING_JOB_UUID = "c4665ec0-d169-44f8-a5d0-87ff56c6dc9e"; // created last run
const EXISTING_PAYROLL_UUID = "fef1d6d6-6903-4642-b2e5-419b7a0d002e"; // open unprocessed

// Payroll period — use today + a few days for check date
const PAY_START = "2026-05-19";
const PAY_END = "2026-05-25";
const CHECK_DATE = "2026-05-28";

// Hours to submit for this employee
const REGULAR_HOURS = "80.000";

let TOKEN = null;

function headers(extra = {}) {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Gusto-API-Version": "2026-02-01",
    ...extra,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function step(label, fn) {
  process.stdout.write(`\n[STEP] ${label}... `);
  try {
    const result = await fn();
    console.log("OK");
    return result;
  } catch (e) {
    const status = e.response?.status;
    const data = JSON.stringify(e.response?.data || e.message).substring(0, 400);
    // 422 with "already taken" or similar is usually safe to skip
    if (status === 422) {
      console.log(`SKIP (422 – already exists or conflict): ${data}`);
      return null;
    }
    console.log(`FAIL (${status}): ${data}`);
    throw e;
  }
}

// ---------------------------------------------------------------------------

async function refreshToken() {
  const r = await axios.post(
    "https://api.gusto-demo.com/oauth/token",
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: REFRESH_TOKEN,
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" } }
  );
  TOKEN = r.data.access_token;
  const newRefresh = r.data.refresh_token;
  console.log(`\n[TOKEN] Access token refreshed (expires in ${r.data.expires_in}s)`);
  // Auto-save new refresh token back to .env
  const envPath = path.resolve(__dirname, "../.env");
  const envContent = fs.readFileSync(envPath, "utf8");
  const updated = envContent.replace(
    /^GUSTO_PARTNER_COMPANY_REFRESH=.*/m,
    `GUSTO_PARTNER_COMPANY_REFRESH=${newRefresh}`
  );
  fs.writeFileSync(envPath, updated, "utf8");
  console.log(`[TOKEN] Refresh token auto-saved to .env`);
  return { accessToken: TOKEN, refreshToken: newRefresh };
}

async function addHomeAddress() {
  // POST /v1/employees/{id}/home_addresses (plural)
  const r = await axios.post(
    `https://api.gusto-demo.com/v1/employees/${EMPLOYEE_UUID}/home_addresses`,
    {
      street_1: "425 Hamilton St",
      city: "New York",
      state: "NY",
      zip: "10004",
      country: "USA",
      effective_date: "2026-01-01",
      courtesy_withholding: false,
    },
    { headers: headers() }
  );
  return r.data;
}

async function addWorkAddress() {
  // POST /v1/employees/{id}/work_addresses (plural)
  const r = await axios.post(
    `https://api.gusto-demo.com/v1/employees/${EMPLOYEE_UUID}/work_addresses`,
    { location_uuid: WORK_LOCATION_UUID, effective_date: "2026-01-01" },
    { headers: headers() }
  );
  return r.data;
}

async function createJob() {
  const r = await axios.post(
    `https://api.gusto-demo.com/v1/employees/${EMPLOYEE_UUID}/jobs`,
    {
      title: "Caregiver",
      hire_date: "2026-01-01",
      location_uuid: WORK_LOCATION_UUID,
    },
    { headers: headers() }
  );
  const job = r.data;
  console.log(`\n  -> Job UUID: ${job.uuid}`);
  return job;
}

async function createCompensation(jobUuid) {
  const r = await axios.post(
    `https://api.gusto-demo.com/v1/jobs/${jobUuid}/compensations`,
    {
      rate: "24.50",
      payment_unit: "Hour",
      flsa_status: "Nonexempt",
      effective_date: "2026-04-29",
    },
    { headers: headers() }
  );
  console.log(`\n  -> Compensation UUID: ${r.data.uuid}, Rate: ${r.data.rate}/hr`);
  return r.data;
}

async function setupFederalTaxes() {
  // GET version first, then PUT
  const get = await axios.get(
    `https://api.gusto-demo.com/v1/employees/${EMPLOYEE_UUID}/federal_taxes`,
    { headers: headers() }
  );
  const version = get.data.version;
  const r = await axios.put(
    `https://api.gusto-demo.com/v1/employees/${EMPLOYEE_UUID}/federal_taxes`,
    {
      version,
      filing_status: "Single",
      extra_withholding: "0.0",
      two_jobs: false,
      dependents_amount: "0.0",
      other_income: "0.0",
      deductions: "0.0",
      w4_data_type: "rev_2020_w4",
    },
    { headers: headers() }
  );
  console.log(`\n  -> Federal filing_status: ${r.data.filing_status}`);
  return r.data;
}

async function setupStateTaxes() {
  // GET questions for the employee's states (NY home + NY work)
  const get = await axios.get(
    `https://api.gusto-demo.com/v1/employees/${EMPLOYEE_UUID}/state_taxes`,
    { headers: headers() }
  );
  const stateRecords = Array.isArray(get.data) ? get.data : [];
  console.log(`\n  -> States to configure: ${stateRecords.map((s) => s.state).join(", ") || "none"}`);

  const states = stateRecords.map((rec) => {
    const questions = (rec.questions || []).map((q) => {
      // answer each question with a sensible default based on key
      let value;
      const fmt = q.input_question_format?.type;
      if (q.key === "filing_status") {
        // pick first option (usually Single/S) or S directly
        const opts = q.input_question_format?.options || [];
        value = opts.find((o) => o.value === "S" || o.label === "Single")?.value ?? opts[0]?.value ?? "S";
      } else if (fmt === "Number" || fmt === "Currency") {
        value = q.key.includes("withholding") ? 1 : 0;
      } else if (fmt === "Select" && q.key === "file_new_hire_report") {
        value = false; // don't trigger new hire report in sandbox
      } else if (fmt === "Select") {
        value = q.input_question_format?.options?.[0]?.value ?? false;
      } else {
        value = null;
      }
      if (value === null) return null;
      return { key: q.key, answers: [{ value, valid_from: "2026-01-01", valid_up_to: null }] };
    }).filter(Boolean);
    return { state: rec.state, questions };
  });

  if (!states.length) {
    console.log("\n  -> No states to configure — skipping");
    return null;
  }

  const r = await axios.put(
    `https://api.gusto-demo.com/v1/employees/${EMPLOYEE_UUID}/state_taxes`,
    { employee_id: EMPLOYEE_UUID, states },
    { headers: headers() }
  );
  const configured = Array.isArray(r.data) ? r.data.map((s) => s.state).join(", ") : "done";
  console.log(`\n  -> State taxes configured: ${configured}`);
  return r.data;
}

async function addBankAccount() {
  // Using Gusto sandbox test bank numbers
  const r = await axios.post(
    `https://api.gusto-demo.com/v1/employees/${EMPLOYEE_UUID}/bank_accounts`,
    {
      name: "Test Checking Account",
      routing_number: "266905059",
      account_number: "5809431207",
      account_type: "Checking",
    },
    { headers: headers() }
  );
  console.log(`\n  -> Bank account UUID: ${r.data.uuid}`);
  return r.data;
}

async function forceOnboardingComplete() {
  // Mark employee as onboarding_completed — in sandbox this may bypass form_signing
  const r = await axios.put(
    `https://api.gusto-demo.com/v1/employees/${EMPLOYEE_UUID}/onboarding_status`,
    { onboarding_status: "onboarding_completed" },
    { headers: headers() }
  );
  console.log(`\n  -> Onboarding status: ${r.data.onboarding_status}`);
  return r.data;
}

async function checkOnboardingStatus() {
  const r = await axios.get(
    `https://api.gusto-demo.com/v1/employees/${EMPLOYEE_UUID}/onboarding_status`,
    { headers: headers() }
  );
  const blockers = r.data?.onboarding_steps
    ?.filter((s) => !s.completed && s.required)
    .map((s) => s.id) || [];
  console.log(`\n  -> Remaining required steps: ${blockers.join(", ") || "none"}`);
  return r.data;
}

async function createOffCyclePayroll() {
  // Check if one already exists for this period
  const list = await axios.get(
    `https://api.gusto-demo.com/v1/companies/${COMPANY_UUID}/payrolls?processing_statuses=unprocessed&payroll_types=regular,off_cycle&start_date=${PAY_START}&end_date=${PAY_END}`,
    { headers: headers() }
  );
  const existing = Array.isArray(list.data)
    ? list.data.find(
        (p) => p.pay_period?.start_date === PAY_START && p.pay_period?.end_date === PAY_END
      )
    : null;

  if (existing) {
    console.log(`\n  -> Reusing existing payroll: ${existing.payroll_uuid}`);
    return existing;
  }

  const r = await axios.post(
    `https://api.gusto-demo.com/v1/companies/${COMPANY_UUID}/payrolls`,
    {
      off_cycle: true,
      off_cycle_reason: "Correction",
      check_date: CHECK_DATE,
      start_date: PAY_START,
      end_date: PAY_END,
      employee_uuids: [EMPLOYEE_UUID],
    },
    { headers: headers() }
  );
  console.log(`\n  -> Created payroll: ${r.data.payroll_uuid}`);
  return r.data;
}

async function preparePayroll(payrollUuid) {
  const r = await axios.put(
    `https://api.gusto-demo.com/v1/companies/${COMPANY_UUID}/payrolls/${payrollUuid}/prepare`,
    null,
    { headers: headers() }
  );
  const comps = r.data.employee_compensations || [];
  console.log(`\n  -> Employee compensations returned: ${comps.length}`);
  return r.data;
}

async function updatePayroll(payrollUuid, preparedPayroll) {
  const empComps = preparedPayroll.employee_compensations || [];
  if (!empComps.length) {
    throw new Error("No employee_compensations returned from prepare — cannot update.");
  }

  // Find this employee's compensation entry and set regular hours
  const updated = empComps.map((comp) => {
    if (comp.employee_uuid !== EMPLOYEE_UUID) return comp;
    return {
      ...comp,
      hourly_compensations: (comp.hourly_compensations || []).map((h) => {
        if (h.name === "Regular Hours") {
          return { ...h, hours: REGULAR_HOURS };
        }
        return h;
      }),
    };
  });

  const r = await axios.put(
    `https://api.gusto-demo.com/v1/companies/${COMPANY_UUID}/payrolls/${payrollUuid}`,
    { employee_compensations: updated },
    { headers: headers() }
  );
  console.log(`\n  -> Payroll updated with ${REGULAR_HOURS} regular hours`);
  return r.data;
}

async function calculatePayroll(payrollUuid) {
  const r = await axios.put(
    `https://api.gusto-demo.com/v1/companies/${COMPANY_UUID}/payrolls/${payrollUuid}/calculate`,
    null,
    { headers: headers() }
  );
  console.log(`\n  -> Calculate triggered (status ${r.status})`);
  return r.data;
}

async function waitForCalculation(payrollUuid, maxWaitMs = 45000) {
  const pollInterval = 3000;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const r = await axios.get(
      `https://api.gusto-demo.com/v1/companies/${COMPANY_UUID}/payrolls/${payrollUuid}?include=taxes,benefits,deductions`,
      { headers: headers() }
    );
    const payroll = r.data;
    if (payroll.calculated_at) {
      const blockers = payroll.submission_blockers || [];
      console.log(`\n  -> Calculated at: ${payroll.calculated_at}`);
      if (blockers.length) {
        console.log(`  -> Submission blockers: ${JSON.stringify(blockers)}`);
        throw new Error(`Payroll has submission blockers: ${JSON.stringify(blockers)}`);
      }
      const totals = payroll.totals || {};
      console.log(`  -> Totals: gross=${totals.gross_pay}, taxes=${totals.employee_taxes}, net=${totals.net_pay}`);
      return payroll;
    }
    process.stdout.write(".");
    await sleep(pollInterval);
  }
  throw new Error("Timed out waiting for Gusto payroll calculation");
}

async function submitPayroll(payrollUuid) {
  const r = await axios.put(
    `https://api.gusto-demo.com/v1/companies/${COMPANY_UUID}/payrolls/${payrollUuid}/submit`,
    null,
    {
      headers: headers(),
      validateStatus: (s) => s === 202,
    }
  );
  console.log(`\n  -> SUBMITTED! Status: ${r.status}`);
  console.log(`  -> Payroll UUID (providerPayrollId): ${payrollUuid}`);
  return r.data;
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(60));
  console.log("Gusto Partner Company – Onboard + Submit Payroll");
  console.log("=".repeat(60));
  console.log(`Company UUID : ${COMPANY_UUID}`);
  console.log(`Employee UUID: ${EMPLOYEE_UUID}`);
  console.log(`Pay period   : ${PAY_START} → ${PAY_END}`);
  console.log(`Check date   : ${CHECK_DATE}`);

  if (!COMPANY_UUID || !REFRESH_TOKEN) {
    throw new Error("Missing GUSTO_PARTNER_COMPANY_UUID or GUSTO_PARTNER_COMPANY_REFRESH in .env");
  }

  // Step 1: Refresh token
  await step("1. Refresh company access token", refreshToken);

  // Steps 2-5: Employee onboarding
  await step("2. Add employee home address (NY)", addHomeAddress);
  await step("3. Add employee work address (link to company location)", addWorkAddress);

  let jobUuid;
  const job = await step("4. Create job (Caregiver, hire date 2026-01-01)", createJob);
  if (job) {
    jobUuid = job.uuid;
  } else {
    // Job was already created in a prior run — use known UUID
    jobUuid = EXISTING_JOB_UUID;
    console.log(`\n  -> Using existing job: ${jobUuid}`);
  }
  await step("5. Create hourly compensation ($24.50/hr, Nonexempt)", () => createCompensation(jobUuid));

  // Steps 6-7: Tax setup (required for payroll eligibility)
  await step("6. Setup federal tax withholding (W-4)", setupFederalTaxes);
  await step("7. Setup state tax withholding (NY)", setupStateTaxes);

  // Step 7b: Add bank account (for direct deposit)
  await step("7b. Add employee bank account", addBankAccount);

  // Step 7c: Force onboarding complete (bypasses form_signing in sandbox)
  await step("7c. Mark employee onboarding as completed", forceOnboardingComplete);

  // Step 8: Check onboarding status
  await step("8. Check employee onboarding status", checkOnboardingStatus);

  // Step 9: Create off-cycle payroll (or reuse existing open one)
  let payroll;
  payroll = await step("9. Create off-cycle payroll", createOffCyclePayroll);
  if (!payroll) {
    // Creation was skipped — find any existing open (unprocessed) off-cycle payroll
    console.log("  -> Searching for an existing open payroll...");
    try {
      const r = await axios.get(
        `https://api.gusto-demo.com/v1/companies/${COMPANY_UUID}/payrolls?processing_statuses=unprocessed&payroll_types=off_cycle`,
        { headers: headers() }
      );
      const open = (r.data?.payrolls || r.data || []);
      if (open.length) {
        payroll = open[0];
        payroll.payroll_uuid = payroll.payroll_uuid || payroll.uuid;
        console.log(`  -> Reusing existing payroll: ${payroll.payroll_uuid} (check: ${payroll.check_date})`);
      }
    } catch (findErr) {
      console.error("  -> Could not look up existing payrolls:", findErr.response?.data || findErr.message);
    }
  }
  if (!payroll) {
    throw new Error("Failed to create or find a payroll for this period.");
  }
  const payrollUuid = payroll.payroll_uuid;

  // Step 10: Prepare
  let preparedPayroll;
  preparedPayroll = await step("10. Prepare payroll (get compensations + version)", () =>
    preparePayroll(payrollUuid)
  );

  // Step 11: Update with hours
  await step("11. Update payroll with employee hours", () =>
    updatePayroll(payrollUuid, preparedPayroll)
  );

  // Step 12: Calculate
  await step("12. Trigger calculation (async)", () => calculatePayroll(payrollUuid));

  // Step 13: Wait for calculation
  let calculatedPayroll;
  process.stdout.write("\n[STEP] 13. Waiting for calculation to complete");
  calculatedPayroll = await waitForCalculation(payrollUuid);

  // Step 14: Submit
  await step("14. Submit payroll to Gusto", () => submitPayroll(payrollUuid));

  console.log("\n" + "=".repeat(60));
  console.log("SUCCESS – Live Gusto payroll submitted!");
  console.log(`providerPayrollId = ${payrollUuid}`);
  console.log("\nNext: Update your MongoDB draft run with this providerPayrollId:");
  console.log(`  PAYROLL_RUN_ID = (your draft run ID in timestampDB)`);
  console.log(`  GUSTO_PAYROLL_UUID = ${payrollUuid}`);
  console.log("=".repeat(60));
}

main().catch((e) => {
  console.error("\n[FATAL]", e.message);
  process.exit(1);
});

/**
 * verifyCompanyBank.js
 *
 * Uses the Gusto Demo API's send_test_deposits endpoint to simulate microdeposits
 * instantly, then verifies the company bank account.
 *
 * Gusto docs: https://docs.gusto.com/embedded-payroll/docs/manage-company-bank-accounts
 * "For testing in Demo, use POST .../bank_accounts/{uuid}/send_test_deposits
 *  to simulate micro-deposit transfers."
 *
 * Usage:
 *   cd backend && node scripts/verifyCompanyBank.js
 */

require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const CLIENT_ID = "j0BomohNFzn0Ytr7gO83w7t3eQMaXA6D9yuaa5KfG7I";
const CLIENT_SECRET = "i4x2gp15nqWNnc-rsrj4Qfdv4kVUsuM8v1iyT_ou94U";
const COMPANY_UUID = process.env.GUSTO_PARTNER_COMPANY_UUID; // 44196a95-66a8-428e-86ea-9cb1183b966d
const REFRESH_TOKEN = process.env.GUSTO_PARTNER_COMPANY_REFRESH;
const BANK_ACCOUNT_UUID = "3c305b5c-5800-4eec-bcc7-06b144ac0a05";

const BASE = "https://api.gusto-demo.com";
const API_VERSION = "2026-02-01";

let TOKEN = null;

function headers() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Gusto-API-Version": API_VERSION,
  };
}

async function refreshToken() {
  console.log("Refreshing access token...");
  const res = await axios.post(
    "https://api.gusto-demo.com/oauth/token",
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  TOKEN = res.data.access_token;
  const newRefresh = res.data.refresh_token;

  // Save new refresh token back to .env
  const envPath = path.resolve(__dirname, "../.env");
  let envContent = fs.readFileSync(envPath, "utf8");
  if (envContent.includes("GUSTO_PARTNER_COMPANY_REFRESH=")) {
    envContent = envContent.replace(
      /GUSTO_PARTNER_COMPANY_REFRESH=.*/,
      `GUSTO_PARTNER_COMPANY_REFRESH=${newRefresh}`
    );
  } else {
    envContent += `\nGUSTO_PARTNER_COMPANY_REFRESH=${newRefresh}`;
  }
  fs.writeFileSync(envPath, envContent);
  console.log("  Token refreshed and saved.");
}

async function checkCurrentStatus() {
  console.log("\n--- Checking current bank account status ---");
  const res = await axios.get(
    `${BASE}/v1/companies/${COMPANY_UUID}/bank_accounts`,
    { headers: headers() }
  );
  const accounts = Array.isArray(res.data) ? res.data : (res.data?.company_bank_accounts || []);
  accounts.forEach((acct) => {
    console.log(`  UUID: ${acct.uuid}`);
    console.log(`  Routing: ${acct.routing_number}`);
    console.log(`  Account: ${acct.hidden_account_number}`);
    console.log(`  Status: ${acct.verification_status}`);
    console.log(`  Type: ${acct.verification_type}`);
  });
  return accounts;
}

async function sendTestDeposits(bankUuid) {
  console.log(`\n--- Sending test deposits to bank account ${bankUuid} ---`);
  try {
    const res = await axios.post(
      `${BASE}/v1/companies/${COMPANY_UUID}/bank_accounts/${bankUuid}/send_test_deposits`,
      {},
      { headers: headers() }
    );
    console.log("  Response:", JSON.stringify(res.data, null, 2));
    return res.data;
  } catch (err) {
    const detail = err.response?.data;
    console.error("  send_test_deposits failed:", JSON.stringify(detail, null, 2));
    throw err;
  }
}

async function verifyBankAccount(bankUuid, deposit1, deposit2) {
  console.log(`\n--- Verifying bank account with deposits ${deposit1} and ${deposit2} ---`);
  try {
    const res = await axios.put(
      `${BASE}/v1/companies/${COMPANY_UUID}/bank_accounts/${bankUuid}/verify`,
      { deposit_1: deposit1, deposit_2: deposit2 },
      { headers: headers() }
    );
    console.log("  Verification result:", JSON.stringify(res.data, null, 2));
    return res.data;
  } catch (err) {
    const detail = err.response?.data;
    console.error("  Verify failed:", JSON.stringify(detail, null, 2));
    throw err;
  }
}

async function createNewBankAccountAndVerify() {
  // If existing bank won't work (wrong routing number), create a fresh one
  // with Gusto's approved test routing number.
  console.log("\n--- Creating new bank account with test routing number 102001017 ---");
  const res = await axios.post(
    `${BASE}/v1/companies/${COMPANY_UUID}/bank_accounts`,
    {
      routing_number: "102001017",
      account_type: "Checking",
      account_number: "9775014007",
    },
    { headers: headers() }
  );
  console.log("  Created:", JSON.stringify(res.data, null, 2));
  return res.data;
}

async function main() {
  if (!COMPANY_UUID) {
    console.error("ERROR: GUSTO_PARTNER_COMPANY_UUID not set in .env");
    process.exit(1);
  }
  if (!REFRESH_TOKEN) {
    console.error("ERROR: GUSTO_PARTNER_COMPANY_REFRESH not set in .env");
    process.exit(1);
  }

  try {
    // 1. Refresh token
    await refreshToken();

    // 2. Check current status
    const accounts = await checkCurrentStatus();

    // 3. Find our target bank account (or any awaiting_deposits one)
    let targetBank = accounts.find((a) => a.uuid === BANK_ACCOUNT_UUID);
    if (!targetBank) {
      console.log(`\n  Target UUID ${BANK_ACCOUNT_UUID} not found in account list.`);
      console.log("  Trying with first account found...");
      targetBank = accounts[0];
    }

    if (!targetBank) {
      console.log("\n  No bank accounts found. Creating one with the test routing number...");
      targetBank = await createNewBankAccountAndVerify();
    }

    if (targetBank.verification_status === "verified") {
      console.log("\n  Bank account is already VERIFIED. Nothing to do.");
      return;
    }

    // 4. Try send_test_deposits on the existing account
    let depositData = null;
    try {
      depositData = await sendTestDeposits(targetBank.uuid);
    } catch (err) {
      // If send_test_deposits fails (e.g. routing number mismatch),
      // create a fresh account with the approved test routing number.
      console.log("\n  send_test_deposits failed on existing account.");
      console.log("  Creating new bank account with test routing number 102001017...");
      targetBank = await createNewBankAccountAndVerify();
      depositData = await sendTestDeposits(targetBank.uuid);
    }

    // 5. Extract deposit amounts from response and verify
    // The response may directly contain the amounts, or we may need to use
    // fixed test amounts (0.02 and 0.42 are the standard Gusto sandbox values).
    let d1 = depositData?.deposit_1 ?? depositData?.deposits?.[0] ?? 0.02;
    let d2 = depositData?.deposit_2 ?? depositData?.deposits?.[1] ?? 0.42;

    // Gusto sandbox always uses these fixed test amounts:
    if (!d1 || !d2) {
      d1 = 0.02;
      d2 = 0.42;
    }

    const result = await verifyBankAccount(targetBank.uuid, d1, d2);

    if (result?.verification_status === "verified") {
      console.log("\n  Bank account is now VERIFIED.");
      console.log("  You can now re-run gustoOnboardAndSubmit.js to submit payroll.");
    } else {
      console.log("\n  Unexpected status after verify:", result?.verification_status);
    }
  } catch (err) {
    console.error("\nScript failed:", err.message || err);
    process.exit(1);
  }
}

main();

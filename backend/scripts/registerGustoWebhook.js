/**
 * Register Gusto Webhook Subscription
 *
 * One-time setup: tells Gusto where to deliver payroll webhook events.
 * Gusto will immediately send a verification_token event to the URL —
 * the backend handles it automatically (returns 200), and Gusto marks
 * the subscription as active.
 *
 * Run this ONCE after deploying to Render (or any time the URL changes).
 *
 * Usage:
 *   cd backend
 *   WEBHOOK_URL=https://your-app.onrender.com/api/payroll/webhook node scripts/registerGustoWebhook.js
 *
 * Or set WEBHOOK_URL in your .env first, then just:
 *   node scripts/registerGustoWebhook.js
 *
 * Required env vars:
 *   GUSTO_PARTNER_COMPANY_REFRESH  – refresh token for the partner-managed company
 *   GUSTO_PARTNER_COMPANY_UUID     – UUID of the partner-managed company
 *   WEBHOOK_URL                    – full public URL of your webhook endpoint
 *
 * After running:
 *   1. Copy the `verification_token` from the output.
 *   2. Set GUSTO_WEBHOOK_VERIFICATION_TOKEN=<token> in Render environment variables.
 *   3. Redeploy so the backend picks up the new env var.
 *   4. Gusto will confirm the subscription is active within a few minutes.
 */

require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const CLIENT_ID = "j0BomohNFzn0Ytr7gO83w7t3eQMaXA6D9yuaa5KfG7I";
const CLIENT_SECRET = "i4x2gp15nqWNnc-rsrj4Qfdv4kVUsuM8v1iyT_ou94U";
const COMPANY_UUID = process.env.GUSTO_PARTNER_COMPANY_UUID;
const REFRESH_TOKEN = process.env.GUSTO_PARTNER_COMPANY_REFRESH;
const WEBHOOK_URL = process.env.WEBHOOK_URL || "";
const API_BASE = "https://api.gusto-demo.com";

if (!COMPANY_UUID) {
  console.error("❌  GUSTO_PARTNER_COMPANY_UUID is not set in .env");
  process.exit(1);
}

if (!REFRESH_TOKEN) {
  console.error("❌  GUSTO_PARTNER_COMPANY_REFRESH is not set in .env");
  process.exit(1);
}

if (!WEBHOOK_URL) {
  console.error(
    "❌  WEBHOOK_URL is not set.\n" +
    "    Set it in .env or pass it inline:\n" +
    "    WEBHOOK_URL=https://your-app.onrender.com/api/payroll/webhook node scripts/registerGustoWebhook.js"
  );
  process.exit(1);
}

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

async function refreshToken() {
  console.log("🔄  Refreshing company access token…");
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: REFRESH_TOKEN,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: "http://localhost:5001/api/auth/gusto/callback",
  });

  const res = await axios.post("https://api.gusto-demo.com/oauth/token", params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  TOKEN = res.data.access_token;
  const newRefresh = res.data.refresh_token;

  if (newRefresh && newRefresh !== REFRESH_TOKEN) {
    const envPath = path.join(__dirname, "../.env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf8");
      const updated = envContent.replace(
        /^GUSTO_PARTNER_COMPANY_REFRESH=.*/m,
        `GUSTO_PARTNER_COMPANY_REFRESH=${newRefresh}`
      );
      fs.writeFileSync(envPath, updated);
      console.log("   ↳ Refresh token rotated and saved to .env");
    }
  }

  console.log("   ✅ Token refreshed");
}

async function listExistingSubscriptions() {
  console.log("\n📋  Checking for existing webhook subscriptions…");
  try {
    const res = await axios.get(
      `${API_BASE}/v1/webhook_subscriptions`,
      { headers: headers() }
    );
    const subs = Array.isArray(res.data) ? res.data : [];
    if (!subs.length) {
      console.log("   None found.");
    } else {
      for (const sub of subs) {
        console.log(`   - UUID: ${sub.uuid}  URL: ${sub.url}  Status: ${sub.status || "unknown"}`);
      }
    }
    return subs;
  } catch (err) {
    const status = err?.response?.status;
    const data = JSON.stringify(err?.response?.data || {});
    console.warn(`   ⚠️  Could not list subscriptions (${status}): ${data}`);
    return [];
  }
}

async function deleteSubscription(uuid) {
  console.log(`\n🗑️   Deleting existing subscription ${uuid}…`);
  try {
    await axios.delete(
      `${API_BASE}/v1/webhook_subscriptions/${uuid}`,
      { headers: headers() }
    );
    console.log("   ✅ Deleted");
  } catch (err) {
    const status = err?.response?.status;
    const data = JSON.stringify(err?.response?.data || {});
    console.warn(`   ⚠️  Delete failed (${status}): ${data}`);
  }
}

async function createSubscription() {
  console.log(`\n📡  Registering webhook subscription…`);
  console.log(`    URL: ${WEBHOOK_URL}`);

  const res = await axios.post(
    `${API_BASE}/v1/webhook_subscriptions`,
    {
      url: WEBHOOK_URL,
      subscription_types: [
        "Payroll",
      ],
    },
    { headers: headers() }
  );

  return res.data;
}

async function main() {
  await refreshToken();

  const existing = await listExistingSubscriptions();

  // If a subscription already exists for the same URL, skip creation.
  const alreadyRegistered = existing.find(
    (sub) => sub.url === WEBHOOK_URL
  );

  if (alreadyRegistered) {
    console.log(
      `\n✅  Subscription already registered for this URL (UUID: ${alreadyRegistered.uuid}).`
    );
    console.log(
      "\n📌  Next step: if GUSTO_WEBHOOK_VERIFICATION_TOKEN is not yet set on Render,\n" +
      "    Gusto should have sent a verification_token event to your endpoint.\n" +
      "    Check your Render logs for the verification token value."
    );
    return;
  }

  // Delete any stale subscriptions pointing to old/different URLs before creating.
  for (const sub of existing) {
    await deleteSubscription(sub.uuid);
  }

  let subscription;
  try {
    subscription = await createSubscription();
  } catch (err) {
    const status = err?.response?.status;
    const data = JSON.stringify(err?.response?.data || {}, null, 2);
    console.error(`\n❌  Failed to create subscription (${status}):\n${data}`);
    process.exit(1);
  }

  console.log("\n✅  Webhook subscription created:");
  console.log(JSON.stringify(subscription, null, 2));

  const verificationToken =
    subscription.verification_token ||
    subscription.verificationToken ||
    null;

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  NEXT STEPS — DO THIS NOW");
  console.log("═══════════════════════════════════════════════════════");

  if (verificationToken) {
    console.log(`\n  1. Copy this verification token:\n`);
    console.log(`     ${verificationToken}\n`);
    console.log(
      "  2. In Render → Environment Variables, set:\n\n" +
      `     GUSTO_WEBHOOK_VERIFICATION_TOKEN=${verificationToken}\n`
    );
  } else {
    console.log(
      "\n  The verification_token was NOT in the response.\n" +
      "  Check your Render logs — Gusto will have sent a POST to your\n" +
      `  webhook URL (${WEBHOOK_URL}) with a verification_token field.\n`
    );
  }

  console.log(
    "  3. Redeploy the backend on Render so the new env var takes effect.\n" +
    "  4. Gusto will confirm the subscription as active within a few minutes.\n" +
    "  5. Submit a test payroll — the webhook should fire and update PayrollRun.status in MongoDB.\n"
  );
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n❌  Fatal error:", err.message || err);
  process.exit(1);
});

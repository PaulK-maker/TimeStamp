const Stripe = require("stripe");

const PAID_PLAN_ENV_MAP = {
  standard_10: "STRIPE_PRICE_STANDARD_10",
  pro_25: "STRIPE_PRICE_PRO_25",
};

const ENABLED_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const CAUTION_SUBSCRIPTION_STATUSES = new Set(["past_due"]);

let cachedStripeClient = null;

function getStripeClient() {
  const secretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!secretKey) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY in backend/.env.");
  }

  if (!cachedStripeClient) {
    cachedStripeClient = new Stripe(secretKey);
  }

  return cachedStripeClient;
}

function getStripePriceIdForPlan(planId) {
  const envName = PAID_PLAN_ENV_MAP[planId];
  if (!envName) return null;
  const priceId = (process.env[envName] || "").trim();
  return priceId || null;
}

function getPlanIdForStripePriceId(priceId) {
  const normalizedPriceId = (priceId || "").trim();
  if (!normalizedPriceId) return null;

  return (
    Object.keys(PAID_PLAN_ENV_MAP).find(
      (planId) => getStripePriceIdForPlan(planId) === normalizedPriceId
    ) || null
  );
}

function isPaidPlan(planId) {
  return Boolean(PAID_PLAN_ENV_MAP[planId]);
}

function getPlanBillingType(planId) {
  return isPaidPlan(planId) ? "stripe" : "free";
}

function isSubscriptionAccessEnabled(status) {
  const normalizedStatus = (status || "").trim().toLowerCase();
  if (!normalizedStatus) return false;
  if (ENABLED_SUBSCRIPTION_STATUSES.has(normalizedStatus)) return true;

  const graceMode = (process.env.STRIPE_BILLING_GRACE_MODE || "").trim().toLowerCase();
  return graceMode === "allow_past_due" && CAUTION_SUBSCRIPTION_STATUSES.has(normalizedStatus);
}

function normalizeReturnPath(returnPath) {
  const raw = (returnPath || "").trim();
  if (!raw.startsWith("/")) return "/admin/billing";
  return raw;
}

function getAppBaseUrl() {
  const explicitBaseUrl = (process.env.APP_BASE_URL || "").trim();
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

function buildStripeReturnUrl({ type, returnPath }) {
  if (type === "success") {
    const explicit = (process.env.STRIPE_SUCCESS_URL || "").trim();
    if (explicit) return explicit;
  }

  if (type === "cancel") {
    const explicit = (process.env.STRIPE_CANCEL_URL || "").trim();
    if (explicit) return explicit;
  }

  if (type === "portal") {
    const explicit = (process.env.STRIPE_PORTAL_RETURN_URL || "").trim();
    if (explicit) return explicit;
  }

  return `${getAppBaseUrl()}${normalizeReturnPath(returnPath)}`;
}

module.exports = {
  getStripeClient,
  getStripePriceIdForPlan,
  getPlanIdForStripePriceId,
  getPlanBillingType,
  isPaidPlan,
  isSubscriptionAccessEnabled,
  buildStripeReturnUrl,
};
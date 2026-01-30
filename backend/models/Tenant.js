const mongoose = require("mongoose");
const crypto = require("crypto");

const TENANT_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function normalizeTenantCode(value) {
  return (value || "")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

function generateTenantCode(length = 8) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += TENANT_CODE_ALPHABET[bytes[i] & 31];
  }
  return out;
}

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },

    // Human-friendly facility code used for support/onboarding and safe tenant selection
    // in scripts. Stored without dashes; UI can display as XXXX-XXXX.
    tenantCode: {
      type: String,
      default: null,
      trim: true,
      set: normalizeTenantCode,
    },

    planId: {
      type: String,
      default: null,
    },

    planSelected: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Stripe-ready fields (wired later)
    stripeCustomerId: {
      type: String,
      default: null,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
      index: true,
    },
    stripePriceId: {
      type: String,
      default: null,
    },
    subscriptionStatus: {
      type: String,
      default: null,
    },
    currentPeriodEnd: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

tenantSchema.index({ tenantCode: 1 }, { unique: true, sparse: true });

tenantSchema.pre("validate", async function () {
  if (this.tenantCode) {
    this.tenantCode = normalizeTenantCode(this.tenantCode);
    if (!this.tenantCode) this.tenantCode = null;
  }

  if (this.tenantCode) return;

  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateTenantCode(8);
    // this.constructor is the compiled Tenant model
    const exists = await this.constructor.exists({ tenantCode: candidate });
    if (!exists) {
      this.tenantCode = candidate;
      return;
    }
  }

  throw new Error("Failed to generate a unique tenantCode");
});

module.exports = mongoose.models.Tenant || mongoose.model("Tenant", tenantSchema);

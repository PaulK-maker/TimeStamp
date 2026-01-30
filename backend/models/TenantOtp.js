const mongoose = require("mongoose");

const PURPOSES = ["TENANT_JOIN_INVITE", "TENANT_BOOTSTRAP_CONFIRM"];

const tenantOtpSchema = new mongoose.Schema(
  {
    purpose: {
      type: String,
      enum: PURPOSES,
      required: true,
      index: true,
    },

    // Recipient email (lowercased). For join invites, this is the invited user's email.
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    // For join invites, which tenant/facility the code will attach the user to.
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
      index: true,
    },

    codeHash: {
      type: String,
      required: true,
      select: false,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    consumedAt: {
      type: Date,
      default: null,
      index: true,
    },

    // Best-effort throttling / abuse controls
    sendCount: {
      type: Number,
      default: 1,
    },
    sendWindowStartAt: {
      type: Date,
      default: () => new Date(),
    },
    lastSentAt: {
      type: Date,
      default: () => new Date(),
    },

    verifyAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },

    createdByCaregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Caregiver",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

// TTL cleanup. Mongo will delete docs after expiresAt.
tenantOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.TenantOtp || mongoose.model("TenantOtp", tenantOtpSchema);

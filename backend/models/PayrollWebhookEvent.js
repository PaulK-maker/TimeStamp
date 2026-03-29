const mongoose = require("mongoose");

const payrollWebhookEventSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["gusto"],
      default: "gusto",
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    providerEventId: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["received", "processed", "ignored", "failed"],
      default: "received",
      index: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    linkedPayrollRunIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "PayrollRun",
        },
      ],
      default: [],
    },
    sanitizedPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    lastError: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

payrollWebhookEventSchema.index(
  { tenantId: 1, provider: 1, providerEventId: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.PayrollWebhookEvent ||
  mongoose.model("PayrollWebhookEvent", payrollWebhookEventSchema);
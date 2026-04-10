const mongoose = require("mongoose");

const payrollRunSchema = new mongoose.Schema(
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
    },
    payPeriodStart: {
      type: Date,
      required: true,
    },
    payPeriodEnd: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "submitted", "processing", "completed", "failed", "cancelled"],
      default: "draft",
      index: true,
    },
    providerPayrollId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    totalsSummary: {
      workerCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      approvedMinutes: {
        type: Number,
        default: 0,
        min: 0,
      },
      grossPayPreview: {
        type: Number,
        default: null,
        min: 0,
      },
    },
    providerMetadata: {
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

payrollRunSchema.index(
  { tenantId: 1, payPeriodStart: 1, payPeriodEnd: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.PayrollRun ||
  mongoose.model("PayrollRun", payrollRunSchema);
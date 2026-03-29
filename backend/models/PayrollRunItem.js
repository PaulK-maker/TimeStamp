const mongoose = require("mongoose");

const payrollRunItemSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    payrollRun: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollRun",
      required: true,
      index: true,
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
      index: true,
    },
    providerEmployeeId: {
      type: String,
      trim: true,
      default: null,
    },
    compensationTypeSnapshot: {
      type: String,
      enum: ["hourly", "salary", "contractor"],
      default: null,
    },
    workerClassificationSnapshot: {
      type: String,
      trim: true,
      default: null,
    },
    payRateSnapshot: {
      type: Number,
      default: null,
      min: 0,
    },
    salaryAmountSnapshot: {
      type: Number,
      default: null,
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
    status: {
      type: String,
      enum: ["pending", "submitted", "completed", "failed", "skipped"],
      default: "pending",
      index: true,
    },
    providerPayItemId: {
      type: String,
      trim: true,
      default: null,
    },
    errorDetails: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

payrollRunItemSchema.index({ tenantId: 1, payrollRun: 1, staff: 1 }, { unique: true });

module.exports =
  mongoose.models.PayrollRunItem ||
  mongoose.model("PayrollRunItem", payrollRunItemSchema);
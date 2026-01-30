const mongoose = require("mongoose");

const missedPunchRequestSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
      index: true,
    },
    caregiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Caregiver",
      required: true,
      index: true,
    },
    timeEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TimeEntry",
      required: true,
      index: true,
    },
    missingField: {
      type: String,
      enum: ["punchOut", "punchIn"],
      required: true,
    },
    requestedTime: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Caregiver",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    adminNote: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
  },
  { timestamps: true }
);

missedPunchRequestSchema.index({ status: 1, createdAt: -1 });
missedPunchRequestSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

module.exports =
  mongoose.models.MissedPunchRequest ||
  mongoose.model("MissedPunchRequest", missedPunchRequestSchema);

const mongoose = require("mongoose");

const timeEntryCorrectionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
      index: true,
    },
    timeEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TimeEntry",
      required: true,
      unique: true,
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
      index: true,
    },
    effectivePunchIn: {
      type: Date,
      default: null,
    },
    effectivePunchOut: {
      type: Date,
      default: null,
    },
    sourceRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MissedPunchRequest",
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.TimeEntryCorrection ||
  mongoose.model("TimeEntryCorrection", timeEntryCorrectionSchema);

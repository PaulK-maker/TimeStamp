const mongoose = require("mongoose");

const trainingRecordSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    issuingOrganization: {
      type: String,
      trim: true,
      default: null,
    },
    dateReceived: {
      type: Date,
      required: true,
    },
    expirationDate: {
      type: Date,
      default: null,
    },
    // how many days before expiry to flag as "expiring soon"
    renewalReminderDays: {
      type: Number,
      default: 30,
      min: 1,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.TrainingRecord ||
  mongoose.model("TrainingRecord", trainingRecordSchema);

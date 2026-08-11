const mongoose = require("mongoose");

const timeEntryJobSnapshotSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      default: null,
    },
    name: {
      type: String,
      trim: true,
      default: null,
    },
    gustoJobUuid: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: false }
);

const timeEntryLocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    distanceMeters: { type: Number, default: null },
    withinFence: { type: Boolean, default: null },
  },
  { _id: false }
);

const timeEntrySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
      index: true,
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      default: null,
      index: true,
    },
    jobSnapshot: {
      type: timeEntryJobSnapshotSchema,
      default: () => ({}),
    },
    punchIn: {
      type: Date,
      required: true,
    },
    punchOut: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
    },
    punchInLocation: {
      type: timeEntryLocationSchema,
      default: null,
    },
    punchOutLocation: {
      type: timeEntryLocationSchema,
      default: null,
    },
  },
  { timestamps: true }
);

timeEntrySchema.index({ tenantId: 1, staff: 1, job: 1, punchIn: -1 });

module.exports =
  mongoose.models.TimeEntry ||
  mongoose.model("TimeEntry", timeEntrySchema);
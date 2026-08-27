const mongoose = require("mongoose");

const activitySlotSchema = new mongoose.Schema(
  {
    // 0 = Monday … 6 = Sunday
    day: { type: Number, required: true, min: 0, max: 6 },
    time: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    activityName: { type: String, required: true, trim: true },
    durationMinutes: { type: Number, default: 60, min: 1 },
    facilitatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
    notes: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const weeklyActivityScheduleSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    weekStartDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    activities: { type: [activitySlotSchema], default: [] },
  },
  { timestamps: true }
);

// one schedule per tenant per week
weeklyActivityScheduleSchema.index(
  { tenantId: 1, weekStartDate: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.WeeklyActivitySchedule ||
  mongoose.model("WeeklyActivitySchedule", weeklyActivityScheduleSchema);

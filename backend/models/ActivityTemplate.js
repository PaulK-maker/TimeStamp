const mongoose = require("mongoose");

const activityTemplateSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["Physical", "Social", "Educational", "Recreational", "Other"],
      default: "Other",
    },
    defaultDurationMinutes: {
      type: Number,
      default: 60,
      min: 1,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ActivityTemplate ||
  mongoose.model("ActivityTemplate", activityTemplateSchema);

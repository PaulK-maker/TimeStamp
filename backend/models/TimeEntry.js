const mongoose = require("mongoose");

const timeEntrySchema = new mongoose.Schema(
  {
    caregiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Caregiver",
      required: true,
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
  },
  { timestamps: true }
);
module.exports =
  mongoose.models.TimeEntry ||
  mongoose.model("TimeEntry", timeEntrySchema);
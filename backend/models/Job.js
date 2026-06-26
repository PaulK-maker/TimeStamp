const mongoose = require("mongoose");

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function buildNameKey(value) {
  return (normalizeOptionalString(value) || "").toLowerCase();
}

const jobSchema = new mongoose.Schema(
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
    nameKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    gustoJobUuid: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

jobSchema.pre("validate", function setNameKey() {
  this.name = normalizeOptionalString(this.name);
  this.description = normalizeOptionalString(this.description);
  this.gustoJobUuid = normalizeOptionalString(this.gustoJobUuid);
  this.nameKey = buildNameKey(this.name);
});

jobSchema.index({ tenantId: 1, isActive: 1 });
jobSchema.index({ tenantId: 1, nameKey: 1 }, { unique: true });

module.exports = mongoose.models.Job || mongoose.model("Job", jobSchema);
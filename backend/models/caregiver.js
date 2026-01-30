const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const caregiverSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: function () {
        return !this.clerkUserId;
      },
      minlength: 6,
      select: false, // hide password by default
    },
    // When using Clerk auth, we link the external user id here.
    clerkUserId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["caregiver", "admin", "superadmin"],
      default: "caregiver",
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Facility/tenant that owns this caregiver record.
    // Kept optional initially to allow a one-time backfill script to populate it.
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

// Hash password before save
caregiverSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

module.exports =
  mongoose.models.Caregiver ||
  mongoose.model("Caregiver", caregiverSchema);
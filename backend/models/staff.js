const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const staffSchema = new mongoose.Schema(
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
      select: false,
    },
    clerkUserId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["staff", "admin", "superadmin"],
      default: "staff",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

staffSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.models.Staff || mongoose.model("Staff", staffSchema);
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const payrollProfileSchema = new mongoose.Schema(
  {
    compensationType: {
      type: String,
      enum: ["hourly", "salary", "contractor"],
      default: null,
    },
    payRate: {
      type: Number,
      default: null,
      min: 0,
    },
    salaryAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    payrollEligible: {
      type: Boolean,
      default: false,
    },
    workerClassification: {
      type: String,
      trim: true,
      default: null,
    },
    employmentStatus: {
      type: String,
      enum: ["active", "inactive", "terminated"],
      default: "active",
    },
    payrollProvider: {
      type: String,
      enum: ["gusto"],
      default: null,
    },
    payrollProviderEmployeeId: {
      type: String,
      trim: true,
      default: null,
    },
    payrollStartDate: {
      type: Date,
      default: null,
    },
    payrollEndDate: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

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
    // Provider-backed payroll metadata only. No SSNs, bank details, or tax elections.
    payrollProfile: {
      type: payrollProfileSchema,
      default: () => ({}),
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
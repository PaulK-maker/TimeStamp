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
      validate: {
        validator(value) {
          if (
            this.compensationType === "hourly" ||
            this.compensationType === "contractor"
          ) {
            return typeof value === "number" && value >= 0;
          }

          return value === null || value === undefined || value >= 0;
        },
        message: "payRate is required for hourly and contractor payroll profiles",
      },
    },
    salaryAmount: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator(value) {
          if (this.compensationType === "salary") {
            return typeof value === "number" && value >= 0;
          }

          return value === null || value === undefined || value >= 0;
        },
        message: "salaryAmount is required for salary payroll profiles",
      },
    },
    payrollEligible: {
      type: Boolean,
      default: false,
      validate: {
        validator(value) {
          if (!value) return true;
          return ["hourly", "salary", "contractor"].includes(this.compensationType);
        },
        message: "compensationType is required when payrollEligible is true",
      },
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
    // View-only vs. run/submit split within the "admin" role: any admin can
    // view payroll runs, but only admins with this flag can create drafts or
    // submit them to Gusto. Defaults to false; the facility creator is the
    // only one granted true automatically (see tenantController.bootstrapTenant).
    payrollRunAccess: {
      type: Boolean,
      default: false,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
      index: true,
    },
    defaultJob: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      default: null,
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
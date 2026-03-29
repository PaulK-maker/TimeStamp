const Staff = require("../models/staff");

// @desc   Create a new staff member
// @route  POST /api/staff
const bcrypt = require("bcryptjs");

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function normalizeOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeOptionalDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeOptionalBoolean(value) {
  if (value === undefined) return undefined;
  return Boolean(value);
}

function buildPayrollProfileUpdate(currentProfile = {}, input = {}) {
  const compensationType = normalizeOptionalString(input.compensationType);
  const workerClassification = normalizeOptionalString(input.workerClassification);
  const payrollProvider = normalizeOptionalString(input.payrollProvider);
  const payrollProviderEmployeeId = normalizeOptionalString(
    input.payrollProviderEmployeeId
  );
  const employmentStatus = normalizeOptionalString(input.employmentStatus);
  const payRate = normalizeOptionalNumber(input.payRate);
  const salaryAmount = normalizeOptionalNumber(input.salaryAmount);
  const payrollStartDate = normalizeOptionalDate(input.payrollStartDate);
  const payrollEndDate = normalizeOptionalDate(input.payrollEndDate);
  const payrollEligible = normalizeOptionalBoolean(input.payrollEligible);

  if (Number.isNaN(payRate) || Number.isNaN(salaryAmount)) {
    const error = new Error("payRate and salaryAmount must be valid numbers when provided");
    error.statusCode = 400;
    throw error;
  }

  if (input.payrollStartDate && !payrollStartDate) {
    const error = new Error("payrollStartDate must be a valid date");
    error.statusCode = 400;
    throw error;
  }

  if (input.payrollEndDate && !payrollEndDate) {
    const error = new Error("payrollEndDate must be a valid date");
    error.statusCode = 400;
    throw error;
  }

  if (payrollStartDate && payrollEndDate && payrollEndDate < payrollStartDate) {
    const error = new Error("payrollEndDate cannot be earlier than payrollStartDate");
    error.statusCode = 400;
    throw error;
  }

  return {
    compensationType:
      input.compensationType !== undefined
        ? compensationType
        : currentProfile.compensationType ?? null,
    payRate: input.payRate !== undefined ? payRate : currentProfile.payRate ?? null,
    salaryAmount:
      input.salaryAmount !== undefined
        ? salaryAmount
        : currentProfile.salaryAmount ?? null,
    payrollEligible:
      payrollEligible !== undefined
        ? payrollEligible
        : currentProfile.payrollEligible ?? false,
    workerClassification:
      input.workerClassification !== undefined
        ? workerClassification
        : currentProfile.workerClassification ?? null,
    employmentStatus:
      input.employmentStatus !== undefined
        ? employmentStatus
        : currentProfile.employmentStatus ?? "active",
    payrollProvider:
      input.payrollProvider !== undefined
        ? payrollProvider
        : currentProfile.payrollProvider ?? null,
    payrollProviderEmployeeId:
      input.payrollProviderEmployeeId !== undefined
        ? payrollProviderEmployeeId
        : currentProfile.payrollProviderEmployeeId ?? null,
    payrollStartDate:
      input.payrollStartDate !== undefined
        ? payrollStartDate
        : currentProfile.payrollStartDate ?? null,
    payrollEndDate:
      input.payrollEndDate !== undefined
        ? payrollEndDate
        : currentProfile.payrollEndDate ?? null,
  };
}

const createStaff = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const tenantId = req.user?.tenantId;
    const plan = req.plan;
    if (!tenantId || !plan) {
      return res.status(403).json({
        message: "Plan selection is required before managing staff.",
        code: "PLAN_REQUIRED",
      });
    }

    const currentCount = await Staff.countDocuments({
      tenantId,
      role: "staff",
    });

    if (typeof plan.maxStaff === "number" && currentCount >= plan.maxStaff) {
      return res.status(403).json({
        message: "Staff limit reached for your plan.",
        code: "STAFFSEAT_LIMIT",
        maxStaff: plan.maxStaff,
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const staffMember = await Staff.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      // role is DB-owned; do not accept from client
      tenantId,
    });
    
    // Hide password in response
    const { password: _, ...staffWithoutPassword } = staffMember.toObject();
    
    res.status(201).json(staffWithoutPassword);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc   Get all staff members
// @route  GET /api/staff
const getStaff = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const staffMembers = await Staff.find({ tenantId }).select(
      "firstName lastName email role clerkUserId isActive payrollProfile createdAt updatedAt"
    );
    res.json(staffMembers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Update payroll metadata for a staff member
// @route  PUT /api/staff/:staffId/payroll-profile
const updateStaffPayrollProfile = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const staffId = (req.params?.staffId || "").trim();
    if (!staffId) {
      return res.status(400).json({ message: "staffId is required" });
    }

    const staffMember = await Staff.findOne({ _id: staffId, tenantId });
    if (!staffMember) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    staffMember.payrollProfile = buildPayrollProfileUpdate(
      staffMember.payrollProfile || {},
      req.body
    );
    await staffMember.save();

    return res.json({
      message: "Payroll profile updated",
      staff: {
        id: staffMember._id.toString(),
        firstName: staffMember.firstName,
        lastName: staffMember.lastName,
        email: staffMember.email,
        role: staffMember.role,
        payrollProfile: staffMember.payrollProfile,
      },
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || "Server error" });
  }
};

module.exports = {
  createStaff,
  getStaff,
  updateStaffPayrollProfile,
};
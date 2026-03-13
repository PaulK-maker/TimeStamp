const Staff = require("../models/staff");

// @desc   Create a new staff member
// @route  POST /api/staff
const bcrypt = require("bcryptjs");

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
      "firstName lastName email role clerkUserId isActive createdAt updatedAt"
    );
    res.json(staffMembers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createStaff,
  getStaff,
};
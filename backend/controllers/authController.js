// backend/controllers/authController.js
const Staff = require("../models/staff");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const TimeEntry = require("../models/TimeEntry");

/**
 * REGISTER
 */
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const existingUser = await Staff.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const staffMember = await Staff.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      // role will default from schema
    });

    res.status(201).json({
      message: "Staff member registered",
      staff: {
        id: staffMember._id,
        role: staffMember.role,
        email: staffMember.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * LOGIN
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1) Basic validation
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password required" });
    }

    // 2) Find staff member and include password
    const staffMember = await Staff.findOne({ email }).select("+password");
    if (!staffMember) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 3) Compare password with bcrypt
    const isMatch = await bcrypt.compare(password, staffMember.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 4) Sign JWT including role
    const token = jwt.sign(
      { id: staffMember._id, role: staffMember.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // 5) Send response
    res.json({
      message: "Login successful",
      token,
      staff: {
        id: staffMember._id,
        firstName: staffMember.firstName,
        lastName: staffMember.lastName,
        email: staffMember.email,
        role: staffMember.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET ALL TIME LOGS (ADMIN)
 */
exports.getAllTimeLogs = async (req, res) => {
  try {
    const { staffId, startDate, endDate } = req.query;
    const filter = {};

    if (staffId) filter.staff = staffId;
    if (startDate || endDate) filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);

    const logs = await TimeEntry.find(filter)
      .populate("staff", "firstName lastName email")
      .sort({ createdAt: -1 });

    const logsWithHours = logs.map((log) => ({
      id: log._id,
      staff: log.staff,
      punchIn: log.punchIn,
      punchOut: log.punchOut,
      totalHours:
        log.punchOut && log.punchIn
          ? ((log.punchOut - log.punchIn) / (1000 * 60 * 60)).toFixed(2)
          : 0,
      createdAt: log.createdAt,
    }));

    const totalHoursPerStaff = {};
    logsWithHours.forEach((log) => {
      const id = log.staff._id.toString();
      if (!totalHoursPerStaff[id]) {
        totalHoursPerStaff[id] = {
          staff: log.staff,
          totalHours: 0,
        };
      }
      totalHoursPerStaff[id].totalHours += parseFloat(log.totalHours);
    });

    const totalHoursArray = Object.values(totalHoursPerStaff).map(
      (item) => ({
        staff: item.staff,
        totalHours: parseFloat(item.totalHours.toFixed(2)),
      })
    );

    res.json({
      count: logsWithHours.length,
      logs: logsWithHours,
      totalHoursPerStaff: totalHoursArray,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
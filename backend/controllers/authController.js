// backend/controllers/authController.js
const Caregiver = require("../models/caregiver");
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

    const existingUser = await Caregiver.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const caregiver = await Caregiver.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      // role will default from schema
    });

    res.status(201).json({
      message: "Caregiver registered",
      caregiver: {
        id: caregiver._id,
        role: caregiver.role,
        email: caregiver.email,
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

    // 2) Find caregiver and include password
    const caregiver = await Caregiver.findOne({ email }).select("+password");
    if (!caregiver) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 3) Compare password with bcrypt
    const isMatch = await bcrypt.compare(password, caregiver.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 4) Sign JWT including role
    const token = jwt.sign(
      { id: caregiver._id, role: caregiver.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // 5) Send response
    res.json({
      message: "Login successful",
      token,
      caregiver: {
        id: caregiver._id,
        firstName: caregiver.firstName,
        lastName: caregiver.lastName,
        email: caregiver.email,
        role: caregiver.role,
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
    const { caregiverId, startDate, endDate } = req.query;
    const filter = {};

    if (caregiverId) filter.caregiver = caregiverId;
    if (startDate || endDate) filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);

    const logs = await TimeEntry.find(filter)
      .populate("caregiver", "firstName lastName email")
      .sort({ createdAt: -1 });

    const logsWithHours = logs.map((log) => ({
      id: log._id,
      caregiver: log.caregiver,
      punchIn: log.punchIn,
      punchOut: log.punchOut,
      totalHours:
        log.punchOut && log.punchIn
          ? ((log.punchOut - log.punchIn) / (1000 * 60 * 60)).toFixed(2)
          : 0,
      createdAt: log.createdAt,
    }));

    const totalHoursPerCaregiver = {};
    logsWithHours.forEach((log) => {
      const id = log.caregiver._id.toString();
      if (!totalHoursPerCaregiver[id]) {
        totalHoursPerCaregiver[id] = {
          caregiver: log.caregiver,
          totalHours: 0,
        };
      }
      totalHoursPerCaregiver[id].totalHours += parseFloat(log.totalHours);
    });

    const totalHoursArray = Object.values(totalHoursPerCaregiver).map(
      (item) => ({
        caregiver: item.caregiver,
        totalHours: parseFloat(item.totalHours.toFixed(2)),
      })
    );

    res.json({
      count: logsWithHours.length,
      logs: logsWithHours,
      totalHoursPerCaregiver: totalHoursArray,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
const Caregiver = require("../models/caregiver");

// @desc   Create new caregiver
// @route  POST /api/caregivers
const bcrypt = require("bcryptjs");  // ADD THIS LINE AT TOP

const createCaregiver = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const caregiver = await Caregiver.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: role || "caregiver",  // allow admin role
    });
    
    // Hide password in response
    const { password: _, ...caregiverWithoutPassword } = caregiver.toObject();
    
    res.status(201).json(caregiverWithoutPassword);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
// @desc   Get all caregivers
// @route  GET /api/caregivers
const getCaregivers = async (req, res) => {
  try {
    const caregivers = await Caregiver.find();
    res.json(caregivers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createCaregiver,
  getCaregivers,
};
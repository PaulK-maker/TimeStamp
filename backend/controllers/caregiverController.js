const Caregiver = require("../models/caregiver");

// @desc   Create new caregiver
// @route  POST /api/caregivers
const createCaregiver = async (req, res) => {
  try {
    const caregiver = await Caregiver.create(req.body);
    res.status(201).json(caregiver);
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
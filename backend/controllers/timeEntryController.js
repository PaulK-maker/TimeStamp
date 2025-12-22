const TimeEntry = require("../models/TimeEntry");

// @desc   Punch IN
// @route  POST /api/timeclock/punch-in
const punchIn = async (req, res) => {
  const { caregiverId, notes } = req.body;

  try {
    // Check for active shift
    const activeShift = await TimeEntry.findOne({
      caregiver: caregiverId,
      punchOut: null,
    });

    if (activeShift) {
      return res.status(400).json({
        message: "Caregiver already punched in",
      });
    }

    const entry = await TimeEntry.create({
      caregiver: caregiverId,
      punchIn: new Date(),
      notes,
    });

    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Punch OUT
// @route  POST /api/timeclock/punch-out
const punchOut = async (req, res) => {
  const { caregiverId } = req.body;

  try {
    const activeShift = await TimeEntry.findOne({
      caregiver: caregiverId,
      punchOut: null,
    });

    if (!activeShift) {
      return res.status(400).json({
        message: "No active shift found",
      });
    }

    activeShift.punchOut = new Date();
    await activeShift.save();

    res.json(activeShift);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Get caregiver time entries
// @route  GET /api/timeclock/:caregiverId
const getTimeEntries = async (req, res) => {
  try {
    const entries = await TimeEntry.find({
      caregiver: req.params.caregiverId,
    }).sort({ punchIn: -1 });

    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Get total hours worked for caregiver
// @route  GET /api/timeclock/:caregiverId/total-hours
const getTotalHours = async (req, res) => {
  try {
    const entries = await TimeEntry.find({
      caregiver: req.params.caregiverId,
      punchOut: { $ne: null },
    });

    let totalMilliseconds = 0;

    entries.forEach((entry) => {
      const duration = entry.punchOut - entry.punchIn;
      totalMilliseconds += duration;
    });

    const totalHours = totalMilliseconds / (1000 * 60 * 60);

    res.json({
      caregiverId: req.params.caregiverId,
      totalHours: Number(totalHours.toFixed(2)),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  punchIn,
  punchOut,
  getTimeEntries,
  getTotalHours,
};
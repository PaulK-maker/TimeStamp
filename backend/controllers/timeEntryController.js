const TimeEntry = require("../models/TimeEntry");
const mongoose = require("mongoose");
const Caregiver = require("../models/caregiver");
const TimeEntryCorrection = require("../models/TimeEntryCorrection");

const resolveCaregiverObjectId = async (req) => {
  const candidate = req.user?.caregiverId || req.user?.id;
  if (!candidate) return null;

  if (mongoose.Types.ObjectId.isValid(candidate)) return candidate;

  // Clerk user ids look like "user_..."; map them to a Caregiver record.
  const caregiver = await Caregiver.findOne({ clerkUserId: candidate }).select(
    "_id"
  );
  return caregiver?._id?.toString() || null;
};

// @desc   Punch IN
// @route  POST /api/timeclock/punch-in
// @access Private (caregiver)
const punchIn = async (req, res) => {
  try {
    const caregiverId = await resolveCaregiverObjectId(req);
    if (!caregiverId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { notes } = req.body;

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
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// @desc   Punch OUT
// @route  POST /api/timeclock/punch-out
// @access Private (caregiver)
const punchOut = async (req, res) => {
  try {
    const caregiverId = await resolveCaregiverObjectId(req);
    if (!caregiverId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

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
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// @desc   Get caregiver time entries (for logged-in caregiver)
// @route  GET /api/timeclock/my-logs
// @access Private (caregiver)
const getMyTimeEntries = async (req, res) => {
  try {
    const caregiverId = await resolveCaregiverObjectId(req);
    if (!caregiverId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const entries = await TimeEntry.find({
      caregiver: caregiverId,
    }).sort({ punchIn: -1 });

    const entryIds = entries.map((e) => e._id);
    const corrections = await TimeEntryCorrection.find({
      timeEntry: { $in: entryIds },
    })
      .select("timeEntry effectivePunchIn effectivePunchOut")
      .lean();

    const correctionByEntryId = new Map(
      corrections.map((c) => [String(c.timeEntry), c])
    );

    const logs = entries.map((entry) => {
      const obj = entry.toObject();
      const correction = correctionByEntryId.get(String(entry._id));
      return {
        ...obj,
        effectivePunchIn: correction?.effectivePunchIn || obj.punchIn,
        effectivePunchOut:
          correction?.effectivePunchOut !== undefined
            ? correction.effectivePunchOut
            : obj.punchOut,
      };
    });

    res.json({ logs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Existing admin-style endpoints can stay if you still need them
// @desc   Get time entries by caregiverId (admin)
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

// @desc   Get total hours worked for caregiver (admin)
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
  getMyTimeEntries,
  getTimeEntries,
  getTotalHours,
};
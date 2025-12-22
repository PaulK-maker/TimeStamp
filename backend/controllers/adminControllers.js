const TimeEntry = require("../models/TimeEntry");

/**
 * GET /api/admin/timelogs
 * Admin-only: Get all time entries
 * Optional query params:
 *   caregiverId - filter by caregiver
 *   startDate / endDate - filter by date range
 */
exports.getAllTimeLogs = async (req, res) => {
  try {
    const { caregiverId, startDate, endDate } = req.query;

    let query = {};

    if (caregiverId) {
      query.caregiver = caregiverId;
    }

    if (startDate || endDate) {
      query.clockIn = {};
      if (startDate) query.clockIn.$gte = new Date(startDate);
      if (endDate) query.clockIn.$lte = new Date(endDate);
    }

    const logs = await TimeEntry.find(query)
      .populate("caregiver", "firstName lastName email role")
      .sort({ clockIn: -1 });

    res.json({ count: logs.length, logs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
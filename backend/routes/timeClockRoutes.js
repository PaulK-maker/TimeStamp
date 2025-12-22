const express = require("express");
const router = express.Router();

const {
  punchIn,
  punchOut,
  getTimeEntries,
  getTotalHours,
} = require("../controllers/timeEntryController");

// Punch in
router.post("/punch-in", punchIn);

// Punch out
router.post("/punch-out", punchOut);

// ✅ Total hours worked (MUST be before :caregiverId)
router.get("/:caregiverId/total-hours", getTotalHours);

// Get all time entries for a caregiver
router.get("/:caregiverId", getTimeEntries);

module.exports = router;
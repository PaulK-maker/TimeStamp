// const express = require("express");
// const router = express.Router();

// const {
//   punchIn,
//   punchOut,
//   getTimeEntries,
//   getTotalHours,
// } = require("../controllers/timeEntryController");

// // Punch in
// router.post("/punch-in", punchIn);

// // Punch out
// router.post("/punch-out", punchOut);

// // ✅ Total hours worked (MUST be before :caregiverId)
// router.get("/:caregiverId/total-hours", getTotalHours);

// // Get all time entries for a caregiver
// router.get("/:caregiverId", getTimeEntries);

// module.exports = router;


const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
  punchIn,
  punchOut,
  getMyTimeEntries,
  getTimeEntries,
  getTotalHours,
} = require("../controllers/timeEntryController");

router.post("/punch-in", protect, punchIn);
router.post("/punch-out", protect, punchOut);
router.get("/my-logs", protect, getMyTimeEntries);
// Backward-compatible alias for older clients
router.get("/mylogs", protect, getMyTimeEntries);

// existing admin endpoints (optional)
router.get("/:caregiverId", protect, getTimeEntries);
router.get("/:caregiverId/total-hours", protect, getTotalHours);

module.exports = router;
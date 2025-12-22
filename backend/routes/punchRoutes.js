const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { punchIn, punchOut, getHours } = require("../controllers/punchController");

// Protect all punch routes
router.post("/in", protect, punchIn);
router.post("/out", protect, punchOut);
router.get("/hours", protect, getHours);

module.exports = router;
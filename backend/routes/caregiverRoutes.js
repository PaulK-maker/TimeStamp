const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const {
  createCaregiver,
  getCaregivers,
} = require("../controllers/caregiverController");

// Admin-only for now
router.use(auth, authorizeRoles("admin"));

router.post("/", createCaregiver);
router.get("/", getCaregivers);

module.exports = router;
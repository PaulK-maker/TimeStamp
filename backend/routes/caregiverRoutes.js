const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { requirePlanSelected } = require("../middleware/tenantPlanMiddleware");
const {
  createCaregiver,
  getCaregivers,
} = require("../controllers/caregiverController");

// Admin-only + must have selected a plan
router.use(auth, authorizeRoles("admin"), requirePlanSelected());

router.post("/", createCaregiver);
router.get("/", getCaregivers);

module.exports = router;
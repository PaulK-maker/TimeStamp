const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { requirePlanSelected } = require("../middleware/tenantPlanMiddleware");
const { createStaff, getStaff } = require("../controllers/caregiverController");

router.use(auth, authorizeRoles("admin"), requirePlanSelected());

router.post("/", createStaff);
router.get("/", getStaff);

module.exports = router;
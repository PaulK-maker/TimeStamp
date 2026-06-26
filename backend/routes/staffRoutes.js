const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const {
	requirePlanSelected,
	requireFeature,
} = require("../middleware/tenantPlanMiddleware");
const {
	createStaff,
	getStaff,
	updateStaffPayrollProfile,
	updateStaffDefaultJob,
} = require("../controllers/caregiverController");

router.use(auth, authorizeRoles("admin"), requirePlanSelected());

router.post("/", createStaff);
router.get("/", getStaff);
router.put("/:staffId/payroll-profile", requireFeature("payroll"), updateStaffPayrollProfile);
router.put("/:staffId/default-job", requireFeature("dataManagement"), updateStaffDefaultJob);

module.exports = router;
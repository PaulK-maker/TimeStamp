const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { requireFeature } = require("../middleware/tenantPlanMiddleware");
const {
  getAllTimeLogs,
  promoteCaregiverToAdmin,
  demoteAdminToCaregiver,
  deleteUser,
} = require("../controllers/adminControllers");

const {
  adminListMissedPunchRequests,
  adminApproveMissedPunchRequest,
  adminRejectMissedPunchRequest,
} = require("../controllers/missedPunchController");

router.get(
  "/dashboard",
  auth,
  authorizeRoles("admin"),
  (req, res) => {
    res.json({ message: "Welcome Admin" });
  }
);

router.get(
  "/timelogs",
  auth,
  authorizeRoles("admin"),
  requireFeature("viewLogs"),
  getAllTimeLogs
);

// Print/export endpoint (separate from view-only) so printing can be plan-gated.
router.get(
  "/timelogs-export",
  auth,
  authorizeRoles("admin"),
  requireFeature("printing"),
  getAllTimeLogs
);

// Promote an existing caregiver to admin by email
router.post(
  "/promote",
  auth,
  authorizeRoles("admin"),
  requireFeature("dataManagement"),
  promoteCaregiverToAdmin
);

// Demote an admin to caregiver (by id or email)
router.post(
  "/demote",
  auth,
  authorizeRoles("admin"),
  requireFeature("dataManagement"),
  demoteAdminToCaregiver
);

// Delete (deprovision) a user (Clerk + local deactivate)
router.delete(
  "/users/:caregiverId",
  auth,
  authorizeRoles("admin"),
  requireFeature("dataManagement"),
  deleteUser
);

// Missed punch request review
router.get(
  "/missed-punch-requests",
  auth,
  authorizeRoles("admin"),
  requireFeature("missedPunchReview"),
  adminListMissedPunchRequests
);

router.post(
  "/missed-punch-requests/:id/approve",
  auth,
  authorizeRoles("admin"),
  requireFeature("missedPunchReview"),
  adminApproveMissedPunchRequest
);

router.post(
  "/missed-punch-requests/:id/reject",
  auth,
  authorizeRoles("admin"),
  requireFeature("missedPunchReview"),
  adminRejectMissedPunchRequest
);

module.exports = router;
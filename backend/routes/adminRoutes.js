const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
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
  getAllTimeLogs
);

// Promote an existing caregiver to admin by email
router.post(
  "/promote",
  auth,
  authorizeRoles("admin"),
  promoteCaregiverToAdmin
);

// Demote an admin to caregiver (by id or email)
router.post(
  "/demote",
  auth,
  authorizeRoles("admin"),
  demoteAdminToCaregiver
);

// Delete (deprovision) a user (Clerk + local deactivate)
router.delete(
  "/users/:caregiverId",
  auth,
  authorizeRoles("admin"),
  deleteUser
);

// Missed punch request review
router.get(
  "/missed-punch-requests",
  auth,
  authorizeRoles("admin"),
  adminListMissedPunchRequests
);

router.post(
  "/missed-punch-requests/:id/approve",
  auth,
  authorizeRoles("admin"),
  adminApproveMissedPunchRequest
);

router.post(
  "/missed-punch-requests/:id/reject",
  auth,
  authorizeRoles("admin"),
  adminRejectMissedPunchRequest
);

module.exports = router;
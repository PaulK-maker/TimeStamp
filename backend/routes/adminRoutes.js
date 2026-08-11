const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { requireFeature } = require("../middleware/tenantPlanMiddleware");
const requirePayrollRunAccess = require("../middleware/payrollAccessMiddleware");
const {
  getAllTimeLogs,
  promoteStaffToAdmin,
  demoteAdminToStaff,
  deleteUser,
  updateShiftLength,
  updateGeofenceSettings,
  grantPayrollRunAccess,
  revokePayrollRunAccess,
} = require("../controllers/adminControllers");
const {
  createPayrollRun,
  listPayrollRuns,
  listPayrollWebhookEvents,
  submitPayrollRun,
} = require("../controllers/payrollController");

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

// Promote an existing staff member to admin by email
router.post(
  "/promote",
  auth,
  authorizeRoles("admin"),
  requireFeature("dataManagement"),
  promoteStaffToAdmin
);

// Demote an admin to staff (by id or email)
router.post(
  "/demote",
  auth,
  authorizeRoles("admin"),
  requireFeature("dataManagement"),
  demoteAdminToStaff
);

// Delete (deprovision) a user (Clerk + local deactivate)
router.delete(
  "/users/:staffId",
  auth,
  authorizeRoles("admin"),
  requireFeature("dataManagement"),
  deleteUser
);

// Facility shift-length setting (used to derive a shifts-worked summary)
router.patch(
  "/shift-length",
  auth,
  authorizeRoles("admin"),
  requireFeature("dataManagement"),
  updateShiftLength
);

// Facility geofence settings (location + radius + enable/disable).
// Available on every plan - proof-of-presence is core to the product, not
// gated behind a paid data-management feature.
router.patch("/geofence", auth, authorizeRoles("admin"), updateGeofenceSettings);

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

router.get(
  "/payroll-runs",
  auth,
  authorizeRoles("admin"),
  requireFeature("payroll"),
  listPayrollRuns
);

router.post(
  "/payroll-runs",
  auth,
  authorizeRoles("admin"),
  requireFeature("payroll"),
  requirePayrollRunAccess,
  createPayrollRun
);

router.post(
  "/payroll-runs/:runId/submit",
  auth,
  authorizeRoles("admin"),
  requireFeature("payroll"),
  requirePayrollRunAccess,
  submitPayrollRun
);

router.get(
  "/payroll-webhook-events",
  auth,
  authorizeRoles("admin"),
  requireFeature("payroll"),
  listPayrollWebhookEvents
);

router.post(
  "/payroll-access/grant",
  auth,
  authorizeRoles("admin"),
  requireFeature("payroll"),
  requirePayrollRunAccess,
  grantPayrollRunAccess
);

router.post(
  "/payroll-access/revoke",
  auth,
  authorizeRoles("admin"),
  requireFeature("payroll"),
  requirePayrollRunAccess,
  revokePayrollRunAccess
);

module.exports = router;
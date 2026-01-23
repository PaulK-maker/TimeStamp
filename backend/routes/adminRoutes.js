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

module.exports = router;
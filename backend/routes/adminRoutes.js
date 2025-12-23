const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { getAllTimeLogs } = require("../controllers/adminControllers");

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

module.exports = router;
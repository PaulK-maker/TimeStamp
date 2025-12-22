// const express = require("express");
// const router = express.Router();
// const protect = require("../middleware/authMiddleware");
// const authorizeRoles = require("../middleware/roleMiddleware");

// // Import admin controller functions
// const { getAllTimeLogs } = require("../controllers/adminControllers");

// // -------------------------
// // Admin-only dashboard
// // -------------------------
// router.get(
//   "/dashboard",
//   protect,
//   authorizeRoles("admin"),
//   (req, res) => {
//     res.json({ message: "Welcome Admin" });
//   }
// );

// // -------------------------
// // Admin-only: Get all time logs
// // Supports optional query params:
// //   caregiverId - filter by caregiver
// //   startDate / endDate - filter by date range
// // -------------------------
// router.get(
//   "/timelogs",
//   protect,
//   authorizeRoles("admin"),
//   getAllTimeLogs
// );

// module.exports = router;


const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const { getAllTimeLogs } = require("../controllers/AdminControllers");

router.get(
  "/dashboard",
  protect,
  authorizeRoles("admin"),
  (req, res) => {
    res.json({ message: "Welcome Admin" });
  }
);

router.get(
  "/timelogs",
  protect,
  authorizeRoles("admin"),
  getAllTimeLogs
);

module.exports = router;
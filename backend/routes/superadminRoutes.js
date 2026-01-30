const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { requireSuperadminKey } = require("../middleware/superadminKeyMiddleware");

const {
  listFacilities,
  getFacilitySummary,
} = require("../controllers/superadminController");

// Strictly read-only superadmin routes
router.use(auth, authorizeRoles("superadmin"), requireSuperadminKey);

router.get("/facilities", listFacilities);
router.get("/facilities/:tenantCode/summary", getFacilitySummary);

module.exports = router;

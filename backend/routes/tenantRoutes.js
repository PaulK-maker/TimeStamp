const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  bootstrapTenant,
} = require("../controllers/tenantController");

// Admin-only: create a facility and bind yourself if unassigned.
router.post("/bootstrap", auth, authorizeRoles("admin"), bootstrapTenant);

module.exports = router;

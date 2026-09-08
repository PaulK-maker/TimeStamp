const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  bootstrapTenant,
  updateProfile,
} = require("../controllers/tenantController");

// Any authenticated user with no tenant may create one (they become admin on creation).
router.post("/bootstrap", auth, bootstrapTenant);

// Facility owner can edit the company name/tagline shown on estimates and invoices.
router.put("/profile", auth, authorizeRoles("admin"), updateProfile);

module.exports = router;

const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  listAvailablePlans,
  getMyBilling,
  selectPlan,
} = require("../controllers/billingController");

// Admin-only billing management (per-tenant)
router.use(auth, authorizeRoles("admin"));

router.get("/plans", listAvailablePlans);
router.get("/me", getMyBilling);
router.post("/select-plan", selectPlan);

module.exports = router;

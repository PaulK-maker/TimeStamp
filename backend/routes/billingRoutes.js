const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  listAvailablePlans,
  getMyBilling,
  selectPlan,
  createCheckoutSession,
  createPortalSession,
  cancelSubscription,
  listInvoices,
} = require("../controllers/billingController");

// Admin-only billing management (per-tenant)
router.use(auth, authorizeRoles("admin"));

router.get("/plans", listAvailablePlans);
router.get("/me", getMyBilling);
router.post("/select-plan", selectPlan);
router.post("/checkout-session", createCheckoutSession);
router.post("/portal-session", createPortalSession);
router.post("/cancel-subscription", cancelSubscription);
router.get("/invoices", listInvoices);

module.exports = router;

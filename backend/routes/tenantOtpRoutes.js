const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  sendJoinOtp,
  redeemJoinOtp,
  sendBootstrapOtp,
  verifyBootstrapOtp,
} = require("../controllers/tenantOtpController");

// Admin-only: send join invite OTP to an email
router.post("/send-join", auth, authorizeRoles("admin"), sendJoinOtp);

// Signed-in: redeem join invite OTP (binds to signed-in email)
router.post("/redeem-join", auth, redeemJoinOtp);

// Admin-only: send bootstrap-confirm OTP to self
router.post("/send-bootstrap", auth, authorizeRoles("admin"), sendBootstrapOtp);

// Admin-only: verify bootstrap-confirm OTP then create tenant
router.post("/verify-bootstrap", auth, authorizeRoles("admin"), verifyBootstrapOtp);

module.exports = router;

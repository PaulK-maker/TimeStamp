const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");

const {
  createMissedPunchRequest,
  getMyMissedPunchRequests,
  cancelMyMissedPunchRequest,
} = require("../controllers/missedPunchController");

router.post("/requests", auth, createMissedPunchRequest);
router.get("/requests/mine", auth, getMyMissedPunchRequests);
router.post("/requests/:id/cancel", auth, cancelMyMissedPunchRequest);

module.exports = router;

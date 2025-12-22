const express = require("express");
const router = express.Router();
const {
  createCaregiver,
  getCaregivers,
} = require("../controllers/caregiverController");

router.post("/", createCaregiver);
router.get("/", getCaregivers);

module.exports = router;
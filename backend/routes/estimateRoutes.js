const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const {
  listEstimates,
  createEstimate,
  updateEstimate,
  deleteEstimate,
  getNextEstimateNumber,
  convertToInvoice,
} = require("../controllers/estimateController");

// Secure all estimate endpoints for admins
router.use(auth);
router.use(authorizeRoles("admin"));

router.get("/", listEstimates);
router.post("/", createEstimate);
router.get("/next-number", getNextEstimateNumber);
router.put("/:id", updateEstimate);
router.delete("/:id", deleteEstimate);
router.post("/:id/convert-to-invoice", convertToInvoice);

module.exports = router;

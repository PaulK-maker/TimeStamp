const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const {
  listInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getUncalculatedBillable,
  getNextInvoiceNumber,
} = require("../controllers/invoiceController");

// Secure all invoicing endpoints for admins
router.use(auth);
router.use(authorizeRoles("admin"));

router.get("/", listInvoices);
router.post("/", createInvoice);
router.get("/uncalculated-billable", getUncalculatedBillable);
router.get("/next-number", getNextInvoiceNumber);
router.put("/:id", updateInvoice);
router.delete("/:id", deleteInvoice);

module.exports = router;

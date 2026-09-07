const Estimate = require("../models/Estimate");
const Invoice = require("../models/Invoice");

const DEFAULT_TERMS = "Standard Net 30 Terms apply. Late payments are subject to a 1.5% interest charge per month.";

function compileItems(items) {
  return (items || []).map((it) => {
    const description = (it.description || "").trim();
    const qty = Number(it.qty) || 0;
    const rate = Number(it.rate) || 0;
    return {
      description,
      qty,
      rate,
      amount: Math.round(qty * rate * 100) / 100,
    };
  });
}

function calculateTotals(estimate) {
  const subtotal = (estimate.items || []).reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const discountAmount = estimate.discountType === "percent"
    ? subtotal * ((Number(estimate.discountValue) || 0) / 100)
    : (Number(estimate.discountValue) || 0);
  const afterDiscount = Math.max(subtotal - discountAmount, 0);
  const tax = afterDiscount * ((Number(estimate.taxRate) || 0) / 100);
  const total = afterDiscount + tax;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

// GET /api/estimates
exports.listEstimates = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant required" });

    const estimates = await Estimate.find({ tenantId }).sort({ createdAt: -1 });
    res.json({ estimates });
  } catch (err) {
    console.error("List estimates error:", err);
    res.status(500).json({ message: "Failed to list estimates" });
  }
};

// POST /api/estimates
exports.createEstimate = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant required" });

    const {
      estimateNumber, clientName, billTo, date, validUntil, status,
      items, discountType, discountValue, taxRate, businessCategory, terms, notes,
    } = req.body;

    const existing = await Estimate.findOne({ tenantId, estimateNumber: estimateNumber.trim() });
    if (existing) {
      return res.status(400).json({ message: `Estimate number ${estimateNumber} already exists.` });
    }

    const estimate = await Estimate.create({
      tenantId,
      estimateNumber: estimateNumber.trim() || `EST-${Date.now().toString().slice(-6)}`,
      clientName: clientName.trim(),
      billTo: (billTo || "").trim(),
      date: date ? new Date(date) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: status || "Draft",
      items: compileItems(items),
      discountType: discountType === "percent" ? "percent" : "flat",
      discountValue: Number(discountValue) || 0,
      taxRate: Number(taxRate) || 0,
      businessCategory: (businessCategory || "Professional Services").trim(),
      terms: (terms || DEFAULT_TERMS).trim(),
      notes: (notes || "").trim(),
    });

    res.json({ message: "Estimate created successfully", estimate });
  } catch (err) {
    console.error("Create estimate error:", err);
    res.status(500).json({ message: "Failed to create estimate" });
  }
};

// PUT /api/estimates/:id
exports.updateEstimate = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant required" });

    const {
      estimateNumber, clientName, billTo, date, validUntil, status,
      items, discountType, discountValue, taxRate, businessCategory, terms, notes,
    } = req.body;

    const estimate = await Estimate.findOne({ _id: req.params.id, tenantId });
    if (!estimate) return res.status(404).json({ message: "Estimate not found" });

    if (estimateNumber && estimateNumber.trim() !== estimate.estimateNumber) {
      const existing = await Estimate.findOne({ tenantId, estimateNumber: estimateNumber.trim() });
      if (existing) {
        return res.status(400).json({ message: `Estimate number ${estimateNumber} already exists.` });
      }
      estimate.estimateNumber = estimateNumber.trim();
    }

    if (clientName) estimate.clientName = clientName.trim();
    if (billTo !== undefined) estimate.billTo = billTo.trim();
    if (date) estimate.date = new Date(date);
    if (validUntil) estimate.validUntil = new Date(validUntil);
    if (status) estimate.status = status;
    if (discountType !== undefined) estimate.discountType = discountType === "percent" ? "percent" : "flat";
    if (discountValue !== undefined) estimate.discountValue = Number(discountValue) || 0;
    if (taxRate !== undefined) estimate.taxRate = Number(taxRate) || 0;
    if (businessCategory !== undefined) estimate.businessCategory = businessCategory.trim() || "Professional Services";
    if (terms !== undefined) estimate.terms = terms.trim() || DEFAULT_TERMS;
    if (notes !== undefined) estimate.notes = notes.trim();
    if (items) estimate.items = compileItems(items);

    await estimate.save();
    res.json({ message: "Estimate updated successfully", estimate });
  } catch (err) {
    console.error("Update estimate error:", err);
    res.status(500).json({ message: "Failed to update estimate" });
  }
};

// DELETE /api/estimates/:id
exports.deleteEstimate = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant required" });

    const deleted = await Estimate.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!deleted) return res.status(404).json({ message: "Estimate not found" });

    res.json({ message: "Estimate deleted successfully" });
  } catch (err) {
    console.error("Delete estimate error:", err);
    res.status(500).json({ message: "Failed to delete estimate" });
  }
};

// GET /api/estimates/next-number
exports.getNextEstimateNumber = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant required" });

    const lastEstimate = await Estimate.findOne({ tenantId }).sort({ createdAt: -1 });

    if (!lastEstimate) {
      return res.json({ nextNumber: "EST-0001" });
    }

    const currentNumberStr = lastEstimate.estimateNumber || "";
    const match = currentNumberStr.match(/\d+/);
    if (!match) {
      return res.json({ nextNumber: currentNumberStr + "-0001" });
    }

    const numberValue = parseInt(match[0], 10);
    const nextValue = numberValue + 1;
    const paddedValue = String(nextValue).padStart(match[0].length, "0");
    const nextNumber = currentNumberStr.replace(match[0], paddedValue);

    res.json({ nextNumber });
  } catch (err) {
    console.error("Get next estimate number failed:", err);
    res.status(500).json({ message: "Failed to generate consecutive estimate number" });
  }
};

// POST /api/estimates/:id/convert-to-invoice
exports.convertToInvoice = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant required" });

    const estimate = await Estimate.findOne({ _id: req.params.id, tenantId });
    if (!estimate) return res.status(404).json({ message: "Estimate not found" });
    if (estimate.convertedInvoiceId) {
      return res.status(400).json({ message: "This estimate was already converted to an invoice." });
    }

    const totals = calculateTotals(estimate);

    // Invoice schema has no discount field, so fold it in as a visible negative line item.
    const invoiceItems = estimate.items.map((it) => ({
      description: it.description,
      hours: it.qty,
      rate: it.rate,
      amount: it.amount,
    }));
    if (totals.discountAmount > 0) {
      invoiceItems.push({
        description: "Discount",
        hours: 1,
        rate: -totals.discountAmount,
        amount: -totals.discountAmount,
      });
    }

    const lastInvoice = await Invoice.findOne({ tenantId }).sort({ createdAt: -1 });
    let nextInvoiceNumber = "INV-0001";
    if (lastInvoice) {
      const match = (lastInvoice.invoiceNumber || "").match(/\d+/);
      if (match) {
        const paddedValue = String(parseInt(match[0], 10) + 1).padStart(match[0].length, "0");
        nextInvoiceNumber = lastInvoice.invoiceNumber.replace(match[0], paddedValue);
      }
    }

    const invoice = await Invoice.create({
      tenantId,
      invoiceNumber: nextInvoiceNumber,
      clientName: estimate.clientName,
      billTo: estimate.billTo,
      date: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "Draft",
      items: invoiceItems,
      taxRate: estimate.taxRate,
      businessCategory: estimate.businessCategory,
      terms: estimate.terms,
      notes: estimate.notes,
    });

    estimate.status = "Converted";
    estimate.convertedInvoiceId = invoice._id;
    await estimate.save();

    res.json({ message: "Estimate converted to invoice successfully", estimate, invoice });
  } catch (err) {
    console.error("Convert estimate to invoice error:", err);
    res.status(500).json({ message: "Failed to convert estimate to invoice" });
  }
};

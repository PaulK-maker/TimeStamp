const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const TimeEntry = require("../models/TimeEntry");
const Job = require("../models/Job");

// GET /api/admin/invoices
exports.listInvoices = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant required" });

    const invoices = await Invoice.find({ tenantId }).sort({ createdAt: -1 });
    res.json({ invoices });
  } catch (err) {
    console.error("List invoices error:", err);
    res.status(500).json({ message: "Failed to list invoices" });
  }
};

// POST /api/admin/invoices
exports.createInvoice = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant required" });

    const { invoiceNumber, clientName, billTo, date, dueDate, status, items, taxRate, businessCategory, terms, notes } = req.body;

    // Check if invoice number is unique for this tenant
    const existing = await Invoice.findOne({ tenantId, invoiceNumber: invoiceNumber.trim() });
    if (existing) {
      return res.status(400).json({ message: `Invoice number ${invoiceNumber} already exists.` });
    }

    const compiledItems = (items || []).map((it) => {
      const description = (it.description || "").trim();
      const hours = Number(it.hours) || 0;
      const rate = Number(it.rate) || 0;
      return {
        description,
        hours,
        rate,
        amount: Math.round(hours * rate * 100) / 100,
      };
    });

    const invoice = await Invoice.create({
      tenantId,
      invoiceNumber: invoiceNumber.trim() || `INV-${Date.now().toString().slice(-6)}`,
      clientName: clientName.trim(),
      billTo: (billTo || "").trim(),
      date: date ? new Date(date) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: status || "Draft",
      items: compiledItems,
      taxRate: Number(taxRate) || 0,
      businessCategory: (businessCategory || "Professional Services").trim(),
      terms: (terms || "Standard Net 30 Terms apply. Late payments are subject to a 1.5% interest charge per month.").trim(),
      notes: (notes || "").trim(),
    });

    res.json({ message: "Invoice created successfully", invoice });
  } catch (err) {
    console.error("Create invoice error:", err);
    res.status(500).json({ message: "Failed to create invoice" });
  }
};

// PUT /api/admin/invoices/:id
exports.updateInvoice = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant required" });

    const { invoiceNumber, clientName, billTo, date, dueDate, status, items, taxRate, notes, businessCategory, terms } = req.body;

    const invoice = await Invoice.findOne({ _id: req.params.id, tenantId });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    if (invoiceNumber && invoiceNumber.trim() !== invoice.invoiceNumber) {
      const existing = await Invoice.findOne({ tenantId, invoiceNumber: invoiceNumber.trim() });
      if (existing) {
        return res.status(400).json({ message: `Invoice number ${invoiceNumber} already exists.` });
      }
      invoice.invoiceNumber = invoiceNumber.trim();
    }

    if (clientName) invoice.clientName = clientName.trim();
    if (billTo !== undefined) invoice.billTo = billTo.trim();
    if (date) invoice.date = new Date(date);
    if (dueDate) invoice.dueDate = new Date(dueDate);
    if (status) invoice.status = status;
    if (taxRate !== undefined) invoice.taxRate = Number(taxRate) || 0;
    if (businessCategory !== undefined) invoice.businessCategory = businessCategory.trim() || "Professional Services";
    if (terms !== undefined) invoice.terms = terms.trim() || "Standard Net 30 Terms apply. Late payments are subject to a 1.5% interest charge per month.";
    if (notes !== undefined) invoice.notes = notes.trim();

    if (items) {
      invoice.items = items.map((it) => {
        const description = (it.description || "").trim();
        const hours = Number(it.hours) || 0;
        const rate = Number(it.rate) || 0;
        return {
          description,
          hours,
          rate,
          amount: Math.round(hours * rate * 100) / 100,
        };
      });
    }

    await invoice.save();
    res.json({ message: "Invoice updated successfully", invoice });
  } catch (err) {
    console.error("Update invoice error:", err);
    res.status(500).json({ message: "Failed to update invoice" });
  }
};

// DELETE /api/admin/invoices/:id
exports.deleteInvoice = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant required" });

    const deleted = await Invoice.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!deleted) return res.status(404).json({ message: "Invoice not found" });

    res.json({ message: "Invoice deleted successfully" });
  } catch (err) {
    console.error("Delete invoice error:", err);
    res.status(500).json({ message: "Failed to delete invoice" });
  }
};

// GET /api/admin/invoices/uncalculated-billable
// Fetches the time entries grouped by Job (Client/Project) and suggests amounts based on ratePerHour.
exports.getUncalculatedBillable = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant required" });

    const { startDate, endDate } = req.query;

    let timeQuery = { tenantId };
    if (startDate || endDate) {
      timeQuery.punchIn = {};
      if (startDate) timeQuery.punchIn.$gte = new Date(startDate);
      if (endDate) timeQuery.punchIn.$lte = new Date(endDate);
    }

    // Load active jobs (projects)
    const jobs = await Job.find({ tenantId, isActive: true });
    const jobMap = new Map(jobs.map(j => [j._id.toString(), j]));

    // Load all completed time logs in that range
    const logs = await TimeEntry.find({
      ...timeQuery,
      punchOut: { $ne: null },
    });

    const billingByJob = {};

    logs.forEach((log) => {
      const jobId = log.job?.toString();
      if (!jobId || !jobMap.has(jobId)) return;

      const job = jobMap.get(jobId);
      const hours = (new Date(log.punchOut) - new Date(log.punchIn)) / (1000 * 60 * 60);

      if (!billingByJob[jobId]) {
        billingByJob[jobId] = {
          jobId,
          jobName: job.name,
          ratePerHour: job.ratePerHour || 0,
          totalHours: 0,
          rawLogsCount: 0,
        };
      }

      billingByJob[jobId].totalHours += hours;
      billingByJob[jobId].rawLogsCount += 1;
    });

    // Format output
    const suggestions = Object.values(billingByJob).map((s) => {
      const roundedHours = Math.round(s.totalHours * 100) / 100;
      return {
        ...s,
        totalHours: roundedHours,
        suggestedAmount: Math.round(roundedHours * s.ratePerHour * 100) / 100,
      };
    });

    res.json({ suggestions });
  } catch (err) {
    console.error("Get uncalculated billable suggestions failed:", err);
    res.status(500).json({ message: "Failed to get billing suggestions" });
  }
};

// GET /api/admin/invoices/next-number
exports.getNextInvoiceNumber = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant required" });

    // Find the newest invoice to increment consecutive numbers
    const lastInvoice = await Invoice.findOne({ tenantId }).sort({ createdAt: -1 });

    if (!lastInvoice) {
      return res.json({ nextNumber: "INV-0001" });
    }

    const currentNumberStr = lastInvoice.invoiceNumber || "";
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
    console.error("Get next invoice number failed:", err);
    res.status(500).json({ message: "Failed to generate consecutive invoice number" });
  }
};

const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    billTo: {
      type: String,
      trim: true,
      default: "",
    },
    date: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Draft", "Sent", "Paid", "Overdue"],
      default: "Draft",
      index: true,
    },
    items: [
      {
        description: { type: String, required: true },
        hours: { type: Number, required: true, default: 0 },
        rate: { type: Number, required: true, default: 0 },
        amount: { type: Number, required: true, default: 0 },
      },
    ],
    taxRate: {
      type: Number,
      default: 0,
    },
    businessCategory: {
      type: String,
      trim: true,
      default: "Professional Services",
    },
    terms: {
      type: String,
      trim: true,
      default: "Standard Net 30 Terms apply. Late payments are subject to a 1.5% interest charge per month.",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// Ensure invoice numbers are unique per tenant (facility)
invoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);

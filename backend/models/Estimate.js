const mongoose = require("mongoose");

const estimateSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    estimateNumber: {
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
    validUntil: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Draft", "Sent", "Approved", "Declined", "Converted"],
      default: "Draft",
      index: true,
    },
    items: [
      {
        description: { type: String, required: true },
        qty: { type: Number, required: true, default: 1 },
        rate: { type: Number, required: true, default: 0 },
        amount: { type: Number, required: true, default: 0 },
      },
    ],
    discountType: {
      type: String,
      enum: ["flat", "percent"],
      default: "flat",
    },
    discountValue: {
      type: Number,
      default: 0,
    },
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
    // Set once this estimate has been turned into a real client invoice
    convertedInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },
  },
  { timestamps: true }
);

// Ensure estimate numbers are unique per tenant (facility)
estimateSchema.index({ tenantId: 1, estimateNumber: 1 }, { unique: true });

module.exports = mongoose.models.Estimate || mongoose.model("Estimate", estimateSchema);

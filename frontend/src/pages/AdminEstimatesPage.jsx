import React, { useEffect, useState, useCallback } from "react";
import Header from "../components/Header";
import api from "../services/api";
import { getMe } from "../services/me";

const DEFAULT_TERMS = "Standard Net 30 Terms apply. Late payments are subject to a 1.5% interest charge per month.";

const BLANK_ESTIMATE = {
  estimateNumber: "",
  clientName: "",
  billTo: "",
  date: new Date().toISOString().slice(0, 10),
  validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  status: "Draft",
  items: [{ description: "", qty: 1, rate: 0 }],
  discountType: "flat",
  discountValue: 0,
  taxRate: 0,
  businessCategory: "Professional Services",
  terms: DEFAULT_TERMS,
  notes: "",
};

// Bigger tap targets than the Invoice page - this form is meant to be filled out on a phone, on-site.
const inputStyle = { width: "100%", padding: 12, borderRadius: 8, border: "1px solid #ddd", fontSize: 15, minHeight: 44 };
const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 };

export default function AdminEstimatesPage() {
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_ESTIMATE);
  const [editingId, setEditingId] = useState(null);
  const [tenantName, setTenantName] = useState("Your Company");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [estRes, meRes] = await Promise.all([
        api.get("/estimates"),
        getMe(),
      ]);
      setEstimates(estRes.data?.estimates || []);
      setTenantName(meRes?.tenantName || "Your Company");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load estimates workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleOpenNew = async () => {
    setError("");
    setEditingId(null);
    try {
      const numRes = await api.get("/estimates/next-number");
      setForm({
        ...BLANK_ESTIMATE,
        estimateNumber: numRes.data?.nextNumber || "EST-0001",
        date: new Date().toISOString().slice(0, 10),
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      });
      setShowForm(true);
    } catch {
      setForm(BLANK_ESTIMATE);
      setShowForm(true);
    }
  };

  const handleEdit = (est) => {
    setEditingId(est._id);
    setForm({
      estimateNumber: est.estimateNumber,
      clientName: est.clientName,
      billTo: est.billTo || "",
      date: est.date ? est.date.slice(0, 10) : "",
      validUntil: est.validUntil ? est.validUntil.slice(0, 10) : "",
      status: est.status || "Draft",
      items: est.items?.length ? est.items.map(it => ({
        description: it.description,
        qty: it.qty,
        rate: it.rate,
      })) : [{ description: "", qty: 1, rate: 0 }],
      discountType: est.discountType || "flat",
      discountValue: est.discountValue || 0,
      taxRate: est.taxRate || 0,
      businessCategory: est.businessCategory || "Professional Services",
      terms: est.terms || DEFAULT_TERMS,
      notes: est.notes || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this estimate permanently?")) return;
    try {
      await api.delete(`/estimates/${id}`);
      await fetchAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete estimate");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (editingId) {
        await api.put(`/estimates/${editingId}`, form);
      } else {
        await api.post("/estimates", form);
      }
      setShowForm(false);
      await fetchAll();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to save estimate");
    }
  };

  const handleConvert = async (est) => {
    if (!window.confirm(`Convert ${est.estimateNumber} into a real invoice for ${est.clientName}?`)) return;
    setError("");
    setMessage("");
    try {
      await api.post(`/estimates/${est._id}/convert-to-invoice`);
      setMessage("Estimate converted — view it in Invoices.");
      await fetchAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to convert estimate to invoice");
    }
  };

  const handleAddItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", qty: 1, rate: 0 }],
    }));
  };

  const handleRemoveItem = (index) => {
    setForm((prev) => {
      const items = prev.items.filter((_, idx) => idx !== index);
      return { ...prev, items: items.length ? items : [{ description: "", qty: 1, rate: 0 }] };
    });
  };

  const handleItemChange = (index, key, val) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [key]: val };
      return { ...prev, items };
    });
  };

  const calculateTotals = (currentForm) => {
    const subtotal = (currentForm.items || []).reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
    const discountAmount = currentForm.discountType === "percent"
      ? subtotal * ((Number(currentForm.discountValue) || 0) / 100)
      : (Number(currentForm.discountValue) || 0);
    const afterDiscount = Math.max(subtotal - discountAmount, 0);
    const tax = afterDiscount * ((Number(currentForm.taxRate) || 0) / 100);
    const total = afterDiscount + tax;
    return {
      subtotal: subtotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
    };
  };

  const handlePrint = (est) => {
    const totals = calculateTotals(est);
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <html>
      <head>
        <title>Estimate - ${est.estimateNumber}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: Arial, sans-serif;
            font-size: 14px;
            color: #333;
            line-height: 1.5;
            padding: 40px;
          }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #111; padding-bottom: 20px; }
          .company-info { flex: 1; }
          .company-name { font-size: 32px; font-weight: 900; text-transform: uppercase; color: #111; letter-spacing: -1px; }
          .company-category { font-size: 12px; text-transform: uppercase; color: #666; font-weight: 700; margin-top: 2px; letter-spacing: 1px; }
          .estimate-title { font-size: 16px; color: #999; font-weight: 600; margin-top: 8px; }
          .estimate-subtitle { font-size: 11px; color: #b45309; font-weight: 600; margin-top: 4px; }
          .estimate-number { font-size: 22px; font-weight: 800; color: #111; }
          .powered-by { text-align: right; }
          .powered-text { font-size: 11px; color: #999; }
          .meta-info { display: flex; justify-content: space-between; margin-bottom: 30px; gap: 40px; }
          .meta-block { flex: 1; }
          .meta-label { font-size: 11px; text-transform: uppercase; color: #666; font-weight: 700; margin-bottom: 4px; }
          .meta-value { font-size: 15px; font-weight: 600; color: #111; }
          table { width: 100%; border-collapse: collapse; margin: 30px 0; }
          th { background: #f4f4f4; padding: 12px; font-size: 12px; text-transform: uppercase; font-weight: 700; text-align: left; }
          td { padding: 12px; border-bottom: 1px solid #eee; }
          .num-col { text-align: right; }
          .summary-container { display: flex; justify-content: flex-end; margin-top: 20px; }
          .summary-table { width: 300px; }
          .summary-table td { padding: 8px 12px; border: none; }
          .summary-table tr.total-row td { border-top: 2px solid #111; font-size: 18px; font-weight: 800; color: #111; padding-top: 12px; }
          .terms-container { margin-top: 40px; background: #f8f8f8; border-left: 4px solid #111; padding: 14px 16px; border-radius: 2px; }
          .terms-label { font-size: 11px; text-transform: uppercase; color: #666; font-weight: 800; margin-bottom: 6px; letter-spacing: 1px; }
          .terms-text { font-size: 12px; color: #333; line-height: 1.6; }
          .footer-note { margin-top: 60px; text-align: center; font-size: 12px; color: #666; border-top: 1px dotted #ccc; padding-top: 14px; }
          .powered-by-footer { margin-top: 20px; text-align: center; font-size: 10px; color: #bbb; }
          @page { margin: 0.5in; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            <div class="company-name">${tenantName}</div>
            <div class="company-category">${est.businessCategory || "Professional Services"}</div>
            <div class="estimate-title">Estimate</div>
            <div class="estimate-number">#${est.estimateNumber}</div>
            <div class="estimate-subtitle">This is an estimate, not a bill — pricing may change if scope changes.</div>
          </div>
          <div class="powered-by">
            <div class="powered-text">Estimating System</div>
            <div class="powered-text" style="margin-top: 20px; font-size: 10px; color: #ccc;">Powered by TimeStamp</div>
          </div>
        </div>

        <div class="meta-info">
          <div class="meta-block">
            <div class="meta-label">Prepared For</div>
            <div class="meta-value" style="font-size:16px; margin-bottom: 4px;">${est.clientName}</div>
            <div class="meta-value" style="font-weight: 400; font-size: 13px; white-space: pre-wrap; color: #555;">${est.billTo || "Address not provided"}</div>
          </div>
          <div class="meta-block" style="text-align: right; max-width: 250px;">
            <div style="margin-bottom: 10px;">
              <div class="meta-label">Date Issued</div>
              <div class="meta-value" style="font-weight: 500;">${new Date(est.date).toLocaleDateString()}</div>
            </div>
            <div>
              <div class="meta-label">Valid Until</div>
              <div class="meta-value" style="color: #b45309;">${new Date(est.validUntil).toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="num-col" style="width: 100px;">Qty</th>
              <th class="num-col" style="width: 120px;">Rate</th>
              <th class="num-col" style="width: 120px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(est.items || []).map((it) => `
              <tr>
                <td style="font-weight: 600;">${it.description || "Line item"}</td>
                <td class="num-col">${it.qty}</td>
                <td class="num-col">$${Number(it.rate).toFixed(2)}</td>
                <td class="num-col" style="font-weight: 600;">$${Number(it.amount).toFixed(2)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div class="summary-container">
          <table class="summary-table">
            <tr>
              <td style="font-weight: 700; color: #666;">Subtotal:</td>
              <td class="num-col" style="font-weight: 600;">$${totals.subtotal}</td>
            </tr>
            ${Number(totals.discountAmount) > 0 ? `
              <tr>
                <td style="font-weight: 700; color: #666;">Discount:</td>
                <td class="num-col" style="font-weight: 600;">-$${totals.discountAmount}</td>
              </tr>
            ` : ""}
            ${Number(totals.tax) > 0 ? `
              <tr>
                <td style="font-weight: 700; color: #666;">Tax (${est.taxRate}%):</td>
                <td class="num-col" style="font-weight: 600;">$${totals.tax}</td>
              </tr>
            ` : ""}
            <tr class="total-row">
              <td>Estimated Total:</td>
              <td class="num-col">$${totals.total}</td>
            </tr>
          </table>
        </div>

        ${est.terms ? `
          <div class="terms-container">
            <div class="terms-label">Payment Terms & Conditions</div>
            <div class="terms-text">${est.terms}</div>
          </div>
        ` : ""}

        ${est.notes ? `
          <div style="margin-top: 30px; background: #fafafa; border: 1px dashed #ddd; padding: 14px; border-radius: 6px;">
            <div class="meta-label" style="margin-bottom: 6px;">Notes</div>
            <div style="font-size: 13px; color: #444; white-space: pre-wrap;">${est.notes}</div>
          </div>
        ` : ""}

        <div class="footer-note">
          Thank you for the opportunity to earn your business!
        </div>
        <div class="powered-by-footer">
          This estimate was generated using TimeStamp Estimating System
        </div>
      </body>
      </html>
    `);

    win.document.close();
    win.print();
  };

  const statusStyles = {
    Draft: { bg: "#f3f4f6", color: "#1f2937", border: "#e5e7eb" },
    Sent: { bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" },
    Approved: { bg: "#d1fae5", color: "#047857", border: "#a7f3d0" },
    Declined: { bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5" },
    Converted: { bg: "#ede9fe", color: "#6d28d9", border: "#ddd6fe" },
  };

  const totals = calculateTotals(form);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <Header title="Estimates" />

      {error && (
        <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "12px 18px", borderRadius: 8, marginBottom: 20 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {message && (
        <div style={{ background: "#d1fae5", color: "#047857", padding: "12px 18px", borderRadius: 8, marginBottom: 20 }}>
          {message}
        </div>
      )}

      {/* Estimates Ledger Table */}
      {!showForm && (
        <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 10, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Contractor Estimates</h3>
              <p style={{ margin: "2px 0 0", color: "#6b7280", fontSize: 13 }}>Quick, editable quotes you can fill out on the phone on-site.</p>
            </div>
            <button
              onClick={handleOpenNew}
              style={{
                padding: "12px 20px", background: "#111827", color: "white", border: "none", borderRadius: 8,
                fontWeight: 600, cursor: "pointer", fontSize: 15, minHeight: 44,
              }}
            >
              + New Estimate
            </button>
          </div>

          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading estimates...</p>
          ) : estimates.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>
              <span style={{ fontSize: 32 }}>🧮</span>
              <p style={{ marginTop: 8, fontWeight: 500 }}>No Estimates Yet</p>
              <p style={{ fontSize: 12, margin: "2px 0 0" }}>Create a rough quote for a client before writing an invoice!</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 850 }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: 12, textAlign: "left", fontSize: 12, textTransform: "uppercase", color: "#374151" }}>Estimate #</th>
                    <th style={{ padding: 12, textAlign: "left", fontSize: 12, textTransform: "uppercase", color: "#374151" }}>Client Name</th>
                    <th style={{ padding: 12, textAlign: "left", fontSize: 12, textTransform: "uppercase", color: "#374151" }}>Created Date</th>
                    <th style={{ padding: 12, textAlign: "left", fontSize: 12, textTransform: "uppercase", color: "#374151" }}>Valid Until</th>
                    <th style={{ padding: 12, textAlign: "left", fontSize: 12, textTransform: "uppercase", color: "#374151" }}>Status</th>
                    <th style={{ padding: 12, textAlign: "right", fontSize: 12, textTransform: "uppercase", color: "#374151" }}>Estimated Total</th>
                    <th style={{ padding: 12, textAlign: "right", fontSize: 12, textTransform: "uppercase", color: "#374151" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {estimates.map((est) => {
                    const t = calculateTotals(est);
                    const style = statusStyles[est.status] || statusStyles.Draft;

                    return (
                      <tr key={est._id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: 12, fontWeight: 700, color: "#111" }}>{est.estimateNumber}</td>
                        <td style={{ padding: 12, fontWeight: 500 }}>{est.clientName}</td>
                        <td style={{ padding: 12, fontSize: 13, color: "#444" }}>{est.date ? new Date(est.date).toLocaleDateString() : "-"}</td>
                        <td style={{ padding: 12, fontSize: 13, color: "#b45309" }}>{est.validUntil ? new Date(est.validUntil).toLocaleDateString() : "-"}</td>
                        <td style={{ padding: 12 }}>
                          <span style={{
                            display: "inline-block", padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                            background: style.bg, color: style.color, border: `1px solid ${style.border}`,
                          }}>
                            {est.status}
                          </span>
                        </td>
                        <td style={{ padding: 12, textAlign: "right", fontWeight: 700 }}>${t.total}</td>
                        <td style={{ padding: 12, textAlign: "right" }}>
                          <button
                            onClick={() => handlePrint(est)}
                            style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, background: "#d1fae5", border: "1px solid #10b981", color: "#047857", cursor: "pointer", fontWeight: 600, marginRight: 6, minHeight: 36 }}
                          >
                            Print / PDF
                          </button>
                          <button
                            onClick={() => handleEdit(est)}
                            style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, background: "white", border: "1px solid #ddd", color: "#111827", cursor: "pointer", fontWeight: 500, marginRight: 6, minHeight: 36 }}
                          >
                            Edit
                          </button>
                          {est.status !== "Converted" && (
                            <button
                              onClick={() => handleConvert(est)}
                              style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, background: "#ede9fe", border: "1px solid #c4b5fd", color: "#6d28d9", cursor: "pointer", fontWeight: 600, marginRight: 6, minHeight: 36 }}
                            >
                              Convert to Invoice
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(est._id)}
                            style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, background: "#fee2e2", border: "1px solid #f87171", color: "#b91c1c", cursor: "pointer", fontWeight: 500, minHeight: 36 }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Estimate Form (Create / Edit Modal) */}
      {showForm && (
        <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 10, padding: 28, marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", paddingBottom: 14, marginBottom: 20 }}>
            <h3 style={{ margin: 0 }}>{editingId ? "✏️ Edit Estimate" : "➕ New Estimate"}</h3>
            <button
              onClick={() => setShowForm(false)}
              style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", minHeight: 44, minWidth: 44 }}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSave}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Estimate Number</label>
                <input
                  type="text"
                  required
                  value={form.estimateNumber}
                  onChange={(e) => setForm((p) => ({ ...p, estimateNumber: e.target.value }))}
                  placeholder="e.g. EST-1001"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Client Name</label>
                <input
                  type="text"
                  required
                  value={form.clientName}
                  onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
                  placeholder="e.g. Smith Residence"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Address / Details</label>
                <textarea
                  value={form.billTo}
                  onChange={(e) => setForm((p) => ({ ...p, billTo: e.target.value }))}
                  placeholder="Street, City, Postal state, Email etc."
                  rows={2}
                  style={{ ...inputStyle, fontFamily: "inherit" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Date of Issue</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Valid Until</label>
                <input
                  type="date"
                  required
                  value={form.validUntil}
                  onChange={(e) => setForm((p) => ({ ...p, validUntil: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Approved">Approved</option>
                  <option value="Declined">Declined</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Business Category</label>
                <select
                  value={form.businessCategory}
                  onChange={(e) => setForm((p) => ({ ...p, businessCategory: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="Professional Services">Professional Services</option>
                  <option value="Home Care">Home Care</option>
                  <option value="Consulting">Consulting</option>
                  <option value="Engineering">Engineering</option>
                  <option value="IT Services">IT Services</option>
                  <option value="Trades">Trades</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <h4 style={{ margin: "20px 0 8px 0" }}>📋 Itemized Work / Materials</h4>
            <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#6b7280" }}>Add a line for each job or material. Change quantity or price any time — the total updates automatically.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {form.items.map((it, index) => (
                <div key={index} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, background: "#fafafa" }}>
                  <input
                    type="text"
                    required
                    value={it.description}
                    onChange={(e) => handleItemChange(index, "description", e.target.value)}
                    placeholder="What is this for? e.g. Remove old flooring"
                    style={{ ...inputStyle, marginBottom: 8, background: "white" }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
                    <div>
                      <label style={{ fontSize: 11, color: "#6b7280" }}>Qty</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={it.qty}
                        onChange={(e) => handleItemChange(index, "qty", e.target.value)}
                        style={{ ...inputStyle, background: "white", textAlign: "right" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#6b7280" }}>Rate ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={it.rate}
                        onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                        style={{ ...inputStyle, background: "white", textAlign: "right" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#6b7280" }}>Amount</label>
                      <div style={{ fontWeight: 700, fontSize: 16, padding: "10px 0", textAlign: "right" }}>
                        ${((Number(it.qty) || 0) * (Number(it.rate) || 0)).toFixed(2)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 22, minHeight: 44, minWidth: 44, alignSelf: "end" }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              style={{ padding: "12px 18px", background: "#f3f4f6", border: "1px solid #ccc", borderRadius: 8, fontSize: 14, cursor: "pointer", minHeight: 44, width: "100%" }}
            >
              + Add Line
            </button>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <div style={{ width: "100%", maxWidth: 320, background: "#fafafa", borderRadius: 8, padding: 14, border: "1px dashed #ddd" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                  <span>Subtotal:</span>
                  <strong>${totals.subtotal}</strong>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>Discount:</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, discountType: "flat" }))}
                        style={{
                          padding: "6px 10px", fontSize: 12, borderRadius: 6, cursor: "pointer", minHeight: 32,
                          border: form.discountType === "flat" ? "2px solid #2563eb" : "1px solid #ccc",
                          background: form.discountType === "flat" ? "#eff6ff" : "white",
                          fontWeight: form.discountType === "flat" ? 700 : 500,
                        }}
                      >
                        $
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, discountType: "percent" }))}
                        style={{
                          padding: "6px 10px", fontSize: 12, borderRadius: 6, cursor: "pointer", minHeight: 32,
                          border: form.discountType === "percent" ? "2px solid #2563eb" : "1px solid #ccc",
                          background: form.discountType === "percent" ? "#eff6ff" : "white",
                          fontWeight: form.discountType === "percent" ? 700 : 500,
                        }}
                      >
                        %
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={form.discountValue}
                    onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))}
                    style={{ ...inputStyle, textAlign: "right" }}
                  />
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6b7280" }}>Enter a dollar amount OR a percent off — not both.</p>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13 }}>Tax Rate (%):</span>
                  <input
                    type="number"
                    value={form.taxRate}
                    onChange={(e) => setForm((p) => ({ ...p, taxRate: e.target.value }))}
                    style={{ width: 80, padding: 8, borderRadius: 6, border: "1px solid #ccc", textAlign: "right", minHeight: 36 }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 18, borderTop: "1px solid #eee", paddingTop: 10 }}>
                  <span>Estimated Total:</span>
                  <strong>${totals.total}</strong>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <label style={labelStyle}>Payment Terms & Conditions</label>
              <textarea
                value={form.terms}
                onChange={(e) => setForm((p) => ({ ...p, terms: e.target.value }))}
                placeholder="Enter standard payment terms for this estimate"
                rows={3}
                style={{ ...inputStyle, fontFamily: "inherit" }}
              />
            </div>

            <div style={{ marginTop: 20 }}>
              <label style={labelStyle}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Anything the client should know — scope, exclusions, etc."
                rows={3}
                style={{ ...inputStyle, fontFamily: "inherit" }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end", borderTop: "1px solid #f3f4f6", paddingTop: 16, flexWrap: "wrap" }}>
              <button
                type="submit"
                style={{ padding: "12px 24px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", minHeight: 44, flex: "1 1 auto" }}
              >
                Save Estimate
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{ padding: "12px 18px", background: "white", border: "1px solid #ccc", borderRadius: 8, color: "#374151", cursor: "pointer", minHeight: 44 }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

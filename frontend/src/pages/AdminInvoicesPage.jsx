import React, { useEffect, useState, useCallback } from "react";
import Header from "../components/Header";
import api from "../services/api";

const BLANK_INVOICE = {
  invoiceNumber: "",
  clientName: "",
  billTo: "",
  date: new Date().toISOString().slice(0, 10),
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  status: "Draft",
  items: [{ description: "", hours: 0, rate: 0 }],
  taxRate: 0,
  notes: "",
};

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_INVOICE);
  const [editingId, setEditingId] = useState(null);
  const [printData, setPrintData] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [invRes, sugRes] = await Promise.all([
        api.get("/invoices"),
        api.get("/invoices/uncalculated-billable"),
      ]);
      setInvoices(invRes.data?.invoices || []);
      setSuggestions(sugRes.data?.suggestions || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load invoicing workspace.");
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
      const numRes = await api.get("/invoices/next-number");
      setForm({
        ...BLANK_INVOICE,
        invoiceNumber: numRes.data?.nextNumber || "INV-0001",
        date: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      });
      setShowForm(true);
    } catch {
      setForm(BLANK_INVOICE);
      setShowForm(true);
    }
  };

  const loadFromSuggestion = async (sug) => {
    setError("");
    setEditingId(null);
    try {
      const numRes = await api.get("/invoices/next-number");
      setForm({
        invoiceNumber: numRes.data?.nextNumber || "INV-0001",
        clientName: sug.jobName,
        billTo: "",
        date: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: "Draft",
        items: [
          {
            description: `Hours worked on project: ${sug.jobName}`,
            hours: sug.totalHours,
            rate: sug.ratePerHour || 0,
          },
        ],
        taxRate: 0,
        notes: "Thank you for yours business!",
      });
      setShowForm(true);
    } catch {
      setError("Failed to create invoice from suggestion");
    }
  };

  const handleEdit = (inv) => {
    setEditingId(inv._id);
    setForm({
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.clientName,
      billTo: inv.billTo || "",
      date: inv.date ? inv.date.slice(0, 10) : "",
      dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : "",
      status: inv.status || "Draft",
      items: inv.items?.length ? inv.items.map(it => ({
        description: it.description,
        hours: it.hours,
        rate: it.rate,
      })) : [{ description: "", hours: 0, rate: 0 }],
      taxRate: inv.taxRate || 0,
      notes: inv.notes || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this invoice permanently?")) return;
    try {
      await api.delete(`/invoices/${id}`);
      await fetchAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete invoice");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (editingId) {
        await api.put(`/invoices/${editingId}`, form);
      } else {
        await api.post("/invoices", form);
      }
      setShowForm(false);
      await fetchAll();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to save invoice");
    }
  };

  const handleAddItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", hours: 0, rate: 0 }],
    }));
  };

  const handleRemoveItem = (index) => {
    setForm((prev) => {
      const items = prev.items.filter((_, idx) => idx !== index);
      return { ...prev, items: items.length ? items : [{ description: "", hours: 0, rate: 0 }] };
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
    const subtotal = (currentForm.items || []).reduce((sum, it) => sum + (Number(it.hours) || 0) * (Number(it.rate) || 0), 0);
    const tax = subtotal * ((Number(currentForm.taxRate) || 0) / 100);
    const total = subtotal + tax;
    return {
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
    };
  };

  const handlePrint = (inv) => {
    const totals = calculateTotals(inv);
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <html>
      <head>
        <title>Invoice - ${inv.invoiceNumber}</title>
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
          .title { font-size: 28px; font-weight: 800; text-transform: uppercase; color: #111; }
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
          .notes-container { margin-top: 50px; background: #fafafa; border: 1px dashed #ddd; padding: 16px; border-radius: 6px; }
          @page { margin: 0.5in; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">Invoice</div>
            <div style="font-size: 13px; color: #666; margin-top: 4px;">Numbered ${inv.invoiceNumber}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800; font-size: 16px;">TimeStamp Invoicing Workspace</div>
            <div style="font-size: 12px; color: #666; margin-top: 2px;">Professional Client billing System</div>
          </div>
        </div>

        <div class="meta-info">
          <div class="meta-block">
            <div class="meta-label">Bill To Client</div>
            <div class="meta-value" style="font-size:16px; margin-bottom: 4px;">${inv.clientName}</div>
            <div class="meta-value" style="font-weight: 400; font-size: 13px; white-space: pre-wrap; color: #555;">${inv.billTo || "No address supplied"}</div>
          </div>
          <div class="meta-block" style="text-align: right; max-width: 250px;">
            <div style="margin-bottom: 10px;">
              <div class="meta-label">Date Issued</div>
              <div class="meta-value" style="font-weight: 500;">${new Date(inv.date).toLocaleDateString()}</div>
            </div>
            <div>
              <div class="meta-label">Payment Due Date</div>
              <div class="meta-value" style="color: #b91c1c;">${new Date(inv.dueDate).toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="num-col" style="width: 100px;">Hours / Qty</th>
              <th class="num-col" style="width: 120px;">Hourly Rate</th>
              <th class="num-col" style="width: 120px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(inv.items || []).map((it) => `
              <tr>
                <td style="font-weight: 600;">${it.description || "Activity / Consult task"}</td>
                <td class="num-col">${it.hours}</td>
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
            ${Number(totals.tax) > 0 ? `
              <tr>
                <td style="font-weight: 700; color: #666;">Tax (${inv.taxRate}%):</td>
                <td class="num-col" style="font-weight: 600;">$${totals.tax}</td>
              </tr>
            ` : ""}
            <tr class="total-row">
              <td>Total Due:</td>
              <td class="num-col">$${totals.total}</td>
            </tr>
          </table>
        </div>

        ${inv.notes ? `
          <div class="notes-container">
            <div class="meta-label" style="margin-bottom: 6px;">Notes & Instructions</div>
            <div style="font-size: 13px; color: #444; white-space: pre-wrap;">${inv.notes}</div>
          </div>
        ` : ""}

        <div style="margin-top: 60px; text-align: center; font-size: 11px; color: #999; border-top: 1px dotted #ccc; padding-top: 14px;">
          Payable on or before receipt. Thank you for choosing us as your trusted partner!
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
    Paid: { bg: "#d1fae5", color: "#047857", border: "#a7f3d0" },
    Overdue: { bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5" },
  };

  const totals = calculateTotals(form);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <Header title="Project Invoicing" />

      {error && (
        <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "12px 18px", borderRadius: 8, marginBottom: 20 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Suggestion Dashboard */}
      {suggestions.length > 0 && !showForm && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: 20, borderRadius: 10, marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 4px 0", color: "#1e40af", display: "flex", alignItems: "center", gap: 6 }}>
            💡 Smart Billing Recommendations
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#1e3a8a" }}>
            The following clients have completed hours tracked. Click **Generate Invoice** to instantly bundle and format them for billing!
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {suggestions.map((sug) => (
              <div key={sug.jobId} style={{ background: "white", borderRadius: 8, border: "1px solid #dbeafe", padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <h4 style={{ margin: "0 0 6px 0" }}>💼 {sug.jobName}</h4>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#374151" }}>
                    <span>Hours Logged:</span>
                    <strong>{sug.totalHours} hrs</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#374151", marginTop: 4 }}>
                    <span>Rate:</span>
                    <strong>${sug.ratePerHour}/hr</strong>
                  </div>
                </div>
                <button
                  onClick={() => loadFromSuggestion(sug)}
                  style={{
                    marginTop: 12, padding: "8px 12px", background: "#2563eb", color: "white", border: "none", borderRadius: 6,
                    fontWeight: 600, fontSize: 13, cursor: "pointer", width: "100%", textAlign: "center",
                  }}
                >
                  Generate Invoice ($ {sug.suggestedAmount}) →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoice Ledger Table */}
      {!showForm && (
        <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 10, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0 }}>Client Invoices Hub</h3>
              <p style={{ margin: "2px 0 0", color: "#6b7280", fontSize: 13 }}>Create, review, print, and track balances for clients.</p>
            </div>
            <button
              onClick={handleOpenNew}
              style={{
                padding: "10px 18px", background: "#111827", color: "white", border: "none", borderRadius: 6,
                fontWeight: 600, cursor: "pointer", fontSize: 14,
              }}
            >
              + Create Blank Invoice
            </button>
          </div>

          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading invoices...</p>
          ) : invoices.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>
              <span style={{ fontSize: 32 }}>📂</span>
              <p style={{ marginTop: 8, fontWeight: 500 }}>No Invoices Yet</p>
              <p style={{ fontSize: 12, margin: "2px 0 0" }}>Start tracking time and generate a client invoice!</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: 12, textAlign: "left", fontSize: 12, textTransform: "uppercase", color: "#374151" }}>Invoice #</th>
                    <th style={{ padding: 12, textAlign: "left", fontSize: 12, textTransform: "uppercase", color: "#374151" }}>Client Name</th>
                    <th style={{ padding: 12, textAlign: "left", fontSize: 12, textTransform: "uppercase", color: "#374151" }}>Created Date</th>
                    <th style={{ padding: 12, textAlign: "left", fontSize: 12, textTransform: "uppercase", color: "#374151" }}>Due Date</th>
                    <th style={{ padding: 12, textAlign: "left", fontSize: 12, textTransform: "uppercase", color: "#374151" }}>Status</th>
                    <th style={{ padding: 12, textAlign: "right", fontSize: 12, textTransform: "uppercase", color: "#374151" }}>Amount Due</th>
                    <th style={{ padding: 12, textAlign: "right", fontSize: 12, textTransform: "uppercase", color: "#374151" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const sub = inv.items?.reduce((sum, i) => sum + (i.hours * i.rate), 0) || 0;
                    const tax = sub * ((inv.taxRate || 0) / 100);
                    const total = sub + tax;
                    const style = statusStyles[inv.status] || statusStyles.Draft;

                    return (
                      <tr key={inv._id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: 12, fontWeight: 700, color: "#111" }}>{inv.invoiceNumber}</td>
                        <td style={{ padding: 12, fontWeight: 500 }}>{inv.clientName}</td>
                        <td style={{ padding: 12, fontSize: 13, color: "#444" }}>{inv.date ? new Date(inv.date).toLocaleDateString() : "-"}</td>
                        <td style={{ padding: 12, fontSize: 13, color: "#ef4444" }}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "-"}</td>
                        <td style={{ padding: 12 }}>
                          <span style={{
                            display: "inline-block", padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                            background: style.bg, color: style.color, border: `1px solid ${style.border}`,
                          }}>
                            {inv.status}
                          </span>
                        </td>
                        <td style={{ padding: 12, textAlign: "right", fontWeight: 700 }}>${total.toFixed(2)}</td>
                        <td style={{ padding: 12, textAlign: "right" }}>
                          <button
                            onClick={() => handlePrint(inv)}
                            style={{ padding: "4px 10px", fontSize: 12, borderRadius: 4, background: "#d1fae5", border: "1px solid #10b981", color: "#047857", cursor: "pointer", fontWeight: 600, marginRight: 6 }}
                          >
                            Print / PDF
                          </button>
                          <button
                            onClick={() => handleEdit(inv)}
                            style={{ padding: "4px 10px", fontSize: 12, borderRadius: 4, background: "white", border: "1px solid #ddd", color: "#111827", cursor: "pointer", fontWeight: 500, marginRight: 6 }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(inv._id)}
                            style={{ padding: "4px 10px", fontSize: 12, borderRadius: 4, background: "#fee2e2", border: "1px solid #f87171", color: "#b91c1c", cursor: "pointer", fontWeight: 500 }}
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

      {/* Invoice Form (Create / Edit Modal) */}
      {showForm && (
        <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 10, padding: 28, marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", paddingBottom: 14, marginBottom: 20 }}>
            <h3 style={{ margin: 0 }}>{editingId ? "✏️ Edit Client Invoice" : "➕ Create Client Invoice"}</h3>
            <button
              onClick={() => setShowForm(false)}
              style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer" }}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSave}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Invoice Number</label>
                <input
                  type="text"
                  required
                  value={form.invoiceNumber}
                  onChange={(e) => setForm((p) => ({ ...p, invoiceNumber: e.target.value }))}
                  placeholder="e.g. INV-1001"
                  style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ddd" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Client / Project Name</label>
                <input
                  type="text"
                  required
                  value={form.clientName}
                  onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
                  placeholder="e.g. Sunrise Care Home"
                  style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ddd" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Billing Address / Details</label>
                <textarea
                  value={form.billTo}
                  onChange={(e) => setForm((p) => ({ ...p, billTo: e.target.value }))}
                  placeholder="Street, City, Postal state, Email etc."
                  rows={2}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", fontFamily: "inherit", fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Date of Issue</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                  style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ddd" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Payment Due Date</label>
                <input
                  type="date"
                  required
                  value={form.dueDate}
                  onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                  style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ddd" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Payment Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ddd" }}
                >
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Paid">Paid</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>
            </div>

            <h4 style={{ margin: "20px 0 8px 0" }}>📄 Itemized Services / Hours Worked</h4>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
              <thead>
                <tr style={{ background: "#f8f9fa" }}>
                  <th style={{ padding: 10, textAlign: "left", fontSize: 12, color: "#444" }}>Description</th>
                  <th style={{ padding: 10, textAlign: "right", fontSize: 12, color: "#444", width: 110 }}>Hours / Qty</th>
                  <th style={{ padding: 10, textAlign: "right", fontSize: 12, color: "#444", width: 130 }}>Hourly Rate</th>
                  <th style={{ padding: 10, textAlign: "right", fontSize: 12, color: "#444", width: 140 }}>Subtotal</th>
                  <th style={{ padding: 10, textAlign: "center", fontSize: 12, color: "#444", width: 80 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, index) => (
                  <tr key={index} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: 8 }}>
                      <input
                        type="text"
                        required
                        value={it.description}
                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                        placeholder="e.g. Consult work completed"
                        style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
                      />
                    </td>
                    <td style={{ padding: 8 }}>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={it.hours}
                        onChange={(e) => handleItemChange(index, "hours", e.target.value)}
                        style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd", textAlign: "right" }}
                      />
                    </td>
                    <td style={{ padding: 8 }}>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={it.rate}
                        onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                        style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd", textAlign: "right" }}
                      />
                    </td>
                    <td style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>
                      ${((Number(it.hours) || 0) * (Number(it.rate) || 0)).toFixed(2)}
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18 }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              type="button"
              onClick={handleAddItem}
              style={{ padding: "6px 12px", background: "#f3f4f6", border: "1px solid #ccc", borderRadius: 6, fontSize: 13, cursor: "pointer" }}
            >
              + Add Itemized Line
            </button>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <div style={{ width: 280, background: "#fafafa", borderRadius: 8, padding: 14, border: "1px dashed #ddd" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginHeight: 6, fontSize: 13 }}>
                  <span>Subtotal:</span>
                  <strong>${totals.subtotal}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginHeight: 6, marginTop: 6 }}>
                  <span style={{ fontSize: 13 }}>Tax Rate (%):</span>
                  <input
                    type="number"
                    value={form.taxRate}
                    onChange={(e) => setForm((p) => ({ ...p, taxRate: e.target.value }))}
                    style={{ width: 64, padding: 4, borderRadius: 4, border: "1px solid #ccc", textAlign: "right" }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginHeight: 6, marginTop: 10, fontSize: 16, borderTop: "1px solid #eee", paddingTop: 10 }}>
                  <span>Net Total:</span>
                  <strong>${totals.total}</strong>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Bank / Payment Instructions</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Include bank account routing details, check address, or Venmo details"
                rows={3}
                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ddd", fontFamily: "inherit" }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end", borderTop: "1px solid #f3f4f6", paddingTop: 16 }}>
              <button
                type="submit"
                style={{ padding: "10px 24px", background: "#2563eb", color: "white", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}
              >
                Save Client Invoice
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{ padding: "10px 18px", background: "white", border: "1px solid #ccc", borderRadius: 6, color: "#374151", cursor: "pointer" }}
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

import React, { useCallback, useEffect, useState } from "react";
import { listStaff } from "../services/staff";
import {
  createTraining,
  deleteTraining,
  listTraining,
  updateTraining,
} from "../services/training";

const STATUS_STYLE = {
  valid:         { background: "#d1fae5", color: "#065f46", borderRadius: 4, padding: "2px 8px", fontSize: 12 },
  expiring_soon: { background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "2px 8px", fontSize: 12 },
  expired:       { background: "#fee2e2", color: "#991b1b", borderRadius: 4, padding: "2px 8px", fontSize: 12 },
};

const STATUS_LABEL = { valid: "Valid", expiring_soon: "Expiring Soon", expired: "Expired" };

const BLANK = {
  staffId: "", title: "", issuingOrganization: "",
  dateReceived: "", expirationDate: "", renewalReminderDays: 30, notes: "",
};

export default function TrainingTrackerPanel() {
  const [records, setRecords]     = useState([]);
  const [staff, setStaff]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm]           = useState(BLANK);
  const [showForm, setShowForm]   = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [recs, staffList] = await Promise.all([listTraining(), listStaff()]);
      setRecords(recs);
      setStaff(staffList);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load training records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setForm(BLANK);
    setShowForm(false);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        renewalReminderDays: Number(form.renewalReminderDays),
        expirationDate: form.expirationDate || null,
        issuingOrganization: form.issuingOrganization || null,
        notes: form.notes || null,
      };
      if (editingId) {
        await updateTraining(editingId, payload);
      } else {
        await createTraining(payload);
      }
      resetForm();
      await fetchAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save record.");
    } finally {
      setSaving(false);
    }
  }, [editingId, fetchAll, form, resetForm]);

  const startEdit = useCallback((record) => {
    setEditingId(record._id);
    setForm({
      staffId:               record.staffId?._id || record.staffId || "",
      title:                 record.title || "",
      issuingOrganization:   record.issuingOrganization || "",
      dateReceived:          record.dateReceived ? record.dateReceived.slice(0, 10) : "",
      expirationDate:        record.expirationDate ? record.expirationDate.slice(0, 10) : "",
      renewalReminderDays:   record.renewalReminderDays ?? 30,
      notes:                 record.notes || "",
    });
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm("Delete this training record?")) return;
    setSaving(true);
    setError("");
    try {
      await deleteTraining(id);
      await fetchAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete record.");
    } finally {
      setSaving(false);
    }
  }, [fetchAll]);

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm((p) => ({ ...p, [key]: e.target.value })),
    style: { padding: 8, borderRadius: 6, border: "1px solid #ddd", width: "100%" },
  });

  return (
    <div style={{ background: "#fff", padding: 20, borderRadius: 8, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>📋 Training &amp; Certifications</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { setShowForm((s) => !s); setEditingId(null); setForm(BLANK); }}
            style={{ padding: "8px 12px", background: "#111827", color: "#fff", border: "none", borderRadius: 6 }}
          >
            {showForm && !editingId ? "Cancel" : "+ Add Record"}
          </button>
          <button
            onClick={fetchAll}
            disabled={loading || saving}
            style={{ padding: "8px 12px", background: "#007bff", color: "#fff", border: "none", borderRadius: 6 }}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, background: "#f8d7da", color: "#721c24", borderRadius: 6 }}>
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {!editingId && (
              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Staff Member *</label>
                <select {...field("staffId")} required>
                  <option value="">Select staff…</option>
                  {staff.map((s) => (
                    <option key={s._id} value={s._id}>{s.firstName} {s.lastName}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Training / Cert Title *</label>
              <input {...field("title")} placeholder="e.g. CPR/AED" required />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Issuing Organization</label>
              <input {...field("issuingOrganization")} placeholder="e.g. Red Cross" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Date Received *</label>
              <input type="date" {...field("dateReceived")} required />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Expiration Date</label>
              <input type="date" {...field("expirationDate")} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Remind (days before expiry)</label>
              <input type="number" min="1" {...field("renewalReminderDays")} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Notes</label>
              <input {...field("notes")} placeholder="Optional notes" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: "10px 20px", background: "#111827", color: "#fff", border: "none", borderRadius: 6 }}
            >
              {saving ? "Saving…" : editingId ? "Update" : "Add Record"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              style={{ padding: "10px 20px", background: "#f3f4f6", border: "1px solid #ddd", borderRadius: 6 }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ marginTop: 16, color: "#6b7280" }}>Loading…</p>
      ) : records.length === 0 ? (
        <p style={{ marginTop: 16, color: "#6b7280" }}>No training records found.</p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                {["Staff", "Title", "Issuer", "Received", "Expires", "Status", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r._id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px" }}>{r.staffId?.firstName} {r.staffId?.lastName}</td>
                  <td style={{ padding: "10px 12px" }}>{r.title}</td>
                  <td style={{ padding: "10px 12px", color: "#6b7280" }}>{r.issuingOrganization || "—"}</td>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                    {r.dateReceived ? new Date(r.dateReceived).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                    {r.expirationDate ? new Date(r.expirationDate).toLocaleDateString() : "No expiry"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={STATUS_STYLE[r.status] || STATUS_STYLE.valid}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => startEdit(r)}
                        style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", cursor: "pointer" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(r._id)}
                        disabled={saving}
                        style={{ padding: "4px 10px", fontSize: 12, border: "none", borderRadius: 4, background: "#fee2e2", color: "#991b1b", cursor: "pointer" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

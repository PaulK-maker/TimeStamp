import React, { useState } from "react";
import api from "../services/api";
import { resetMeCache } from "../services/me";

// Lets the facility owner edit the company name/tagline shown on estimate & invoice headers.
export default function CompanyProfileCard({ tenantName, businessTagline, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tenantName || "");
  const [tagline, setTagline] = useState(businessTagline || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const startEditing = () => {
    setName(tenantName || "");
    setTagline(businessTagline || "");
    setError("");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await api.put("/tenant/profile", { name, businessTagline: tagline });
      resetMeCache();
      setEditing(false);
      onSaved?.(res.data?.tenant);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save company profile");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px", marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#111" }}>{tenantName || "Your Company"}</div>
          {businessTagline ? <div style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>{businessTagline}</div> : null}
        </div>
        <button
          onClick={startEditing}
          style={{ padding: "10px 16px", fontSize: 13, borderRadius: 8, background: "white", border: "1px solid #ccc", color: "#111827", cursor: "pointer", fontWeight: 600, minHeight: 40 }}
        >
          ✏️ Edit Company Name
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 20 }}>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Company Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bustani APD"
            style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #ddd", fontSize: 15, minHeight: 44 }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Tagline (shown under name)</label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="e.g. Professional Services"
            style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #ddd", fontSize: 15, minHeight: 44 }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: "10px 18px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", minHeight: 40 }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          style={{ padding: "10px 18px", background: "white", border: "1px solid #ccc", borderRadius: 8, color: "#374151", cursor: "pointer", minHeight: 40 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

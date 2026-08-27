import React, { useCallback, useEffect, useState } from "react";
import api from "../services/api";

const STATUS = {
  overtime:   { label: "Overtime",       bg: "#fee2e2", color: "#991b1b" },
  approaching: { label: "Approaching OT", bg: "#fef3c7", color: "#92400e" },
};

export default function OvertimeAlertsPanel() {
  const [alerts, setAlerts]   = useState([]);
  const [weekStart, setWeekStart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/overtime-alerts");
      setAlerts(res.data?.alerts || []);
      setWeekStart(res.data?.weekStart || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load overtime alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  if (!loading && alerts.length === 0 && !error) return null;

  return (
    <div style={{ background: "#fff", padding: 20, borderRadius: 8, marginBottom: 20, border: "1px solid #fbbf24" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>
          ⚠️ Overtime Alerts
          {weekStart && (
            <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280", marginLeft: 8 }}>
              week of {new Date(weekStart).toLocaleDateString()}
            </span>
          )}
        </h2>
        <button
          onClick={fetchAlerts}
          disabled={loading}
          style={{ padding: "6px 10px", fontSize: 12, background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: 10, background: "#f8d7da", color: "#721c24", borderRadius: 6, fontSize: 14 }}>{error}</div>
      )}

      {loading ? (
        <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>Loading…</p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {alerts.map((a) => {
            const s = STATUS[a.status] || STATUS.approaching;
            return (
              <div key={String(a.staff._id)} style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${s.bg}`, background: s.bg, minWidth: 180 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {a.staff.firstName} {a.staff.lastName}
                </div>
                <div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>
                  {a.hoursThisWeek.toFixed(1)} hrs this week
                  {a.clockedIn && <span style={{ marginLeft: 6, fontSize: 11, color: "#2563eb" }}>● clocked in</span>}
                </div>
                <span style={{ display: "inline-block", marginTop: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600, borderRadius: 4, background: "#fff", color: s.color }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

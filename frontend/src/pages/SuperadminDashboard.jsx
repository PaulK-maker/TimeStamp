import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function SuperadminDashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [facilities, setFacilities] = useState([]);

  const [keyInput, setKeyInput] = useState(() => localStorage.getItem("superadminAccessKey") || "");
  const hasKey = Boolean((keyInput || "").trim());
  const [keyStatus, setKeyStatus] = useState("");

  async function load() {
    if (!hasKey) {
      setLoading(false);
      setFacilities([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.get("/superadmin/facilities");
      setFacilities(res.data?.facilities || []);
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;

      if (status === 401 && code === "SUPERADMIN_KEY_REQUIRED") {
        setError({
          message: "Superadmin key required (or invalid).",
        });
      } else {
        setError(err);
      }
      setFacilities([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Only load once a key exists.
    if (hasKey) {
      load();
    } else {
      setFacilities([]);
      setError(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasKey]);

  const stats = useMemo(() => {
    const total = facilities.length;
    const selected = facilities.filter((f) => Boolean(f?.planSelected)).length;
    const active = facilities.filter((f) => f?.subscriptionStatus === "active").length;
    return { total, selected, active };
  }, [facilities]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 6 }}>Superadmin</h1>
      <div style={{ color: "#555", marginBottom: 16 }}>
        Facilities: <strong>{stats.total}</strong> · Plan selected: <strong>{stats.selected}</strong> · Active subs: <strong>{stats.active}</strong>
      </div>

      <div style={{ marginBottom: 16, border: "1px solid #e5e5e5", borderRadius: 10, background: "#fff", padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Superadmin access key</div>
        <div style={{ color: "#555", marginBottom: 10 }}>
          Enter the key to unlock superadmin data. You only need to do this once per browser.
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => {
              setKeyInput(e.target.value);
              setKeyStatus("");
            }}
            placeholder="Enter superadmin key"
            style={{ flex: "1 1 320px", padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          />
          <button
            type="button"
            onClick={() => {
              const next = (keyInput || "").trim();
              if (!next) {
                localStorage.removeItem("superadminAccessKey");
                setKeyStatus("Key cleared.");
                setFacilities([]);
                return;
              }
              localStorage.setItem("superadminAccessKey", next);
              setKeyStatus("Key saved.");
              setError(null);
              load();
            }}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}
          >
            Save key
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("superadminAccessKey");
              setKeyInput("");
              setKeyStatus("Key cleared.");
              setFacilities([]);
              setError(null);
              setLoading(false);
            }}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #111", background: "#fff", color: "#111", cursor: "pointer" }}
          >
            Clear
          </button>
        </div>

        {keyStatus ? <div style={{ marginTop: 10, color: "#146c43" }}>{keyStatus}</div> : null}
        {!hasKey ? (
          <div style={{ marginTop: 10, color: "#b00020" }}>Key required to load facilities.</div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button
          type="button"
          onClick={load}
          disabled={!hasKey}
          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      {loading && <div>Loading facilities…</div>}

      {error && (
        <div style={{ padding: 12, border: "1px solid #f2b8b5", background: "#fff4f4", borderRadius: 8, color: "#7a0b0b" }}>
          {error?.response?.data?.message || error?.message || "Failed to load facilities"}
        </div>
      )}

      {!loading && !error && facilities.length === 0 && (
        <div style={{ padding: 12, border: "1px solid #e5e5e5", background: "#fff", borderRadius: 8 }}>
          No facilities found.
        </div>
      )}

      {!loading && !error && facilities.length > 0 && (
        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#fafafa" }}>
                <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Facility</th>
                <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Tenant code</th>
                <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Plan</th>
                <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Plan selected</th>
                <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Subscription</th>
                <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Period end</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((f) => (
                <tr key={f?.tenantCode || f?.name}>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{f?.name || "—"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2", fontFamily: "monospace" }}>{f?.tenantCode || "—"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{f?.plan?.name || f?.planId || "—"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{f?.planSelected ? "Yes" : "No"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{f?.subscriptionStatus || "—"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>{formatDate(f?.currentPeriodEnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 14, color: "#666", fontSize: 13 }}>
        Stripe fields are present for wiring later (customer/subscription/price IDs) but may be null today.
      </div>
    </div>
  );
}

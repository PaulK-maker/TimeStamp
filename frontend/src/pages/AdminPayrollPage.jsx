import React, { useEffect, useState } from "react";
import Header from "../components/Header";
import StaffPayrollProfilePanel from "../components/StaffPayrollProfilePanel";
import {
  createPayrollRun,
  listPayrollRuns,
  listPayrollWebhookEvents,
  submitPayrollRun,
} from "../services/payroll";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatCurrency(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function statusColor(status) {
  const normalized = (status || "").toLowerCase();
  if (["completed"].includes(normalized)) return "#1b5e20";
  if (["submitted", "processing"].includes(normalized)) return "#0d47a1";
  if (["failed", "cancelled"].includes(normalized)) return "#b71c1c";
  return "#555";
}

export default function AdminPayrollPage() {
  const [payPeriodStart, setPayPeriodStart] = useState("");
  const [payPeriodEnd, setPayPeriodEnd] = useState("");
  const [runs, setRuns] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [nextRuns, nextEvents] = await Promise.all([
        listPayrollRuns(),
        listPayrollWebhookEvents(),
      ]);
      setRuns(nextRuns);
      setEvents(nextEvents.slice(0, 10));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load payroll data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateRun(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatusMessage("");
    try {
      const result = await createPayrollRun({ payPeriodStart, payPeriodEnd });
      setStatusMessage(result?.message || "Draft payroll run created");
      setPayPeriodStart("");
      setPayPeriodEnd("");
      await loadData();
    } catch (err) {
      const response = err?.response?.data;
      if (Array.isArray(response?.invalidStaff) && response.invalidStaff.length) {
        const details = response.invalidStaff
          .map((staffMember) => `${staffMember.firstName || "Staff"} ${staffMember.lastName || ""}: ${staffMember.issues.join(", ")}`.trim())
          .join(" | ");
        setError(`${response.message}: ${details}`);
      } else {
        setError(response?.message || err?.message || "Failed to create payroll run");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitRun(runId) {
    if (!runId) return;
    setSaving(true);
    setError("");
    setStatusMessage("");
    try {
      const result = await submitPayrollRun(runId);
      setStatusMessage(result?.message || "Payroll run submitted");
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to submit payroll run");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      <Header title="Admin Payroll" />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 20 }}>
          <section style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, padding: 16, alignSelf: "start" }}>
            <h2 style={{ marginTop: 0 }}>Create Draft Payroll Run</h2>
            <p style={{ color: "#555", marginTop: 0 }}>
              Draft runs stay local until submitted to the provider.
            </p>
            <form onSubmit={handleCreateRun}>
              <label style={{ display: "block", marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Pay period start</div>
                <input
                  type="date"
                  value={payPeriodStart}
                  onChange={(event) => setPayPeriodStart(event.target.value)}
                  required
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Pay period end</div>
                <input
                  type="date"
                  value={payPeriodEnd}
                  onChange={(event) => setPayPeriodEnd(event.target.value)}
                  required
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: "10px 14px", borderRadius: 6, border: "none", background: "#111", color: "#fff", cursor: "pointer" }}
              >
                {saving ? "Working..." : "Create Draft"}
              </button>
            </form>

            {statusMessage ? (
              <div style={{ marginTop: 16, color: "#1b5e20", background: "#edf7ed", borderRadius: 6, padding: 10 }}>
                {statusMessage}
              </div>
            ) : null}

            {error ? (
              <div style={{ marginTop: 16, color: "#b71c1c", background: "#fdecea", borderRadius: 6, padding: 10 }}>
                {error}
              </div>
            ) : null}
          </section>

          <section style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Payroll Runs</h2>
              <button
                type="button"
                onClick={loadData}
                disabled={loading || saving}
                style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
              >
                Refresh
              </button>
            </div>

            {loading ? <p>Loading payroll runs...</p> : null}

            {!loading && !runs.length ? <p>No payroll runs yet.</p> : null}

            {!loading && runs.length ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #ddd" }}>Pay Period</th>
                      <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #ddd" }}>Status</th>
                      <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #ddd" }}>Workers</th>
                      <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #ddd" }}>Gross Preview</th>
                      <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #ddd" }}>Submitted</th>
                      <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #ddd" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run._id}>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>
                          {formatDate(run.payPeriodStart)}<br />
                          <span style={{ color: "#666" }}>to {formatDate(run.payPeriodEnd)}</span>
                        </td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #eee", color: statusColor(run.status), fontWeight: 700 }}>
                          {(run.status || "draft").toUpperCase()}
                        </td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>
                          {run.totalsSummary?.workerCount ?? 0}
                        </td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>
                          {formatCurrency(run.totalsSummary?.grossPayPreview ?? null)}
                        </td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>
                          {formatDate(run.submittedAt)}
                        </td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>
                          {run.status === "draft" ? (
                            <button
                              type="button"
                              onClick={() => handleSubmitRun(run._id)}
                              disabled={saving}
                              style={{ padding: "8px 12px", borderRadius: 6, border: "none", background: "#007bff", color: "#fff", cursor: "pointer" }}
                            >
                              Submit
                            </button>
                          ) : (
                            <span style={{ color: "#666" }}>{run.providerPayrollId || "Provider-linked"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>

        <StaffPayrollProfilePanel />

        <section style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, padding: 16, marginTop: 20 }}>
          <h2 style={{ marginTop: 0 }}>Recent Payroll Webhook Events</h2>
          {!events.length ? <p>No payroll webhook events recorded yet.</p> : null}
          {events.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #ddd" }}>Received</th>
                    <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #ddd" }}>Type</th>
                    <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #ddd" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #ddd" }}>Provider Event ID</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((eventItem) => (
                    <tr key={eventItem._id}>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>{formatDate(eventItem.receivedAt)}</td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>{eventItem.eventType}</td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>{eventItem.status}</td>
                      <td style={{ padding: "10px 8px", borderBottom: "1px solid #eee", fontFamily: "monospace" }}>{eventItem.providerEventId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
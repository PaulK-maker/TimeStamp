import React, { useEffect, useState } from "react";
import Header from "../components/Header";
import StaffPayrollProfilePanel from "../components/StaffPayrollProfilePanel";
import {
  createPayrollRun,
  listPayrollRuns,
  listPayrollWebhookEvents,
  submitPayrollRun,
} from "../services/payroll";

function formatDateOnly(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

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

const PAYROLL_LIVE = process.env.REACT_APP_PAYROLL_LIVE === "true";
const GUSTO_REFERRAL_URL = process.env.REACT_APP_GUSTO_REFERRAL_URL || "https://gusto.com/partners";

function PayrollComingSoon() {
  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <Header title="Payroll" />
      <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, padding: 24, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>🚧 Payroll — Coming Soon</h2>
        <p style={{ color: "#555" }}>
          In-app payroll (submit hours directly to a provider and pay staff from TimeStamp) is built
          and fully tested in sandbox, but isn't connected to a live payroll provider yet. We're
          working on making this available — check back soon.
        </p>

        <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #eee" }}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>What you can do today</h3>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600 }}>Set up payroll with Gusto directly</div>
            <div style={{ color: "#555", fontSize: 14, marginTop: 4 }}>
              Not embedded in TimeStamp yet, but you can create a Gusto account and run payroll
              yourself today.
            </div>
            <a
              href={GUSTO_REFERRAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                marginTop: 10,
                padding: "10px 16px",
                borderRadius: 8,
                background: "#111",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Set up payroll with Gusto →
            </a>
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 600 }}>Email your hours to any payroll provider</div>
            <div style={{ color: "#555", fontSize: 14, marginTop: 4 }}>
              Use an already-built report on the Print Report page to send an hours summary (CSV)
              to whichever payroll provider or bookkeeper you use today.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminPayrollPageLive() {
  const [payPeriodStart, setPayPeriodStart] = useState("");
  const [payPeriodEnd, setPayPeriodEnd] = useState("");
  const [runs, setRuns] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [blockingItems, setBlockingItems] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [confirmRun, setConfirmRun] = useState(null);

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
    setBlockingItems([]);
    setStatusMessage("");
    try {
      const result = await submitPayrollRun(runId);
      setStatusMessage(result?.message || "Payroll run submitted");
      await loadData();
    } catch (err) {
      const response = err?.response?.data;
      if (Array.isArray(response?.blockingItems) && response.blockingItems.length) {
        setBlockingItems(response.blockingItems);
        setError(response.message || "Resolve payroll item issues before submission");
      } else {
        setError(response?.message || err?.message || "Failed to submit payroll run");
      }
    } finally {
      setSaving(false);
      setConfirmRun(null);
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
                          {formatDateOnly(run.payPeriodStart)} — {formatDateOnly(run.payPeriodEnd)}
                        </td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid #eee" }}>
                          <span style={{ color: statusColor(run.status), fontWeight: 700 }}>
                            {(run.status || "draft").toUpperCase()}
                          </span>
                          {run.lastError ? (
                            <div style={{ color: "#b71c1c", fontSize: 12, marginTop: 4 }}>{run.lastError}</div>
                          ) : null}
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
                              onClick={() => setConfirmRun(run)}
                              disabled={saving}
                              style={{ padding: "8px 12px", borderRadius: 6, border: "none", background: "#007bff", color: "#fff", cursor: "pointer" }}
                            >
                              Review & Submit
                            </button>
                          ) : (
                            <span style={{ color: "#666", fontSize: 12, fontFamily: "monospace" }}>{run.providerPayrollId || "—"}</span>
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

        {/* Blocking items — shown when submit is blocked by missing providerEmployeeId */}
        {blockingItems.length > 0 ? (
          <section style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 8, padding: 16, marginTop: 20 }}>
            <h3 style={{ marginTop: 0, color: "#f57f17" }}>Submission blocked — resolve these staff issues first</h3>
            <p style={{ color: "#555", marginTop: 0 }}>
              Each staff member below is missing a <strong>Gusto Employee ID</strong> (payrollProviderEmployeeId). Set it in the Staff Payroll Profiles section below.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ffe082" }}>Name</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ffe082" }}>Email</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ffe082" }}>Issue</th>
                </tr>
              </thead>
              <tbody>
                {blockingItems.map((item) => (
                  <tr key={item.staffId || item.payrollRunItemId}>
                    <td style={{ padding: "8px", borderBottom: "1px solid #fff3cd" }}>{item.firstName} {item.lastName}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid #fff3cd" }}>{item.email}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid #fff3cd", color: "#b71c1c" }}>{item.issue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {/* Submit confirmation modal */}
        {confirmRun ? (
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setConfirmRun(null); }}
            style={{
              position: "fixed", inset: 0, zIndex: 1000,
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 16,
            }}
          >
            <div style={{ background: "#fff", borderRadius: 12, padding: 28, maxWidth: 480, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
              <h3 style={{ marginTop: 0 }}>Submit payroll to Gusto?</h3>
              <p style={{ color: "#555" }}>
                <strong>Pay period:</strong> {formatDateOnly(confirmRun.payPeriodStart)} — {formatDateOnly(confirmRun.payPeriodEnd)}<br />
                <strong>Workers:</strong> {confirmRun.totalsSummary?.workerCount ?? 0}<br />
                <strong>Gross preview:</strong> {formatCurrency(confirmRun.totalsSummary?.grossPayPreview ?? null)}
              </p>
              <p style={{ color: "#b71c1c", fontWeight: 600 }}>
                This action is irreversible. Once submitted to Gusto, payroll processing begins and cannot be undone from this app.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setConfirmRun(null)}
                  style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmitRun(confirmRun._id)}
                  disabled={saving}
                  style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#b71c1c", color: "#fff", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}
                >
                  {saving ? "Submitting…" : "Yes, submit to Gusto"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

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

export default function AdminPayrollPage() {
  return PAYROLL_LIVE ? <AdminPayrollPageLive /> : <PayrollComingSoon />;
}
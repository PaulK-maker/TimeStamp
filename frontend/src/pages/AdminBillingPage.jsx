import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function formatUsd(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "$0";
  return `$${n}`;
}

function formatTenantCode(code) {
  const normalized = (code || "")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
  if (!normalized) return "";
  if (normalized.length <= 4) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export default function AdminBillingPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tenant, setTenant] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [savingPlanId, setSavingPlanId] = useState(null);
  const [tenantRequired, setTenantRequired] = useState(false);
  const [tenantRequiredMessage, setTenantRequiredMessage] = useState("");

  const [facilityName, setFacilityName] = useState("");
  const [bootstrapBusy, setBootstrapBusy] = useState(false);
  const [bootstrapStep, setBootstrapStep] = useState("idle");
  const [bootstrapOtp, setBootstrapOtp] = useState("");
  const [bootstrapCopyCode, setBootstrapCopyCode] = useState("");
  const [bootstrapExpiresAt, setBootstrapExpiresAt] = useState(null);
  const [bootstrapStatus, setBootstrapStatus] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteCopyCode, setInviteCopyCode] = useState("");
  const [inviteExpiresAt, setInviteExpiresAt] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setTenantRequired(false);
      setTenantRequiredMessage("");
      setInviteStatus("");
      setInviteCopyCode("");
      setInviteExpiresAt(null);

      try {
        const plansRes = await api.get("/billing/plans");
        if (cancelled) return;
        setPlans(Array.isArray(plansRes.data?.plans) ? plansRes.data.plans : []);

        try {
          const meRes = await api.get("/billing/me");
          if (cancelled) return;
          setTenant(meRes.data?.tenant || null);
          setCurrentPlan(meRes.data?.plan || null);
        } catch (meErr) {
          if (cancelled) return;
          const code = meErr?.response?.data?.code;
          const message = meErr?.response?.data?.message || meErr?.message;
          if (code === "TENANT_REQUIRED") {
            setTenantRequired(true);
            setTenantRequiredMessage(
              message ||
                "Tenant is not assigned for this account. Run the tenant backfill script once."
            );
            setTenant(null);
            setCurrentPlan(null);
          } else {
            setError(message || "Failed to load billing");
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(err?.response?.data?.message || err?.message || "Failed to load billing");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshBilling() {
    const meRes = await api.get("/billing/me");
    setTenant(meRes.data?.tenant || null);
    setCurrentPlan(meRes.data?.plan || null);
    setTenantRequired(false);
    setTenantRequiredMessage("");
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function handleRequestBootstrapOtp() {
    setError("");
    setInviteStatus("");
    setBootstrapCopyCode("");
    setBootstrapStatus("");
    setBootstrapBusy(true);
    try {
      const res = await api.post("/tenant/otp/send-bootstrap", {});
      setBootstrapStep("awaiting_code");
      setBootstrapOtp("");
      setBootstrapCopyCode(res.data?.setupCode || "");
      setBootstrapExpiresAt(res.data?.expiresAt || null);

      if (res.data?.code === "MAIL_NOT_CONFIGURED" && res.data?.setupCode) {
        // Copy-code fallback is shown in UI.
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to request setup code");
    } finally {
      setBootstrapBusy(false);
    }
  }

  async function handleVerifyBootstrapOtp() {
    setError("");
    setInviteStatus("");
    setBootstrapStatus("");
    setBootstrapBusy(true);
    try {
      await api.post("/tenant/otp/verify-bootstrap", {
        code: bootstrapOtp,
        name: facilityName,
      });
      setBootstrapStep("idle");
      setBootstrapOtp("");
      setBootstrapCopyCode("");
      setBootstrapExpiresAt(null);
      await refreshBilling();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to verify setup code");
    } finally {
      setBootstrapBusy(false);
    }
  }

  async function handleSendInviteOtp() {
    setError("");
    setInviteStatus("");
    setInviteCopyCode("");
    setInviteBusy(true);
    try {
      const res = await api.post("/tenant/otp/send-join", { toEmail: inviteEmail });
      setInviteExpiresAt(res.data?.expiresAt || null);

      if (res.data?.code === "MAIL_NOT_CONFIGURED" && res.data?.inviteCode) {
        setInviteCopyCode(res.data.inviteCode);
        setInviteStatus("Email isn’t configured. Copy the invite code below and give it to the user.");
      } else {
        setInviteStatus(res.data?.message || "Invite code sent");
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to send invite code");
    } finally {
      setInviteBusy(false);
    }
  }


  const planCards = useMemo(() => {
    return (plans || []).map((p) => {
      const isSelected = Boolean(tenant?.planSelected && tenant?.planId === p.id);
      return { ...p, isSelected };
    });
  }, [plans, tenant]);

  async function handleSelectPlan(planId) {
    if (tenantRequired) {
      setError("Tenant setup is required before selecting a plan.");
      return;
    }

    setSavingPlanId(planId);
    setError("");
    try {
      const res = await api.post("/billing/select-plan", { planId });
      setTenant(res.data?.tenant || null);
      setCurrentPlan(res.data?.plan || null);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to select plan");
    } finally {
      setSavingPlanId(null);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
        <h2>Choose your plan</h2>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <h2>Choose your plan</h2>
      <p style={{ marginTop: 4, color: "#555" }}>
        Your plan is per facility (tenant). You must select a plan before using admin features.
      </p>

      {error ? (
        <div style={{ background: "#fff3f3", border: "1px solid #ffd7d7", padding: 12, borderRadius: 8, marginTop: 16 }}>
          <strong style={{ color: "#b00020" }}>Error:</strong> {error}
        </div>
      ) : null}

      {tenantRequired ? (
        <div style={{ background: "#fff3f3", border: "1px solid #ffd7d7", padding: 12, borderRadius: 8, marginTop: 16 }}>
          <div style={{ fontWeight: 700, color: "#b00020" }}>Setup required</div>
          <div style={{ marginTop: 6, color: "#b00020" }}>{tenantRequiredMessage}</div>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Create your facility (recommended)</div>
              <div style={{ color: "#555", marginBottom: 10 }}>
                This is the easiest path for non-technical setup. It will create a facility and bind your admin account.
              </div>
              <label style={{ display: "block", fontSize: 13, color: "#444" }}>Facility name (optional)</label>
              <input
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                placeholder="My Facility"
                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ddd", marginTop: 6 }}
              />
              {bootstrapStep === "idle" ? (
                <button
                  onClick={handleRequestBootstrapOtp}
                  disabled={bootstrapBusy}
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  {bootstrapBusy ? "Sending…" : "Email me a one-time setup code"}
                </button>
              ) : null}

              {bootstrapStep === "awaiting_code" ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "#555", marginBottom: 10 }}>
                    Enter the 6-digit code sent to your email.
                    {bootstrapExpiresAt ? (
                      <span style={{ marginLeft: 6 }}>
                        Expires: {new Date(bootstrapExpiresAt).toLocaleString()}
                      </span>
                    ) : null}
                  </div>

                  <label style={{ display: "block", fontSize: 13, color: "#444" }}>One-time code</label>
                  <input
                    value={bootstrapOtp}
                    onChange={(e) => setBootstrapOtp(e.target.value)}
                    placeholder="123456"
                    inputMode="numeric"
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 6,
                      border: "1px solid #ddd",
                      marginTop: 6,
                      fontFamily: "monospace",
                      letterSpacing: 2,
                    }}
                  />

                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={handleVerifyBootstrapOtp}
                      disabled={bootstrapBusy || !bootstrapOtp.trim()}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid #111",
                        background: "#111",
                        color: "#fff",
                        cursor: "pointer",
                        flex: "1 1 200px",
                      }}
                    >
                      {bootstrapBusy ? "Verifying…" : "Verify & create facility"}
                    </button>
                    <button
                      onClick={handleRequestBootstrapOtp}
                      disabled={bootstrapBusy}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid #111",
                        background: "#fff",
                        color: "#111",
                        cursor: "pointer",
                        flex: "1 1 140px",
                      }}
                    >
                      {bootstrapBusy ? "Sending…" : "Resend"}
                    </button>
                    <button
                      onClick={() => {
                        setBootstrapStep("idle");
                        setBootstrapOtp("");
                        setBootstrapCopyCode("");
                        setBootstrapExpiresAt(null);
                      }}
                      disabled={bootstrapBusy}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: "#f7f7f7",
                        color: "#111",
                        cursor: "pointer",
                        flex: "1 1 120px",
                      }}
                    >
                      Cancel
                    </button>
                  </div>

                  {bootstrapCopyCode ? (
                    <div style={{ marginTop: 12, background: "#fff8e6", border: "1px solid #ffe7b8", padding: 10, borderRadius: 8 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Email isn’t configured</div>
                      <div style={{ color: "#555" }}>Copy this one-time setup code:</div>
                      <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, letterSpacing: 2 }}>{bootstrapCopyCode}</div>
                        <button
                          onClick={async () => {
                            const ok = await copyToClipboard(bootstrapCopyCode);
                            if (ok) setBootstrapStatus("Copied to clipboard");
                          }}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #111",
                            background: "#fff",
                            color: "#111",
                            cursor: "pointer",
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {bootstrapStatus ? <div style={{ marginTop: 10, color: "#146c43" }}>{bootstrapStatus}</div> : null}
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ marginTop: 10, color: "#555" }}>
            If you were invited by another admin, sign in and enter your invite code on the tenant setup screen.
          </div>
        </div>
      ) : null}

      {tenant && tenant.planSelected && currentPlan ? (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #e5e5e5", borderRadius: 8 }}>
          <div style={{ fontWeight: 600 }}>Current plan: {currentPlan.name}</div>
          <div style={{ color: "#555", marginTop: 4 }}>
            Seats: up to {currentPlan.maxCaregivers} caregivers • Data management: {String(Boolean(currentPlan.features?.dataManagement))} • Printing: {String(Boolean(currentPlan.features?.printing))}
          </div>
          {tenant?.tenantCode ? (
            <div style={{ color: "#555", marginTop: 6 }}>
              Facility code (support/reference): <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{formatTenantCode(tenant.tenantCode)}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #e5e5e5", borderRadius: 8 }}>
          <div style={{ fontWeight: 600 }}>No plan selected yet</div>
          <div style={{ color: "#555", marginTop: 4 }}>
            Select a plan below to unlock the appropriate features.
          </div>
          {tenant?.tenantCode ? (
            <div style={{ color: "#555", marginTop: 6 }}>
              Facility code (support/reference): <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{formatTenantCode(tenant.tenantCode)}</span>
            </div>
          ) : null}
        </div>
      )}

      {tenant?.tenantCode ? (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #e5e5e5", borderRadius: 8 }}>
          <div style={{ fontWeight: 600 }}>Invite caregiver by email (one-time code)</div>
          <div style={{ color: "#555", marginTop: 4 }}>
            Sends a 6-digit invite code to the user’s email. They must sign in with that same email, then enter the code on the tenant setup screen.
            <span style={{ marginLeft: 6 }}>
              (They can go to <span style={{ fontFamily: "monospace" }}>/tenant-setup</span>.)
            </span>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="caregiver@facility.com"
              style={{ flex: "1 1 260px", padding: 10, borderRadius: 6, border: "1px solid #ddd" }}
            />
            <button
              onClick={handleSendInviteOtp}
              disabled={inviteBusy || !inviteEmail.trim()}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              {inviteBusy ? "Sending…" : "Send invite code"}
            </button>
          </div>

          {inviteStatus ? <div style={{ marginTop: 10, color: "#555" }}>{inviteStatus}</div> : null}

          {inviteCopyCode ? (
            <div style={{ marginTop: 12, background: "#fff8e6", border: "1px solid #ffe7b8", padding: 10, borderRadius: 8 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Copy-code fallback</div>
              <div style={{ color: "#555" }}>
                Invite code:
                <span style={{ marginLeft: 8, fontFamily: "monospace", fontWeight: 800, letterSpacing: 2 }}>{inviteCopyCode}</span>
                {inviteExpiresAt ? <span style={{ marginLeft: 10 }}>Expires: {new Date(inviteExpiresAt).toLocaleString()}</span> : null}
              </div>
              <button
                onClick={async () => {
                  const ok = await copyToClipboard(inviteCopyCode);
                  if (ok) setInviteStatus("Copied to clipboard");
                }}
                style={{
                  marginTop: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#fff",
                  color: "#111",
                  cursor: "pointer",
                }}
              >
                Copy
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 20 }}>
        {planCards.map((p) => (
          <div key={p.id} style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 16, background: "white" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ margin: 0 }}>{p.name}</h3>
              <div style={{ fontWeight: 700 }}>{formatUsd(p.priceUsdMonthly)}/mo</div>
            </div>

            <div style={{ marginTop: 10, color: "#555" }}>
              <div>Up to <strong>{p.maxCaregivers}</strong> caregivers</div>
              <div>Data management: <strong>{p.features?.dataManagement ? "Yes" : "No"}</strong></div>
              <div>Printing/export: <strong>{p.features?.printing ? "Yes" : "No"}</strong></div>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <button
                onClick={() => handleSelectPlan(p.id)}
                disabled={tenantRequired || Boolean(savingPlanId) || p.isSelected}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #222",
                  background: p.isSelected ? "#f1f1f1" : "#111",
                  color: p.isSelected ? "#333" : "white",
                  cursor: p.isSelected ? "default" : "pointer",
                  width: "100%",
                }}
              >
                {p.isSelected ? "Selected" : savingPlanId === p.id ? "Selecting…" : "Select plan"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, color: "#777", fontSize: 13 }}>
        Stripe billing will be wired later; for now this sets a plan flag per tenant.
      </div>
    </div>
  );
}

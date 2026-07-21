import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import { getMe } from "../services/me";
import { getLastAuthTokenError } from "../services/authToken";

function formatUsd(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "$0";
  return `$${n}`;
}

function formatCurrencyFromMinorUnits(amount, currency = "usd") {
  if (typeof amount !== "number" || Number.isNaN(amount)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format(amount / 100);
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

function getClerkTokenFailureMessage() {
  const tokenError = getLastAuthTokenError();
  const detail = tokenError?.message ? ` Clerk detail: ${tokenError.message}` : "";

  return (
    "Clerk could not create a session token for this browser, so billing requests cannot authenticate. " +
    "In Clerk Dashboard, confirm http://localhost:3000 is allowed under Domains & URLs / allowed origins for this development instance, then sign out and sign back in." +
    detail
  );
}

export default function AdminBillingPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [tenant, setTenant] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [billingInfo, setBillingInfo] = useState(null);
  const [plans, setPlans] = useState([]);
  const [savingPlanId, setSavingPlanId] = useState(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelConfirmText, setCancelConfirmText] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
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
    const checkoutState = new URLSearchParams(location.search).get("checkout");

    if (checkoutState === "success") {
      setStatusMessage(
        "Stripe returned successfully. If the paid plan does not appear yet, wait a few seconds and refresh while the webhook finishes syncing."
      );
      return;
    }

    if (checkoutState === "cancel") {
      setStatusMessage("Stripe checkout was canceled. No billing changes were applied.");
      return;
    }

    setStatusMessage("");
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;

    async function loadInvoicesIfAvailable(nextBilling) {
      if (!nextBilling?.invoicesEnabled) {
        setInvoices([]);
        return;
      }

      setInvoicesLoading(true);
      try {
        const invoicesRes = await api.get("/billing/invoices");
        if (cancelled) return;
        setInvoices(Array.isArray(invoicesRes.data?.invoices) ? invoicesRes.data.invoices : []);
      } catch {
        if (cancelled) return;
        setInvoices([]);
      } finally {
        if (cancelled) return;
        setInvoicesLoading(false);
      }
    }

    async function load() {
      setLoading(true);
      setError("");
      setTenantRequired(false);
      setTenantRequiredMessage("");
      setInviteStatus("");
      setInviteCopyCode("");
      setInviteExpiresAt(null);

      try {
        const [plansRes, me] = await Promise.all([
          api.get("/billing/plans"),
          getMe({ forceRefresh: true }),
        ]);
        if (cancelled) return;
        setPlans(Array.isArray(plansRes.data?.plans) ? plansRes.data.plans : []);

        if (!me?.tenantId) {
          setTenantRequired(true);
          setTenantRequiredMessage(
            "Tenant is not assigned for this account. Create your facility first to finish billing setup."
          );
          setTenant(null);
          setCurrentPlan(null);
          setBillingInfo(null);
          setInvoices([]);
          return;
        }

        try {
          const meRes = await api.get("/billing/me");
          if (cancelled) return;
          setTenant(meRes.data?.tenant || null);
          setCurrentPlan(meRes.data?.plan || null);
          setBillingInfo(meRes.data?.billing || null);
          await loadInvoicesIfAvailable(meRes.data?.billing || null);
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
            setBillingInfo(null);
            setInvoices([]);
          } else {
            const tokenError = getLastAuthTokenError();
            setError(
              tokenError
                ? getClerkTokenFailureMessage()
                : message || "Failed to load billing"
            );
          }
        }
      } catch (err) {
        if (cancelled) return;
        const tokenError = getLastAuthTokenError();
        setError(
          tokenError
            ? getClerkTokenFailureMessage()
            : err?.response?.data?.message || err?.message || "Failed to load billing"
        );
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

  // After a successful Stripe checkout redirect, the webhook may take a few
  // seconds to flip the tenant to active. Poll briefly and jump straight to
  // the admin dashboard once access is granted, instead of leaving the admin
  // stuck looking at the plan-selection screen.
  useEffect(() => {
    if (loading) return;

    const checkoutState = new URLSearchParams(location.search).get("checkout");
    if (checkoutState !== "success") return;

    if (billingInfo?.accessGranted) {
      navigate("/admin", { replace: true });
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 5;

    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const meRes = await api.get("/billing/me");
        if (cancelled) return;
        setTenant(meRes.data?.tenant || null);
        setCurrentPlan(meRes.data?.plan || null);
        setBillingInfo(meRes.data?.billing || null);

        if (meRes.data?.billing?.accessGranted) {
          clearInterval(interval);
          navigate("/admin", { replace: true });
        }
      } catch {
        // ignore transient errors, keep polling
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  async function refreshBilling() {
    const meRes = await api.get("/billing/me");
    setTenant(meRes.data?.tenant || null);
    setCurrentPlan(meRes.data?.plan || null);
    setBillingInfo(meRes.data?.billing || null);
    setTenantRequired(false);
    setTenantRequiredMessage("");

    if (meRes.data?.billing?.invoicesEnabled) {
      setInvoicesLoading(true);
      try {
        const invoicesRes = await api.get("/billing/invoices");
        setInvoices(Array.isArray(invoicesRes.data?.invoices) ? invoicesRes.data.invoices : []);
      } finally {
        setInvoicesLoading(false);
      }
    } else {
      setInvoices([]);
    }
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
      setBootstrapExpiresAt(res.data?.expiresAt || null);

      if (res.data?.code === "MAIL_NOT_CONFIGURED" && res.data?.setupCode) {
        // Auto-fill the input so the user never has to retype the displayed code.
        setBootstrapCopyCode(res.data.setupCode);
        setBootstrapOtp(res.data.setupCode);
      } else {
        setBootstrapOtp("");
        setBootstrapCopyCode("");
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
      setBillingInfo(res.data?.billing || null);

      if (res.data?.mode === "checkout_required") {
        const checkoutRes = await api.post("/billing/checkout-session", {
          planId,
          returnPath: "/admin/billing?checkout=success",
        });

        if (checkoutRes.data?.url) {
          window.location.assign(checkoutRes.data.url);
          return;
        }

        throw new Error("Stripe checkout URL was not returned by the server.");
      }

      if (res.data?.mode === "already_active") {
        setStatusMessage("This paid plan is already active for your facility.");
        return;
      }

      navigate("/admin", { replace: true });
    } catch (err) {
      const tokenError = getLastAuthTokenError();
      setError(
        tokenError
          ? getClerkTokenFailureMessage()
          : err?.response?.data?.message || err?.message || "Failed to select plan"
      );
    } finally {
      setSavingPlanId(null);
    }
  }

  async function handleOpenPortal() {
    setError("");
    setPortalBusy(true);
    try {
      const res = await api.post("/billing/portal-session", {
        returnPath: "/admin/billing",
      });

      if (!res.data?.url) {
        throw new Error("Stripe billing portal URL was not returned by the server.");
      }

      window.location.assign(res.data.url);
    } catch (err) {
      const tokenError = getLastAuthTokenError();
      setError(
        tokenError
          ? getClerkTokenFailureMessage()
          : err?.response?.data?.message || err?.message || "Failed to open billing portal"
      );
    } finally {
      setPortalBusy(false);
    }
  }

  function openCancelDialog() {
    setError("");
    setCancelConfirmText("");
    setCancelReason("");
    setCancelDialogOpen(true);
  }

  function closeCancelDialog() {
    if (cancelBusy) return;
    setCancelDialogOpen(false);
    setCancelConfirmText("");
    setCancelReason("");
  }

  async function handleCancelSubscription() {
    setError("");

    const expectedName = (tenant?.name || "").trim().toLowerCase();
    const providedName = cancelConfirmText.trim().toLowerCase();

    if (!expectedName || providedName !== expectedName) {
      setError(`Type the facility name exactly (${tenant?.name || "the facility"}) to confirm cancellation.`);
      return;
    }

    if (!cancelReason.trim()) {
      setError("Please provide a cancellation reason before continuing.");
      return;
    }

    setCancelBusy(true);
    try {
      const res = await api.post("/billing/cancel-subscription", {
        confirmName: cancelConfirmText,
        cancellationReason: cancelReason,
      });

      setCancelDialogOpen(false);
      setCancelConfirmText("");
      setCancelReason("");
      await refreshBilling();
      setStatusMessage(res.data?.message || "Cancellation scheduled.");
    } catch (err) {
      const tokenError = getLastAuthTokenError();
      setError(
        tokenError
          ? getClerkTokenFailureMessage()
          : err?.response?.data?.message || err?.message || "Failed to cancel subscription"
      );
    } finally {
      setCancelBusy(false);
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

      {statusMessage ? (
        <div style={{ background: "#eef8ff", border: "1px solid #cfe8ff", padding: 12, borderRadius: 8, marginTop: 16, color: "#0b5394" }}>
          {statusMessage}
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
            Seats: up to {currentPlan.maxStaff} staff members • Data management: {String(Boolean(currentPlan.features?.dataManagement))} • Printing: {String(Boolean(currentPlan.features?.printing))}
          </div>
          {tenant?.subscriptionStatus ? (
            <div style={{ color: "#555", marginTop: 6 }}>
              Billing status: <strong>{tenant.subscriptionStatus}</strong>
              {tenant?.currentPeriodEnd ? (
                <span style={{ marginLeft: 8 }}>
                  Renews or changes on: {new Date(tenant.currentPeriodEnd).toLocaleString()}
                </span>
              ) : null}
            </div>
          ) : null}
          {tenant?.tenantCode ? (
            <div style={{ color: "#555", marginTop: 6 }}>
              Facility code (support/reference): <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{formatTenantCode(tenant.tenantCode)}</span>
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            {billingInfo?.canManagePortal ? (
              <button
                onClick={handleOpenPortal}
                disabled={portalBusy}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#fff",
                  color: "#111",
                  cursor: "pointer",
                }}
              >
                {portalBusy ? "Opening billing portal…" : "Manage billing in Stripe"}
              </button>
            ) : null}

            {billingInfo?.subscriptionActive && tenant?.stripeSubscriptionId ? (
              <button
                onClick={openCancelDialog}
                disabled={portalBusy || cancelBusy}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #b00020",
                  background: "#fff3f3",
                  color: "#b00020",
                  cursor: "pointer",
                }}
              >
                Cancel subscription
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #e5e5e5", borderRadius: 8 }}>
          <div style={{ fontWeight: 600 }}>No plan selected yet</div>
          <div style={{ color: "#555", marginTop: 4 }}>
            Select a plan below to unlock the appropriate features.
          </div>
          {currentPlan && billingInfo?.requiresCheckout ? (
            <div style={{ color: "#555", marginTop: 6 }}>
              Selected plan: <strong>{currentPlan.name}</strong>. Complete Stripe checkout to activate this paid plan.
            </div>
          ) : null}
          {tenant?.tenantCode ? (
            <div style={{ color: "#555", marginTop: 6 }}>
              Facility code (support/reference): <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{formatTenantCode(tenant.tenantCode)}</span>
            </div>
          ) : null}
        </div>
      )}

      {cancelDialogOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1000,
          }}
          onClick={closeCancelDialog}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              border: "1px solid #f0c0c0",
              boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ color: "#b00020", fontWeight: 800, fontSize: 18 }}>Cancel subscription</div>
            <div style={{ marginTop: 8, color: "#555", lineHeight: 1.5 }}>
              This will schedule the subscription to end at the close of the current billing period.
              You can reopen the Stripe portal later if you need to change billing details.
            </div>
            <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#fff3f3", border: "1px solid #ffd7d7", color: "#7a1f2c" }}>
              To confirm, type <strong>{tenant?.name || "the facility name"}</strong> exactly.
            </div>
            <input
              value={cancelConfirmText}
              onChange={(e) => setCancelConfirmText(e.target.value)}
              placeholder={tenant?.name || "Facility name"}
              style={{
                width: "100%",
                marginTop: 12,
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ddd",
              }}
            />
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why are you cancelling?"
              rows={4}
              style={{
                width: "100%",
                marginTop: 12,
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ddd",
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button
                onClick={handleCancelSubscription}
                disabled={
                  cancelBusy ||
                  cancelConfirmText.trim().toLowerCase() !== (tenant?.name || "").trim().toLowerCase() ||
                  !cancelReason.trim()
                }
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #b00020",
                  background: "#b00020",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                {cancelBusy ? "Scheduling cancellation…" : "Confirm cancellation"}
              </button>
              <button
                onClick={closeCancelDialog}
                disabled={cancelBusy}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "#fff",
                  color: "#111",
                  cursor: "pointer",
                }}
              >
                Keep subscription
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tenant?.tenantCode ? (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #e5e5e5", borderRadius: 8 }}>
          <div style={{ fontWeight: 600 }}>Invite staff member by email (one-time code)</div>
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
              placeholder="staff@facility.com"
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

      {billingInfo?.invoicesEnabled ? (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #e5e5e5", borderRadius: 8 }}>
          <div style={{ fontWeight: 600 }}>Recent invoices</div>
          {invoicesLoading ? (
            <div style={{ color: "#555", marginTop: 8 }}>Loading invoices…</div>
          ) : invoices.length ? (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: 10,
                    border: "1px solid #efefef",
                    borderRadius: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{invoice.id}</div>
                    <div style={{ color: "#555", marginTop: 4 }}>
                      {invoice.status || "unknown"} • {invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : "No date"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>
                      {formatCurrencyFromMinorUnits(invoice.amountPaid || invoice.amountDue, invoice.currency)}
                    </div>
                    {invoice.hostedInvoiceUrl ? (
                      <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" style={{ color: "#0b5394" }}>
                        Open invoice
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#555", marginTop: 8 }}>No invoices yet.</div>
          )}
        </div>
      ) : null}

      {tenantRequired ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #ffe7b8",
            borderRadius: 8,
            background: "#fff8e6",
            color: "#7a4b00",
          }}
        >
          Your facility must be created or joined before plan checkout is enabled.
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
              <div>Up to <strong>{p.maxStaff}</strong> staff members</div>
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
                {p.isSelected
                  ? "Selected"
                  : tenantRequired
                    ? p.billingType === "stripe"
                      ? "Setup required before checkout"
                      : "Setup required before selection"
                  : savingPlanId === p.id
                    ? p.billingType === "stripe"
                      ? "Opening checkout…"
                      : "Selecting…"
                    : p.billingType === "stripe"
                      ? "Continue to checkout"
                      : "Select plan"}
              </button>
            </div>

            {p.billingType === "stripe" ? (
              <div style={{ marginTop: 10, color: "#777", fontSize: 13 }}>
                Secure payment and subscription management are handled in Stripe Checkout.
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, color: "#777", fontSize: 13 }}>
        Free plan selection happens immediately. Paid plans redirect to Stripe Checkout and activate only after Stripe confirms the subscription.
      </div>
    </div>
  );
}

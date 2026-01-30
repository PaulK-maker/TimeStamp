import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Navigate, useLocation } from "react-router-dom";
import { getMe } from "../services/me";
import api from "../services/api";

export default function RequireAdminPlanSelected({ children }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [planSelected, setPlanSelected] = useState(null);
  const [error, setError] = useState(null);
  const [tenantSetupRequired, setTenantSetupRequired] = useState(false);
  const [tenantSetupMessage, setTenantSetupMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isLoaded) return;
      if (!isSignedIn) {
        setLoading(false);
        setRole(null);
        setPlanSelected(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      setTenantSetupRequired(false);
      setTenantSetupMessage("");

      try {
        const me = await getMe({ cacheKey: userId, forceRefresh: true });
        if (cancelled) return;

        const nextRole = me?.role ?? null;
        setRole(nextRole);

        if (nextRole !== "admin") {
          setPlanSelected(null);
          return;
        }

        // Don't enforce plan selection on the billing page itself.
        if (location.pathname.startsWith("/admin/billing")) {
          setPlanSelected(true);
          return;
        }

        const billing = await api.get("/billing/me");
        if (cancelled) return;
        setPlanSelected(Boolean(billing.data?.tenant?.planSelected));
      } catch (err) {
        if (cancelled) return;
        const code = err?.response?.data?.code;
        const message = err?.response?.data?.message || err?.message || "";

        if (code === "TENANT_REQUIRED") {
          setTenantSetupRequired(true);
          setTenantSetupMessage(
            message ||
              "Tenant is not assigned for this account. Run the tenant backfill script once to assign your facility."
          );
          // Keep role so we don't redirect away from admin.
          setPlanSelected(null);
          setError(null);
          return;
        }

        setError(err);
        setRole(null);
        setPlanSelected(null);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, location.pathname]);

  if (!isLoaded) {
    return (
      <div style={{ padding: 24 }}>
        <p>Checking access…</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p>Checking access…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Access check failed</h2>
        <p style={{ color: "#b00020" }}>
          {error?.response?.data?.message || error?.message || "Failed to verify access"}
        </p>
      </div>
    );
  }

  if (tenantSetupRequired) {
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h2>Setup required</h2>
        <p style={{ color: "#b00020" }}>{tenantSetupMessage}</p>
        <div style={{ marginTop: 12, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Fix (one-time): create or join your facility</div>
          <div style={{ marginTop: 6, color: "#555" }}>
            Open the Billing page and click <strong>Create my facility</strong>.
          </div>
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
            <button
              onClick={() => window.location.assign("/admin/billing")}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #111",
                background: "#fff",
                color: "#111",
                cursor: "pointer",
                marginLeft: 10,
              }}
            >
              Open Billing Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (role !== "admin") {
    return <Navigate to="/caregiver" replace />;
  }

  if (planSelected === false) {
    return <Navigate to="/admin/billing" replace />;
  }

  return <>{children}</>;
}

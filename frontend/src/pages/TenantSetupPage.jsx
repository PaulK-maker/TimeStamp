import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, useAuth } from "@clerk/clerk-react";
import api from "../services/api";
import { getMe, resetMeCache } from "../services/me";

function normalizeDigits(value) {
  return (value || "").toString().replace(/\D/g, "");
}

export default function TenantSetupPage() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteSaving, setInviteSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!isLoaded) return;
      if (!isSignedIn) {
        setLoading(false);
        setMe(null);
        return;
      }

      try {
        const nextMe = await getMe({ cacheKey: userId, forceRefresh: true });
        if (cancelled) return;
        setMe(nextMe || null);
      } catch {
        if (cancelled) return;
        setMe(null);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId]);

  async function handleRedeemInvite() {
    setError("");
    setInviteSaving(true);
    try {
      await api.post("/tenant/otp/redeem-join", { code: inviteCode });
      resetMeCache();
      const nextMe = await getMe({ cacheKey: userId, forceRefresh: true });

      const role = nextMe?.role;
      const nextPath = role === "admin" ? "/admin" : "/caregiver";
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to redeem invite code");
    } finally {
      setInviteSaving(false);
    }
  }

  return (
    <>
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>

      <SignedIn>
        <div style={{ padding: 24, maxWidth: 820, margin: "0 auto" }}>
          <h2>Join your facility</h2>
          <p style={{ marginTop: 4, color: "#555" }}>
            Enter the 6-digit invite code your admin sent to your email.
          </p>

          {loading ? (
            <p>Loading…</p>
          ) : me?.tenantId ? (
            <Navigate to={me?.role === "admin" ? "/admin" : "/caregiver"} replace />
          ) : (
            <>
              {error ? (
                <div style={{ background: "#fff3f3", border: "1px solid #ffd7d7", padding: 12, borderRadius: 8, marginTop: 16 }}>
                  <strong style={{ color: "#b00020" }}>Error:</strong> {error}
                </div>
              ) : null}

              <div
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: 12,
                }}
              >
                <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 16, background: "white" }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Join with invite code (recommended)</div>
                  <div style={{ color: "#555", marginBottom: 10 }}>
                    Enter the 6-digit code your admin sent to your email. You must be signed in with that same email.
                  </div>

                  <label style={{ display: "block", fontSize: 13, color: "#444" }}>Invite code</label>
                  <input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="123456"
                    inputMode="numeric"
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      marginTop: 6,
                      fontFamily: "monospace",
                      letterSpacing: "0.18em",
                    }}
                  />

                  <div style={{ marginTop: 8, color: "#777", fontSize: 13 }}>
                    You entered: <span style={{ fontFamily: "monospace" }}>{normalizeDigits(inviteCode) || "—"}</span>
                  </div>

                  <button
                    onClick={handleRedeemInvite}
                    disabled={inviteSaving || normalizeDigits(inviteCode).length !== 6}
                    style={{
                      marginTop: 14,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #111",
                      background: "#111",
                      color: "#fff",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    {inviteSaving ? "Verifying…" : "Join with invite code"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate("/post-sign-in", { replace: true })}
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#fff",
                  color: "#111",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Back
              </button>
            </>
          )}
        </div>
      </SignedIn>
    </>
  );
}

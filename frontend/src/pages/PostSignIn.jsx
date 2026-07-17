import React, { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { getMe } from "../services/me";

// After Clerk email verification, the session token can take a moment to
// become valid. Retry a few times before showing an error.
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

export default function PostSignIn() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [nextPath, setNextPath] = useState(null);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const retryTimer = useRef(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setNextPath("/sign-in");
      return;
    }

    setError("");

    (async () => {
      try {
        const me = await getMe({ cacheKey: userId, forceRefresh: true });
        const role = me?.role;

        if (role === "superadmin") {
          setNextPath("/superadmin");
          return;
        }

        if (!me?.tenantId) {
          setNextPath("/tenant-setup");
          return;
        }
        setNextPath(role === "admin" ? "/admin" : "/staff");
      } catch (err) {
        const status = err?.response?.status;

        // Auto-retry on 401 — Clerk session tokens can be briefly invalid
        // right after email verification before the session is fully established.
        if (status === 401 && retryCount < MAX_RETRIES) {
          retryTimer.current = setTimeout(() => {
            setRetryCount((n) => n + 1);
          }, RETRY_DELAY_MS);
          return;
        }

        const serverMessage = err?.response?.data?.message || "";
        if (serverMessage.toLowerCase().includes("already linked to a different account")) {
          setError("already-linked");
        } else if (status === 401) {
          setError("auth-failed");
        } else {
          setError("generic");
        }
      }
    })();

    return () => clearTimeout(retryTimer.current);
  }, [isLoaded, isSignedIn, userId, retryCount]);

  if (nextPath) {
    return <Navigate to={nextPath} replace />;
  }

  if (error) {
    return (
      <div style={{ padding: 24, maxWidth: 480 }}>
        <h2 style={{ marginBottom: 12 }}>We could not sign you in</h2>

        {error === "already-linked" && (
          <p style={{ color: "#b00020", marginBottom: 16 }}>
            This email address is already associated with a different account.
            Please sign in using your original account, or contact support if
            you believe this is an error.
          </p>
        )}

        {error === "auth-failed" && (
          <p style={{ color: "#b00020", marginBottom: 16 }}>
            Your session could not be verified. This sometimes happens right
            after account creation — please try again in a moment.
          </p>
        )}

        {error === "generic" && (
          <p style={{ color: "#b00020", marginBottom: 16 }}>
            Something went wrong while loading your account. Please try again.
          </p>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={() => { setError(""); setRetryCount((n) => n + 1); }}
            style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#111", color: "#fff", cursor: "pointer", fontWeight: 600 }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = "/sign-out"; }}
            style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", color: "#333", cursor: "pointer" }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <p style={{ color: "#555" }}>{retryCount > 0 ? "Establishing your session…" : "Signing you in…"}</p>
    </div>
  );
}

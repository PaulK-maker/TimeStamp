import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { getMe } from "../services/me";

export default function PostSignIn() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [nextPath, setNextPath] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

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
        setNextPath(role === "admin" ? "/admin" : "/caregiver");
      } catch (err) {
    const status = err?.response?.status;
    const serverMessage = err?.response?.data?.message;
    if (status === 401) {
      setError(
        (serverMessage || "Unauthorized") +
        ". If you are using Clerk on the frontend, ensure the backend has CLERK_SECRET_KEY set so /api/auth/me can validate Clerk session tokens."
      );
      return;
    }

    setError(serverMessage || err.message || "Failed to verify session");
      }
    })();
  }, [isLoaded, isSignedIn, userId, attempt]);

  if (nextPath) {
    return <Navigate to={nextPath} replace />;
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Sign-in verification failed</h2>
        <p style={{ color: "#b00020" }}>{error}</p>
        <p style={{ marginTop: 16, maxWidth: 820 }}>
          Quick checks: confirm <code>REACT_APP_API_BASE_URL</code> matches your backend (default is <code>http://localhost:5001</code>),
          and set <code>CLERK_SECRET_KEY</code> in <code>backend/.env</code> so <code>/api/auth/me</code> can validate Clerk session tokens.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
          <button type="button" onClick={() => (window.location.href = "/sign-out") }>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <p>Signing you in…</p>
    </div>
  );
}

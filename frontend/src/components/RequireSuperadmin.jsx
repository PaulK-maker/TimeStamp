import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";
import { getMe } from "../services/me";

export default function RequireSuperadmin({ children }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isLoaded) return;
      if (!isSignedIn) {
        setLoading(false);
        setRole(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const me = await getMe({ cacheKey: userId, forceRefresh: true });
        if (cancelled) return;
        setRole(me?.role ?? null);
      } catch (err) {
        if (cancelled) return;
        setError(err);
        setRole(null);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId]);

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

  if (role !== "superadmin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import api from "../services/api";

export default function PostSignIn() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate("/sign-in", { replace: true });
      return;
    }

    (async () => {
      try {
        const res = await api.get("/auth/me");
        const role = res.data?.user?.role;

        // If role isn't set yet in Clerk claims, default to caregiver area.
        if (role === "admin") {
          navigate("/admin", { replace: true });
        } else {
          navigate("/caregiver", { replace: true });
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || "Failed to verify session");
      }
    })();
  }, [isLoaded, isSignedIn, navigate]);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Sign-in verification failed</h2>
        <p style={{ color: "#b00020" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <p>Signing you in…</p>
    </div>
  );
}

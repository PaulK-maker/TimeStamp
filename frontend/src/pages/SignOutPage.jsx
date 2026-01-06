import React, { useEffect } from "react";
import { useClerk } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

export default function SignOutPage() {
  const { signOut } = useClerk();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        // Clear any legacy auth artifacts
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        localStorage.removeItem("caregiver");
        await signOut();
      } finally {
        navigate("/sign-in", { replace: true });
      }
    })();
  }, [navigate, signOut]);

  return (
    <div style={{ padding: 24 }}>
      <p>Signing out…</p>
    </div>
  );
}

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await api.post("/auth/login", { email, password });
      console.log("LOGIN RESPONSE:", res.data);

      // Backend returns { message, token, caregiver }
      const { token, caregiver } = res.data;

      if (!token) throw new Error("No token returned from server");

      // Save token
      localStorage.setItem("token", token);

      // Only allow admin
      // if (caregiver?.role !== "admin") {
      //   localStorage.removeItem("token");
      //   setError("Access denied: Admins only");
      //   return;
      // }
      //   navigate("/admin");

      const handleLogin = async (e) => {
  e.preventDefault();
  setError("");

  try {
    const res = await api.post("/auth/login", { email, password });
    console.log("LOGIN RESPONSE:", res.data);

    const { token, caregiver } = res.data;

    if (!token || !caregiver?.role) {
      throw new Error("Invalid login response");
    }

    // ✅ Save auth data
    localStorage.setItem("token", token);
    localStorage.setItem("role", caregiver.role);

    // ✅ Role-based redirect
    if (caregiver.role === "admin") {
      navigate("/admin");
    } else if (caregiver.role === "caregiver") {
      navigate("/caregiver");
    } else {
      setError("Unknown role");
      localStorage.clear();
    }

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    setError(err.response?.data?.message || err.message || "Login failed");
  }
};
      // Go to admin dashboard
      navigate("/admin");
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setError(err.response?.data?.message || err.message || "Login failed");
    }
  };

  return (
    <div
      style={{
        padding: "50px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h1>LOGIN PAGE</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <form
        onSubmit={handleLogin}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "15px",
          width: "300px",
        }}
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: "10px", fontSize: "16px" }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: "10px", fontSize: "16px" }}
        />
        <button
          type="submit"
          style={{
            padding: "10px",
            fontSize: "16px",
            backgroundColor: "#333",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Login
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
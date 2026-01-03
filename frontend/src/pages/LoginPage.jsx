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

      if (!token || !caregiver?.role) {
        throw new Error("Invalid login response");
      }

      // Save auth data
      localStorage.setItem("token", token);
      localStorage.setItem("role", caregiver.role);
      localStorage.setItem("user", JSON.stringify({ caregiver }));

      // Role-based redirect
      if (caregiver.role === "admin") {
        navigate("/admin");
      } else if (caregiver.role === "caregiver") {
        navigate("/caregiver");
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        setError("Unknown role");
      }
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
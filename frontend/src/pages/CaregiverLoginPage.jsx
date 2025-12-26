import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const CaregiverLoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await api.post("/auth/login", { email, password });
      console.log("CAREGIVER LOGIN RESPONSE:", res.data);

      const { token, caregiver } = res.data;

      if (!token) throw new Error("No token returned from server");

      // Save token (caregiver token is fine)
      localStorage.setItem("token", token);

      // Optionally store caregiver info too
      localStorage.setItem("caregiver", JSON.stringify(caregiver));

      // Navigate to caregiver dashboard / punch page
      navigate("/caregiver");
    } catch (err) {
      console.error("CAREGIVER LOGIN ERROR:", err);
      setError(
        err.response?.data?.message || err.message || "Login failed"
      );
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
      <h1>CAREGIVER LOGIN</h1>
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

export default CaregiverLoginPage;

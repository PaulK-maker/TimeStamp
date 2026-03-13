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
      console.log("STAFF LOGIN RESPONSE:", res.data);

      const { token, staff } = res.data;

      if (!token) throw new Error("No token returned from server");

      // Save token
      localStorage.setItem("token", token);

      // Keep auth storage consistent across the app
      localStorage.setItem("role", staff?.role || "staff");
      localStorage.setItem("user", JSON.stringify({ staff }));

      localStorage.setItem("staff", JSON.stringify(staff));

      navigate("/staff");
    } catch (err) {
      console.error("STAFF LOGIN ERROR:", err);
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
      <h1>STAFF LOGIN</h1>
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

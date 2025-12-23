// // src/pages/LoginPage.jsx
// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import api from "../services/api";

// const LoginPage = () => {
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [error, setError] = useState("");
//   const navigate = useNavigate();

//   const handleLogin = async (e) => {
//     e.preventDefault();
//     setError(""); // Clear previous errors

//     try {
//       // Call backend login
//       const res = await api.post("/auth/login", { email, password });

//       // DEBUG: See backend response
//       console.log("LOGIN RESPONSE:", res.data);

//       // Extract token & user
//       const { token, user } = res.data;

//       if (!token) throw new Error("No token returned from server");

//       // Save token to localStorage
//       localStorage.setItem("token", token);

//       // Optional: only allow admin
//       if (user?.role !== "admin") {
//         localStorage.removeItem("token");
//         setError("Access denied: Admins only");
//         return;
//       }

//       // Navigate to admin dashboard
//       navigate("/admin");
//     } catch (err) {
//       console.error("LOGIN ERROR:", err);
//       setError(
//         err.response?.data?.message || err.message || "Login failed"
//       );
//     }
//   };

//   return (
//     <div
//       style={{
//         display: "flex",
//         flexDirection: "column",
//         alignItems: "center",
//         padding: "50px",
//         fontFamily: "Arial, sans-serif",
//       }}
//     >
//       <h1>LOGIN PAGE</h1>

//       {error && (
//         <p style={{ color: "red", marginBottom: "20px" }}>{error}</p>
//       )}

//       <form
//         onSubmit={handleLogin}
//         style={{
//           display: "flex",
//           flexDirection: "column",
//           gap: "15px",
//           width: "300px",
//         }}
//       >
//         <input
//           type="email"
//           placeholder="Email"
//           value={email}
//           onChange={(e) => setEmail(e.target.value)}
//           required
//           style={{ padding: "10px", fontSize: "16px" }}
//         />

//         <input
//           type="password"
//           placeholder="Password"
//           value={password}
//           onChange={(e) => setPassword(e.target.value)}
//           required
//           style={{ padding: "10px", fontSize: "16px" }}
//         />

//         <button
//           type="submit"
//           style={{
//             padding: "10px",
//             fontSize: "16px",
//             backgroundColor: "#333",
//             color: "#fff",
//             cursor: "pointer",
//           }}
//         >
//           Login
//         </button>
//       </form>
//     </div>
//   );
// };

// export default LoginPage;

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
      console.log("LOGIN RESPONSE:", res.data); // check what backend returns

      const { token, user } = res.data;

      if (!token) throw new Error("No token returned from server");

      localStorage.setItem("token", token);

      if (user?.role !== "admin") {
        localStorage.removeItem("token");
        setError("Access denied: Admins only");
        return;
      }

      navigate("/admin");
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setError(err.response?.data?.message || err.message || "Login failed");
    }
  };

  return (
    <div style={{ padding: "50px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <h1>LOGIN PAGE</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "15px", width: "300px" }}>
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
          style={{ padding: "10px", fontSize: "16px", backgroundColor: "#333", color: "#fff", cursor: "pointer" }}
        >
          Login
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
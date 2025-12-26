// backend/server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const caregiverRoutes = require("./routes/caregiverRoutes");
const timeClockRoutes = require("./routes/timeClockRoutes");
const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

// 1. Connect to MongoDB
connectDB();

// 2. Global middleware
app.use(
  cors({
    origin: "http://localhost:3000", // React dev server
    credentials: true,
  })
);
app.use(express.json());

// 3. Health / test routes
app.get("/", (req, res) => {
  res.send("Caregiver Time Clock API running");
});

app.get("/api/test", (req, res) => {
  res.json({ test: "ok" });
});

// Add these BEFORE your routes

app.use(express.urlencoded({ extended: true }));


// 4. API routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/caregivers", caregiverRoutes);
app.use("/api/timeclock", timeClockRoutes);

// ✅ simple POST test route (for Postman)
app.post("/api/test", (req, res) => {
  res.json({ message: "Test POST ok", body: req.body });
});

// ✅ simple GET ping route
app.get("/api/ping", (req, res) => {
  res.json({ ping: "ok" });
});
// 5. Start server


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 5. Start server:


// // server.js or app.js
// const express = require("express");
// const jwt = require("jsonwebtoken");
// const protect = require("./middleware/authMiddleware"); // your protect middleware
// const authorizeRoles = require("./middleware/roleMiddleware"); // your fixed role middleware

// const app = express();
// app.use(express.json());

// // ------------------------
// // Test login endpoint
// // ------------------------
// app.post("/api/login-test", (req, res) => {
//   const { email, role } = req.body;

//   if (!email || !role) {
//     return res.status(400).json({ message: "Email and role required" });
//   }

//   // Generate a simple JWT for testing (expires in 1 hour)
//   const token = jwt.sign({ email, role }, process.env.JWT_SECRET || "secret", {
//     expiresIn: "1h",
//   });

//   res.json({ token });
// });

// // ------------------------
// // Protected admin-only endpoint
// // ------------------------
// app.get(
//   "/api/admin/timelogs-test",
//   protect,
//   authorizeRoles("admin"),
//   (req, res) => {
//     res.json({ message: "Admin access confirmed", user: req.user });
//   }
// );

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
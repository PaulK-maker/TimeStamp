const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const caregiverRoutes = require("./routes/caregiverRoutes");
const timeClockRoutes = require("./routes/timeClockRoutes");

const app = express();

// 1. Connect to MongoDB
connectDB();

// 2. Configure CORS
app.use(
  cors({
    origin: ["http://localhost:3000", "https://timecapcha-frontend.onrender.com"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// Hardcoded CORS fallback to handle preflight requests directly
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// 3. Body parsers for JSON and URL-encoded requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Health and test endpoints
app.get("/", (req, res) => {
  res.json({
    message: "Caregiver Time Clock API ✅",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/ping", (req, res) => {
  res.json({ ping: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/test", (req, res) => {
  res.json({ message: "POST test OK", body: req.body });
});

// 5. Authentication route (sample implementation)
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  
  // Mock credentials (for local testing only)
  const users = [
    { email: "admin@example.com", password: "Admin123!", role: "admin", id: "1" },
    { email: "sarah.jones@test.com", password: "Sarah123!", role: "caregiver", id: "2" },
  ];

  const user = users.find((u) => u.email === email && u.password === password);

  if (user) {
    return res.json({
      message: "Login successful",
      token: `fake-token-for-${user.role}`,
      caregiver: { email: user.email, role: user.role, id: user.id },
    });
  }

  res.status(401).json({ message: "Invalid credentials" });
});

// 6. Additional API routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/caregivers", caregiverRoutes);
app.use("/api/timeclock", timeClockRoutes);

// 7. Handle unmatched routes (404)
app.use("*", (req, res) => {
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
});

// 8. Global error handler
app.use((err, req, res, next) => {
  console.error("🚨 SERVER ERROR:", err.stack);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  });
});

// 9. Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/`);
  console.log(`📍 Ping: http://localhost:${PORT}/api/ping`);
});
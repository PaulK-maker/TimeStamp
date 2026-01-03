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

// 2. ✅ FIXED CORS - Single cors() middleware with dynamic origin validation
// Supports optional comma-separated ALLOWED_ORIGINS env var for additional deployments.
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://localhost:3001",
  "https://timecapcha-frontend.onrender.com",
]);

const extraAllowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
extraAllowedOrigins.forEach((o) => allowedOrigins.add(o));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
}));

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

// 🔍 DEBUG ENDPOINT
app.options("/api/debug-cors", (req, res) => {
  res.json({ 
    origin: req.headers.origin,
    method: req.headers['access-control-request-method']
  });
});

// Optional mock API endpoints (disabled by default).
// These previously shadowed the real JWT+DB-backed routes in production.
const ENABLE_MOCK_API = process.env.ENABLE_MOCK_API === "true";
if (ENABLE_MOCK_API) {
  app.get("/api/admin/timelogs", (req, res) => {
    res.json({
      logs: [
        {
          _id: "1",
          caregiver: {
            _id: "cg1",
            firstName: "Sarah",
            lastName: "Jones",
            email: "sarah.jones@test.com",
          },
          punchIn: "2025-12-28T10:00:00Z",
          punchOut: "2025-12-28T18:00:00Z",
          totalHours: "8.00",
        },
      ],
      totalHoursPerCaregiver: [],
    });
  });

  app.get("/api/timeclock/mylogs", (req, res) => {
    res.json({
      logs: [
        {
          _id: "cg1-1",
          punchIn: "2025-12-28T10:00:00Z",
          punchOut: "2025-12-28T18:00:00Z",
        },
      ],
    });
  });

  app.post("/api/timeclock/punch-in", (req, res) => {
    res.json({
      message: "Clocked in successfully!",
      punchIn: new Date().toISOString(),
      logId: "new-shift-" + Date.now(),
    });
  });

  app.post("/api/timeclock/punch-out", (req, res) => {
    res.json({
      message: "Clocked out successfully!",
      punchOut: new Date().toISOString(),
      hours: Math.random() * 8 + 1,
    });
  });

  app.get("/api/timeclock/status", (req, res) => {
    res.json({
      clockedIn: Math.random() > 0.5,
      currentShift:
        Math.random() > 0.5 ? { punchIn: "2025-12-28T14:00:00Z" } : null,
    });
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;

    const users = [
      {
        email: "admin@example.com",
        password: "Admin123!",
        role: "admin",
        id: "1",
      },
      {
        email: "sarah.jones@test.com",
        password: "Sarah123!",
        role: "caregiver",
        id: "2",
      },
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
}

// 6. Additional API routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/caregivers", caregiverRoutes);
app.use("/api/timeclock", timeClockRoutes);

// 7. 404 handler (LAST - catches everything else)
app.use((req, res) => {
  res.status(404).json({ 
    message: `Route not found: ${req.method} ${req.originalUrl}` 
  });
});

// 8. Global error handler (ALSO LAST)
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
  console.log(`🔍 CORS Debug: http://localhost:${PORT}/api/debug-cors`);
  console.log(`📊 Admin Logs: http://localhost:${PORT}/api/admin/timelogs`);
});




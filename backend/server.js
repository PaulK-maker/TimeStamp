// const express = require("express");
// const cors = require("cors");
// require("dotenv").config();

// const connectDB = require("./config/db");
// const authRoutes = require("./routes/authRoutes");
// const adminRoutes = require("./routes/adminRoutes");
// const caregiverRoutes = require("./routes/caregiverRoutes");
// const timeClockRoutes = require("./routes/timeClockRoutes");

// const app = express();

// // 1. Connect MongoDB
// connectDB();

// // // 2. CORS - ALLOWS EVERYTHING (fixes Network Error)
// // app.use(cors()); 

// // BYPASS CORS - HARDCODE headers
// app.use((req, res, next) => {
//   res.header('Access-Control-Allow-Origin', '*');
//   res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
//   res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
//   if (req.method === 'OPTIONS') {
//     res.sendStatus(200);
//   } else {
//     next();
//   }
// });

// // 3. Body parsers
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // 4. Health checks
// app.get("/", (req, res) => {
//   res.json({ 
//     message: "Caregiver Time Clock API ✅", 
//     status: "running",
//     timestamp: new Date().toISOString()
//   });
// });

// app.get("/api/ping", (req, res) => {
//   res.json({ ping: "ok", timestamp: new Date().toISOString() });
// });

// app.post("/api/test", (req, res) => {
//   res.json({ message: "POST test OK", body: req.body });
// });

// // 5. ALL YOUR ROUTES
// app.use("/api/auth", authRoutes);
// app.use("/api/admin", adminRoutes);
// app.use("/api/caregivers", caregiverRoutes);
// app.use("/api/timeclock", timeClockRoutes);

// // 6. 404 for unmatched routes
// app.use("*", (req, res) => {
//   res.status(404).json({ 
//     message: `Cannot ${req.method} ${req.originalUrl}` 
//   });
// });

// // 7. Global error handler
// app.use((err, req, res, next) => {
//   console.error("🚨 SERVER ERROR:", err.stack);
//   res.status(500).json({ 
//     message: "Internal server error",
//     error: process.env.NODE_ENV === "development" ? err.message : "Something went wrong"
//   });
// });

// // 8. Start server
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
//   console.log(`📍 Health: http://localhost:${PORT}/`);
//   console.log(`📍 Ping: http://localhost:${PORT}/api/ping`);
// });


const express = require("express");
const cors = require("cors");

const app = express();

// HARDCODE CORS - NO PACKAGE ISSUES
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// FAKE LOGIN (bypasses DB crash)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (email === 'admin@example.com' && password === 'Admin123!') {
    return res.json({
      message: 'Login successful',
      token: 'fake-jwt-token-for-testing',
      caregiver: { id: '1', email, role: 'admin' }
    });
  }
  
  if (email === 'sarah.jones@test.com' && password === 'Sarah123!') {
    return res.json({
      message: 'Login successful',
      token: 'fake-jwt-token-for-sarah',
      caregiver: { id: '2', email, role: 'caregiver' }
    });
  }
  
  res.status(401).json({ message: 'Invalid credentials' });
});

// Health checks
app.get('/', (req, res) => res.json({ message: 'API ALIVE ✅' }));
app.get('/api/ping', (req, res) => res.json({ ping: 'ok' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 EMERGENCY SERVER on port ${PORT}`);
});
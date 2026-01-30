// const express = require("express");
// const router = express.Router();
// const { register, login } = require("../controllers/authController");


// const Caregiver = require("../models/caregiver");   // ← add this line
// const bcrypt = require("bcryptjs");      

// router.post("/register", register);
// router.post("/login", login);// ← and this line



// // TEMP: create one admin user without Postman
// router.get("/create-admin-once", async (req, res) => {
//   try {
//     const email = "admin@example.com";

//     let caregiver = await Caregiver.findOne({ email });
//     if (caregiver) {
//       return res.json({ message: "Admin already exists", email });
//     }

//     caregiver = await Caregiver.create({
//       firstName: "Admin",
//       lastName: "User",
//       email,
//       password: "Admin123!",  // plain text here; pre-save hook hashes it
//       role: "admin"           // explicitly make this user admin
//     });

//     res.json({
//       message: "Admin created",
//       email: caregiver.email,
//       role: caregiver.role
//     });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// 
// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");
const Caregiver = require("../models/caregiver");
const Tenant = require("../models/Tenant");
const requireAuth = require("../middleware/authMiddleware");

const DEV_BOOTSTRAP_ENABLED =
  process.env.ENABLE_DEV_BOOTSTRAP === "true" &&
  process.env.NODE_ENV !== "production";

router.post("/register", register);
router.post("/login", login);

// Verify authentication (Clerk preferred, JWT fallback)
router.get("/me", requireAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const baseUser = req.user;
    let tenantCode = null;
    let tenantName = null;

    if (baseUser.tenantId) {
      const tenant = await Tenant.findById(baseUser.tenantId)
        .select("tenantCode name")
        .lean();
      tenantCode = tenant?.tenantCode || null;
      tenantName = tenant?.name || null;
    }

    return res.json({
      user: {
        ...baseUser,
        tenantCode,
        tenantName,
      },
    });
  } catch (err) {
    console.error("/auth/me failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// TEMP: create one admin user (no next)
router.get("/create-admin-once", async (req, res) => {
  if (!DEV_BOOTSTRAP_ENABLED) {
    return res.status(404).json({ message: "Not found" });
  }

  try {
    const email = "admin@example.com";

    // check if already exists
    let caregiver = await Caregiver.findOne({ email });
    if (caregiver) {
      return res.json({ message: "Admin already exists", email });
    }

    // Caregiver model's pre('save') hook will hash this password
    caregiver = await Caregiver.create({
      firstName: "Admin",
      lastName: "User",
      email,
      password: "Admin123!",
      role: "admin",
    });

    res.json({
      message: "Admin created",
      email: caregiver.email,
      role: caregiver.role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
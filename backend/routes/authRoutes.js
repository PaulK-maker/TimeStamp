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
const requireAuth = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);

// Verify authentication (Clerk preferred, JWT fallback)
router.get("/me", requireAuth, (req, res) => {
  res.json({
    user: req.user,
  });
});

// TEMP: create one admin user (no next)
router.get("/create-admin-once", async (req, res) => {
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
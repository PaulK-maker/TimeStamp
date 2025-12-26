// backend/createAdmin.js
require("dotenv").config();
const mongoose = require("mongoose");
const Caregiver = require("./models/caregiver");
const connectDB = require("./config/db");

(async () => {
  try {
    await connectDB();

    const email = "admin@example.com";

    let caregiver = await Caregiver.findOne({ email });
    if (caregiver) {
      console.log("Admin already exists with email:", email);
      process.exit(0);
    }

    caregiver = await Caregiver.create({
      firstName: "Admin",
      lastName: "User",
      email,
      password: "Admin123!", // plain; pre-save hook will hash
      role: "admin",
    });

    console.log("Admin created:", caregiver.email, "role:", caregiver.role);
    process.exit(0);
  } catch (err) {
    console.error("Error creating admin:", err.message);
    process.exit(1);
  }
})();
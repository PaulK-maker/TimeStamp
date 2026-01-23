// scripts/clearClerkId.js
require("dotenv").config({ path: "./.env" });
const mongoose = require("mongoose");
const Caregiver = require("../models/caregiver");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const email = (process.argv[2] || "").trim().toLowerCase();
    if (!email) {
      throw new Error("Missing email arg");
    }

    const r = await Caregiver.updateOne(
      { email },
      { $unset: { clerkUserId: 1 } }
    );

    console.log("Result:", r);
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
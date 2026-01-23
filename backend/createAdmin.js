// backend/createAdmin.js
const path = require("path");

// Always load env from backend/.env, regardless of the process working directory.
require("dotenv").config({ path: path.join(__dirname, ".env") });
const mongoose = require("mongoose");
const Caregiver = require("./models/caregiver");
const connectDB = require("./config/db");

(async () => {
  try {
    await connectDB();

    const emailArg = process.argv[2];
    const email = (process.env.ADMIN_EMAIL || emailArg || "").trim().toLowerCase();
    const password = (process.env.ADMIN_PASSWORD || "Admin123!").trim();

    // Optional: explicitly provide the Clerk user id so we can promote the correct linked record.
    const clerkUserIdArg = process.argv[3];
    const desiredClerkUserId = (process.env.ADMIN_CLERK_USER_ID || clerkUserIdArg || "")
      .trim();

    if (!email) {
      console.error(
        "Missing admin email. Usage: node createAdmin.js admin@yourdomain.com (or set ADMIN_EMAIL)"
      );
      process.exit(1);
    }

    // If possible, resolve the Clerk user id from the email.
    let clerkUserId = desiredClerkUserId || null;
    if (!clerkUserId && process.env.CLERK_SECRET_KEY) {
      try {
        const { clerkClient } = require("@clerk/express");
        const users = await clerkClient.users.getUserList({
          emailAddress: [email],
          limit: 1,
        });
        clerkUserId = users?.[0]?.id || null;
      } catch (err) {
        // Non-fatal: we can still promote by email.
        console.warn(
          "Could not resolve Clerk user id from email. If you previously logged in and a caregiver record exists by clerkUserId, pass ADMIN_CLERK_USER_ID to promote it.",
          err.message
        );
      }
    }

    // If there is already a DB record linked to this Clerk user id, promote that record.
    if (clerkUserId) {
      const caregiverByClerk = await Caregiver.findOne({ clerkUserId });
      if (caregiverByClerk) {
        let changed = false;

        if (caregiverByClerk.role !== "admin") {
          caregiverByClerk.role = "admin";
          changed = true;
        }

        // Safety: do not auto-sync emails between Clerk and DB.
        // If there's an email mismatch, log it for manual cleanup.
        if (caregiverByClerk.email !== email) {
          console.warn(
            "Clerk-linked record email differs from provided ADMIN_EMAIL. Promoting role only; not changing email.",
            { clerkUserId, clerkLinkedEmail: caregiverByClerk.email, providedEmail: email }
          );
        }

        if (changed) {
          await caregiverByClerk.save();
          console.log(
            "Promoted Clerk-linked user to admin:",
            caregiverByClerk.email,
            "clerkUserId:",
            clerkUserId
          );
        } else {
          console.log(
            "Clerk-linked user is already admin:",
            caregiverByClerk.email,
            "clerkUserId:",
            clerkUserId
          );
        }

        process.exit(0);
      }
    }

    let caregiver = await Caregiver.findOne({ email });
    if (caregiver) {
      if (caregiver.role !== "admin") {
        caregiver.role = "admin";
        await caregiver.save();
        console.log("Updated existing user to admin:", email);
      } else {
        console.log("User is already admin:", email);
      }


    // If we know the Clerk user id, link it for future logins.
    if (clerkUserId && !caregiver.clerkUserId) {
    caregiver.clerkUserId = clerkUserId;
    await caregiver.save();
    console.log("Linked admin record to Clerk user id:", clerkUserId);
    }

      process.exit(0);
    }

    caregiver = await Caregiver.create({
      firstName: "Admin",
      lastName: "User",
      email,
      password, // plain; pre-save hook will hash
      role: "admin",
	  ...(clerkUserId ? { clerkUserId } : {}),
    });

    console.log("Admin created:", caregiver.email, "role:", caregiver.role);
    process.exit(0);
  } catch (err) {
    console.error("Error creating admin:", err.message);
    process.exit(1);
  }
})();
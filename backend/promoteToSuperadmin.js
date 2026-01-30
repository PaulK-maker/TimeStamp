// backend/promoteToSuperadmin.js
const path = require("path");

// Always load env from backend/.env, regardless of the process working directory.
require("dotenv").config({ path: path.join(__dirname, ".env") });
const Caregiver = require("./models/caregiver");
const connectDB = require("./config/db");

function normalizeEmail(value) {
  return (value || "").trim().toLowerCase();
}

(async () => {
  try {
    await connectDB();

    const emailArg = process.argv[2];
    const email = normalizeEmail(process.env.SUPERADMIN_EMAIL || emailArg);

    // Optional: allow specifying a Clerk user id directly.
    const clerkUserIdArg = process.argv[3];
    const desiredClerkUserId = (process.env.SUPERADMIN_CLERK_USER_ID || clerkUserIdArg || "").trim();

    if (!email && !desiredClerkUserId) {
      console.error(
        "Missing user identifier. Usage: node promoteToSuperadmin.js user@domain.com [clerkUserId] (or set SUPERADMIN_EMAIL / SUPERADMIN_CLERK_USER_ID)"
      );
      process.exit(1);
    }

    // If possible, resolve the Clerk user id from the email.
    let clerkUserId = desiredClerkUserId || null;
    if (!clerkUserId && email && process.env.CLERK_SECRET_KEY) {
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
          "Could not resolve Clerk user id from email. Promoting by email only.",
          err.message
        );
      }
    }

    // Prefer promoting the DB record linked to Clerk user id if present.
    if (clerkUserId) {
      const caregiverByClerk = await Caregiver.findOne({ clerkUserId });
      if (caregiverByClerk) {
        if (caregiverByClerk.role !== "superadmin") {
          caregiverByClerk.role = "superadmin";
          await caregiverByClerk.save();
          console.log(
            "Promoted Clerk-linked user to superadmin:",
            caregiverByClerk.email,
            "clerkUserId:",
            clerkUserId
          );
        } else {
          console.log(
            "Clerk-linked user is already superadmin:",
            caregiverByClerk.email,
            "clerkUserId:",
            clerkUserId
          );
        }

        process.exit(0);
      }
    }

    if (!email) {
      console.error(
        "No DB record found for provided Clerk user id, and no email provided to fall back to. Provide an email or ensure the user has logged in at least once to create a local Caregiver record."
      );
      process.exit(1);
    }

    const caregiver = await Caregiver.findOne({ email });
    if (!caregiver) {
      console.error(
        `User with email "${email}" not found in MongoDB. Make sure they have logged in at least once (to create a Caregiver record), or pass SUPERADMIN_CLERK_USER_ID to target a Clerk-linked record.`
      );
      process.exit(1);
    }

    if (caregiver.role !== "superadmin") {
      caregiver.role = "superadmin";
      await caregiver.save();
      console.log("Promoted user to superadmin:", email);
    } else {
      console.log("User is already superadmin:", email);
    }

    process.exit(0);
  } catch (err) {
    console.error("Error promoting user to superadmin:", err.message);
    process.exit(1);
  }
})();

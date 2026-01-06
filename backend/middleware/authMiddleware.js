const jwt = require("jsonwebtoken");
const Caregiver = require("../models/caregiver");

module.exports = (req, res, next) => {
  // 1) Prefer Clerk auth when enabled.
  // clerkMiddleware() (in server.js) populates request auth state.
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const { getAuth, clerkClient } = require("@clerk/express");
      const auth = getAuth(req);

      if (auth && auth.userId) {
        const roleFromClaims =
          auth.sessionClaims?.publicMetadata?.role ||
          auth.sessionClaims?.metadata?.role ||
          auth.sessionClaims?.role;

        // Map Clerk user to local Caregiver so downstream code can use ObjectIds.
        // TimeEntry.caregiver expects a Caregiver ObjectId, not a Clerk string id.
        const attachFromCaregiver = (caregiver) => {
          req.user = {
            id: caregiver._id.toString(),
            caregiverId: caregiver._id.toString(),
            role: caregiver.role,
            clerkUserId: auth.userId,
            sessionId: auth.sessionId,
            email: caregiver.email,
          };
        };

        const ensureCaregiver = async () => {
          // 1) Fast path by clerkUserId
          let caregiver = await Caregiver.findOne({ clerkUserId: auth.userId });
          if (caregiver) return caregiver;

          // 2) Fetch Clerk user to get email/name
          const clerkUser = await clerkClient.users.getUser(auth.userId);
          const primaryEmailId = clerkUser.primaryEmailAddressId;
          const emailAddress = (clerkUser.emailAddresses || []).find(
            (e) => e.id === primaryEmailId
          )?.emailAddress;

          if (!emailAddress) {
            throw new Error(
              "Clerk user has no email address; cannot link to caregiver"
            );
          }

          // 3) Try to link existing caregiver by email
          caregiver = await Caregiver.findOne({ email: emailAddress.toLowerCase() });
          if (caregiver) {
            if (!caregiver.clerkUserId) {
              caregiver.clerkUserId = auth.userId;
              await caregiver.save();
            }
            return caregiver;
          }

          // 4) Auto-provision a caregiver record for new Clerk users
          const firstName = clerkUser.firstName || "";
          const lastName = clerkUser.lastName || "";

          const role = roleFromClaims || "caregiver";
          caregiver = await Caregiver.create({
            firstName: firstName || "Clerk",
            lastName: lastName || "User",
            email: emailAddress.toLowerCase(),
            role,
            clerkUserId: auth.userId,
          });

          return caregiver;
        };

        // authMiddleware is not declared async; bridge with a promise.
        return ensureCaregiver()
          .then((caregiver) => {
            attachFromCaregiver(caregiver);
            next();
          })
          .catch((error) => {
            console.error("Clerk caregiver linking failed:", error);
            res.status(401).json({ message: "Unauthorized" });
          });
      }
    } catch (err) {
      // If Clerk isn't wired correctly, fall back to legacy JWT.
    }
  }

  // 2) Legacy JWT auth fallback (to avoid breaking existing frontend during migration).
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
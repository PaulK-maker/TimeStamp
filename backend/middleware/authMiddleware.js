const jwt = require("jsonwebtoken");
const Caregiver = require("../models/caregiver");

const DEV_BOOTSTRAP_ENABLED =
  process.env.ENABLE_DEV_BOOTSTRAP === "true" &&
  process.env.NODE_ENV !== "production";

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

const ALLOWED_ROLES = new Set(["admin", "caregiver", "superadmin"]);

function isAdminEmail(email) {
  if (!DEV_BOOTSTRAP_ENABLED) return false;
  const normalized = (email || "").trim().toLowerCase();
  return Boolean(normalized) && ADMIN_EMAILS.has(normalized);
}

function decodeJwtPayload(token) {
  try {
    const parts = (token || "").split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function getRoleFromClerkUser(clerkUser) {
  const raw = clerkUser?.publicMetadata?.role;

  if (typeof raw === "string") {
    const role = raw.trim().toLowerCase();
    return ALLOWED_ROLES.has(role) ? role : null;
  }

  // Allow a future-proof format like { roles: ["admin"] }
  const roles = clerkUser?.publicMetadata?.roles;
  if (Array.isArray(roles)) {
    const normalized = roles
      .filter((r) => typeof r === "string")
      .map((r) => r.trim().toLowerCase());
    // Priority: superadmin > admin > caregiver
    if (normalized.includes("superadmin")) return "superadmin";
    if (normalized.includes("admin")) return "admin";
    if (normalized.includes("caregiver")) return "caregiver";
  }

  return null;
}

module.exports = (req, res, next) => {
  // 1) Prefer Clerk auth when enabled.
  // clerkMiddleware() (in server.js) populates request auth state.
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const { getAuth, clerkClient } = require("@clerk/express");
      const auth = getAuth(req);

      if (auth && auth.userId) {
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
            tenantId: caregiver.tenantId ? caregiver.tenantId.toString() : null,
          };
        };

        const ensureCaregiver = async () => {
          // 1) Fast path by clerkUserId
          let caregiver = await Caregiver.findOne({ clerkUserId: auth.userId });
          if (caregiver) {
            // Safety: never automatically switch identities based on email.
            // If Clerk email doesn't match the linked record, log for manual cleanup.
            try {
              const clerkUser = await clerkClient.users.getUser(auth.userId);
              const primaryEmailId = clerkUser.primaryEmailAddressId;
              const emailAddress = (clerkUser.emailAddresses || []).find(
                (e) => e.id === primaryEmailId
              )?.emailAddress;

              const clerkEmail = normalizeEmail(emailAddress);
              const metadataRole = getRoleFromClerkUser(clerkUser);
              const desiredRole =
                metadataRole || (clerkEmail && isAdminEmail(clerkEmail) ? "admin" : null);

              // Option A (primary): Clerk publicMetadata.role is the source of truth.
              // Dev-only fallback (optional): allowlist can bootstrap admin if metadata isn't set.
              if (desiredRole && caregiver.role !== desiredRole) {
                caregiver.role = desiredRole;
                await caregiver.save();
              }

              if (clerkEmail && caregiver.email && caregiver.email !== clerkEmail) {
                const byEmail = await Caregiver.findOne({ email: clerkEmail });
                if (byEmail && byEmail._id.toString() !== caregiver._id.toString()) {
                  console.warn("Clerk linking collision detected (clerkUserId vs email). Using clerkUserId-linked record.", {
                    clerkUserId: auth.userId,
                    clerkEmail,
                    caregiverIdByClerkUserId: caregiver._id.toString(),
                    caregiverEmailByClerkUserId: caregiver.email,
                    caregiverIdByEmail: byEmail._id.toString(),
                    caregiverRoleByEmail: byEmail.role,
                  });
                } else {
                  console.warn("Clerk-linked caregiver email differs from Clerk email. Using clerkUserId-linked record.", {
                    clerkUserId: auth.userId,
                    clerkEmail,
                    caregiverId: caregiver._id.toString(),
                    caregiverEmail: caregiver.email,
                  });
                }
              }
            } catch (e) {
              // Non-fatal. If we can't fetch the Clerk user, we still trust clerkUserId linkage.
            }

            return caregiver;
          }

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

          const clerkEmail = normalizeEmail(emailAddress);
          const metadataRole = getRoleFromClerkUser(clerkUser);
          const desiredRole =
            metadataRole || (clerkEmail && isAdminEmail(clerkEmail) ? "admin" : null);

          // 3) Try to link existing caregiver by email
          caregiver = await Caregiver.findOne({ email: clerkEmail });
          if (caregiver) {
            // If it's already linked to a *different* Clerk user, do not switch/merge.
            if (caregiver.clerkUserId && caregiver.clerkUserId !== auth.userId) {
              console.warn("Clerk linking blocked: email is already linked to another clerkUserId.", {
                clerkUserId: auth.userId,
                clerkEmail,
                caregiverId: caregiver._id.toString(),
                existingClerkUserId: caregiver.clerkUserId,
              });
              throw new Error("Clerk email is already linked to a different account");
            }

            // Atomically claim the record if unlinked.
            if (!caregiver.clerkUserId) {
              const linked = await Caregiver.findOneAndUpdate(
                {
                  _id: caregiver._id,
                  $or: [{ clerkUserId: { $exists: false } }, { clerkUserId: null }],
                },
                {
                  $set: {
                    clerkUserId: auth.userId,
                    ...(desiredRole ? { role: desiredRole } : {}),
                  },
                },
                { new: true }
              );

              if (linked) return linked;

              // If we lost the race, re-read by clerkUserId.
              const byClerk = await Caregiver.findOne({ clerkUserId: auth.userId });
              if (byClerk) return byClerk;
            }

            // If already linked (or after linking), sync role from Clerk metadata.
            if (desiredRole && caregiver.role !== desiredRole) {
              caregiver.role = desiredRole;
              await caregiver.save();
            }

            return caregiver;
          }

          // 4) Auto-provision a caregiver record for new Clerk users
          const firstName = clerkUser.firstName || "";
          const lastName = clerkUser.lastName || "";

          // Option A: role is sourced from Clerk publicMetadata.role.
          // Default remains caregiver.
          const role = desiredRole || "caregiver";
          try {
            caregiver = await Caregiver.create({
              firstName: firstName || "Clerk",
              lastName: lastName || "User",
              email: clerkEmail,
              role,
              clerkUserId: auth.userId,
            });
          } catch (createErr) {
            // React StrictMode (dev) + concurrent requests can cause a race:
            // two requests try to provision the same user at once.
            // If we lose the race, re-fetch and continue instead of returning 401.
            if (createErr && createErr.code === 11000) {
              const byClerk = await Caregiver.findOne({ clerkUserId: auth.userId });
              if (byClerk) return byClerk;

              const byEmail = await Caregiver.findOne({ email: clerkEmail });
              if (byEmail) return byEmail;
            }

            throw createErr;
          }

          return caregiver;
        };

        // authMiddleware is not declared async; bridge with a promise.
        return ensureCaregiver()
          .then((caregiver) => {
            if (caregiver && caregiver.isActive === false) {
              return res.status(403).json({ message: "Account disabled" });
            }
            attachFromCaregiver(caregiver);
            next();
          })
          .catch((error) => {
            console.error("Clerk caregiver linking failed:", error);
            res.status(401).json({
              message: "Unauthorized",
              ...(process.env.NODE_ENV !== "production"
                ? { detail: error?.message || String(error) }
                : {}),
            });
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

  // Helpful guidance: if the frontend is sending a Clerk session token but the backend
  // isn't configured with CLERK_SECRET_KEY, JWT verification will always fail.
  if (!process.env.CLERK_SECRET_KEY) {
    const payload = decodeJwtPayload(token);
    const iss = payload && typeof payload.iss === "string" ? payload.iss : "";
    if (iss.toLowerCase().includes("clerk")) {
      return res.status(401).json({
        message:
          "Backend is not configured for Clerk. Set CLERK_SECRET_KEY in backend/.env and restart the server so /api/auth/me can validate Clerk session tokens.",
      });
    }
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // For legacy JWT sessions, load caregiver to attach tenantId and keep behavior consistent.
    return Caregiver.findById(decoded.id)
      .then((caregiver) => {
        req.user = {
          id: decoded.id,
          role: decoded.role,
          email: caregiver?.email || null,
          tenantId: caregiver?.tenantId ? caregiver.tenantId.toString() : null,
        };
        return next();
      })
      .catch(() => {
        req.user = { id: decoded.id, role: decoded.role, email: null, tenantId: null };
        return next();
      });
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
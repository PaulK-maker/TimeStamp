const jwt = require("jsonwebtoken");
const Staff = require("../models/staff");

const DEV_BOOTSTRAP_ENABLED =
  process.env.ENABLE_DEV_BOOTSTRAP === "true" &&
  process.env.NODE_ENV !== "production";

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

const ALLOWED_ROLES = new Set(["admin", "staff", "superadmin"]);

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

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim() || null;
}

function getClerkAuthorizedParties() {
  return (
    process.env.CLERK_AUTHORIZED_PARTIES ||
    process.env.ALLOWED_ORIGINS ||
    "http://localhost:3000,http://localhost:3001"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => /^https?:\/\//i.test(origin));
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
    // Priority: superadmin > admin > staff
    if (normalized.includes("superadmin")) return "superadmin";
    if (normalized.includes("admin")) return "admin";
    if (normalized.includes("staff")) return "staff";
  }

  return null;
}

module.exports = (req, res, next) => {
  const bearerToken = getBearerToken(req);
  const bearerPayload = decodeJwtPayload(bearerToken);
  const issuer =
    bearerPayload && typeof bearerPayload.iss === "string"
      ? bearerPayload.iss
      : "";
  const looksLikeClerkToken = issuer.toLowerCase().includes("clerk");

  // 1) Prefer Clerk auth when enabled.
  // clerkMiddleware() (in server.js) populates request auth state.
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const { getAuth, clerkClient } = require("@clerk/express");
      const { verifyToken } = require("@clerk/backend");
      const auth = getAuth(req);

      const resolveClerkAuth = async () => {
        if (auth && auth.userId) {
          return {
            userId: auth.userId,
            sessionId: auth.sessionId || null,
          };
        }

        if (!bearerToken || !looksLikeClerkToken) {
          return null;
        }

        const verified = await verifyToken(bearerToken, {
          secretKey: process.env.CLERK_SECRET_KEY,
          authorizedParties: getClerkAuthorizedParties(),
        });

        if (!verified || !verified.sub) {
          return null;
        }

        return {
          userId: verified.sub,
          sessionId: verified.sid || null,
        };
      };

      if ((auth && auth.userId) || looksLikeClerkToken) {
        // Map Clerk user to local staff so downstream code can use ObjectIds.
        // TimeEntry.staff expects a Staff ObjectId, not a Clerk string id.
        const attachFromStaff = (staffMember, clerkAuth) => {
          req.user = {
            id: staffMember._id.toString(),
            staffId: staffMember._id.toString(),
            role: staffMember.role,
            clerkUserId: clerkAuth.userId,
            sessionId: clerkAuth.sessionId,
            email: staffMember.email,
            tenantId: staffMember.tenantId ? staffMember.tenantId.toString() : null,
          };
        };

        const ensureStaff = async (clerkAuth) => {
          // 1) Fast path by clerkUserId
          let staffMember = await Staff.findOne({ clerkUserId: clerkAuth.userId });
          if (staffMember) {
            // Safety: never automatically switch identities based on email.
            // If Clerk email doesn't match the linked record, log for manual cleanup.
            try {
              const clerkUser = await clerkClient.users.getUser(clerkAuth.userId);
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
              if (desiredRole && staffMember.role !== desiredRole) {
                staffMember.role = desiredRole;
                await staffMember.save();
              }

              if (clerkEmail && staffMember.email && staffMember.email !== clerkEmail) {
                const byEmail = await Staff.findOne({ email: clerkEmail });
                if (byEmail && byEmail._id.toString() !== staffMember._id.toString()) {
                  console.warn("Clerk linking collision detected (clerkUserId vs email). Using clerkUserId-linked record.", {
                    clerkUserId: clerkAuth.userId,
                    clerkEmail,
                    staffIdByClerkUserId: staffMember._id.toString(),
                    staffEmailByClerkUserId: staffMember.email,
                    staffIdByEmail: byEmail._id.toString(),
                    staffRoleByEmail: byEmail.role,
                  });
                } else {
                  console.warn("Clerk-linked staff email differs from Clerk email. Using clerkUserId-linked record.", {
                    clerkUserId: clerkAuth.userId,
                    clerkEmail,
                    staffId: staffMember._id.toString(),
                    staffEmail: staffMember.email,
                  });
                }
              }
            } catch (e) {
              // Non-fatal. If we can't fetch the Clerk user, we still trust clerkUserId linkage.
            }

            return staffMember;
          }

          // 2) Fetch Clerk user to get email/name
          const clerkUser = await clerkClient.users.getUser(clerkAuth.userId);
          const primaryEmailId = clerkUser.primaryEmailAddressId;
          const emailAddress = (clerkUser.emailAddresses || []).find(
            (e) => e.id === primaryEmailId
          )?.emailAddress;

          if (!emailAddress) {
            throw new Error(
              "Clerk user has no email address; cannot link to staff"
            );
          }

          const clerkEmail = normalizeEmail(emailAddress);
          const metadataRole = getRoleFromClerkUser(clerkUser);
          const desiredRole =
            metadataRole || (clerkEmail && isAdminEmail(clerkEmail) ? "admin" : null);

          // 3) Try to link existing staff member by email
          staffMember = await Staff.findOne({ email: clerkEmail });
          if (staffMember) {
            // If it's already linked to a *different* Clerk user, do not switch/merge.
            if (staffMember.clerkUserId && staffMember.clerkUserId !== clerkAuth.userId) {
              console.warn("Clerk linking blocked: email is already linked to another clerkUserId.", {
                clerkUserId: clerkAuth.userId,
                clerkEmail,
                staffId: staffMember._id.toString(),
                existingClerkUserId: staffMember.clerkUserId,
              });
              throw new Error("Clerk email is already linked to a different account");
            }

            // Atomically claim the record if unlinked.
            if (!staffMember.clerkUserId) {
              const linked = await Staff.findOneAndUpdate(
                {
                  _id: staffMember._id,
                  $or: [{ clerkUserId: { $exists: false } }, { clerkUserId: null }],
                },
                {
                  $set: {
                    clerkUserId: clerkAuth.userId,
                    ...(desiredRole ? { role: desiredRole } : {}),
                  },
                },
                { new: true }
              );

              if (linked) return linked;

              // If we lost the race, re-read by clerkUserId.
              const byClerk = await Staff.findOne({ clerkUserId: clerkAuth.userId });
              if (byClerk) return byClerk;
            }

            // If already linked (or after linking), sync role from Clerk metadata.
            if (desiredRole && staffMember.role !== desiredRole) {
              staffMember.role = desiredRole;
              await staffMember.save();
            }

            return staffMember;
          }

          // 4) Auto-provision a staff record for new Clerk users
          const firstName = clerkUser.firstName || "";
          const lastName = clerkUser.lastName || "";

          // Option A: role is sourced from Clerk publicMetadata.role.
          // Default remains staff.
          const role = desiredRole || "staff";
          try {
            staffMember = await Staff.create({
              firstName: firstName || "Clerk",
              lastName: lastName || "User",
              email: clerkEmail,
              role,
              clerkUserId: clerkAuth.userId,
            });
          } catch (createErr) {
            // React StrictMode (dev) + concurrent requests can cause a race:
            // two requests try to provision the same user at once.
            // If we lose the race, re-fetch and continue instead of returning 401.
            if (createErr && createErr.code === 11000) {
              const byClerk = await Staff.findOne({ clerkUserId: clerkAuth.userId });
              if (byClerk) return byClerk;

              const byEmail = await Staff.findOne({ email: clerkEmail });
              if (byEmail) return byEmail;
            }

            throw createErr;
          }

          return staffMember;
        };

        // authMiddleware is not declared async; bridge with a promise.
        return resolveClerkAuth()
          .then((clerkAuth) => {
            if (!clerkAuth) {
              if (looksLikeClerkToken) {
                throw new Error("Clerk token did not resolve to an authenticated user");
              }
              return null;
            }

            return ensureStaff(clerkAuth).then((staffMember) => ({
              clerkAuth,
              staffMember,
            }));
          })
          .then((result) => {
            if (!result) return next();
            const { clerkAuth, staffMember } = result;
            if (staffMember && staffMember.isActive === false) {
              return res.status(403).json({ message: "Account disabled" });
            }
            attachFromStaff(staffMember, clerkAuth);
            next();
          })
          .catch((error) => {
            console.error("Clerk staff linking failed:", error);
            res.status(401).json({
              message: looksLikeClerkToken
                ? "Clerk token verification failed. Confirm the frontend publishable key and backend CLERK_SECRET_KEY belong to the same Clerk application, restart the backend after env changes, and ensure REACT_APP_API_BASE_URL points to this backend."
                : "Unauthorized",
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
  if (!req.headers.authorization) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = bearerToken;

  // Helpful guidance: if the frontend is sending a Clerk session token but the backend
  // isn't configured with CLERK_SECRET_KEY, JWT verification will always fail.
  if (!process.env.CLERK_SECRET_KEY) {
    if (looksLikeClerkToken) {
      return res.status(401).json({
        message:
          "Backend is not configured for Clerk. Set CLERK_SECRET_KEY in backend/.env and restart the server so /api/auth/me can validate Clerk session tokens.",
      });
    }
  }

  // If Clerk is configured but the request still reached legacy JWT fallback with a Clerk token,
  // return a targeted error instead of the generic legacy JWT message.
  if (process.env.CLERK_SECRET_KEY && looksLikeClerkToken) {
    return res.status(401).json({
      message:
        "Clerk token verification failed. Confirm the frontend publishable key and backend CLERK_SECRET_KEY belong to the same Clerk application, restart the backend after env changes, and ensure REACT_APP_API_BASE_URL points to this backend.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // For legacy JWT sessions, load staff to attach tenantId and keep behavior consistent.
    return Staff.findById(decoded.id)
      .then((staffMember) => {
        req.user = {
          id: decoded.id,
          role: decoded.role,
          staffId: decoded.id,
          email: staffMember?.email || null,
          tenantId: staffMember?.tenantId ? staffMember.tenantId.toString() : null,
        };
        return next();
      })
      .catch(() => {
        req.user = {
          id: decoded.id,
          staffId: decoded.id,
          role: decoded.role,
          email: null,
          tenantId: null,
        };
        return next();
      });
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
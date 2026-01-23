const TimeEntry = require("../models/TimeEntry");
const Caregiver = require("../models/caregiver");

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function isSameId(a, b) {
  return String(a || "") === String(b || "");
}

async function resolveCaregiver({ caregiverId, email }) {
  const normalizedEmail = normalizeEmail(email);

  if (caregiverId) {
    const byId = await Caregiver.findById(caregiverId);
    if (byId) return byId;
  }

  if (normalizedEmail) {
    const byEmail = await Caregiver.findOne({ email: normalizedEmail });
    if (byEmail) return byEmail;
  }

  return null;
}

async function ensureNotLastAdmin(caregiver) {
  if (!caregiver || caregiver.role !== "admin") return;
  const adminCount = await Caregiver.countDocuments({ role: "admin", isActive: true });
  if (adminCount <= 1) {
    const err = new Error("Cannot remove the last active admin");
    err.statusCode = 400;
    throw err;
  }
}

/**
 * GET /api/admin/timelogs
 * Admin-only: Get all time entries
 * Optional query params:
 *   caregiverId - filter by caregiver
 *   startDate / endDate - filter by date range
 */
exports.getAllTimeLogs = async (req, res) => {
  try {
    const { caregiverId, startDate, endDate } = req.query;

    let query = {};

    if (caregiverId) {
      query.caregiver = caregiverId;
    }

    if (startDate || endDate) {
      query.clockIn = {};
      if (startDate) query.clockIn.$gte = new Date(startDate);
      if (endDate) query.clockIn.$lte = new Date(endDate);
    }

    const logs = await TimeEntry.find(query)
      .populate("caregiver", "firstName lastName email role")
      .sort({ clockIn: -1 });

    res.json({ count: logs.length, logs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/admin/promote
 * Admin-only: Promote an existing caregiver to admin by email.
 * Body: { email: string }
 */
exports.promoteCaregiverToAdmin = async (req, res) => {
  try {
    const caregiverId = (req.body?.caregiverId || "").trim();
    const email = normalizeEmail(req.body?.email);

    if (!caregiverId && !email) {
      return res.status(400).json({ message: "caregiverId or email is required" });
    }

    const caregiver = await resolveCaregiver({ caregiverId, email });
    if (!caregiver) {
      return res.status(404).json({ message: "Caregiver not found" });
    }

    if (!caregiver.isActive) {
      return res.status(400).json({ message: "Cannot promote an inactive user" });
    }

    // Option A: Clerk publicMetadata.role is the source of truth.
    // If this caregiver is linked to Clerk, update Clerk metadata too.
    if (process.env.CLERK_SECRET_KEY && caregiver.clerkUserId) {
      try {
        const { clerkClient } = require("@clerk/express");
        await clerkClient.users.updateUserMetadata(caregiver.clerkUserId, {
          publicMetadata: { role: "admin" },
        });
      } catch (e) {
        console.warn("Failed to update Clerk user metadata for promotion", {
          clerkUserId: caregiver.clerkUserId,
          email: caregiver.email,
          error: e?.message || String(e),
        });
      }
    }

    if (caregiver.role !== "admin") {
      caregiver.role = "admin";
      await caregiver.save();
    }

    return res.json({
      message: "Caregiver promoted to admin",
      caregiver: {
        id: caregiver._id.toString(),
        email: caregiver.email,
        role: caregiver.role,
        isActive: caregiver.isActive,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/admin/demote
 * Admin-only: Demote an existing admin back to caregiver.
 * Body: { caregiverId?: string, email?: string }
 */
exports.demoteAdminToCaregiver = async (req, res) => {
  try {
    const caregiverId = (req.body?.caregiverId || "").trim();
    const email = normalizeEmail(req.body?.email);

    if (!caregiverId && !email) {
      return res.status(400).json({ message: "caregiverId or email is required" });
    }

    const caregiver = await resolveCaregiver({ caregiverId, email });
    if (!caregiver) {
      return res.status(404).json({ message: "Caregiver not found" });
    }

    // Prevent self-demotion (lockout protection)
    if (isSameId(caregiver._id, req.user?.caregiverId || req.user?.id)) {
      return res.status(400).json({ message: "You cannot demote your own account" });
    }

    if (!caregiver.isActive) {
      return res.status(400).json({ message: "Cannot demote an inactive user" });
    }

    if (caregiver.role !== "admin") {
      return res.status(400).json({ message: "User is not an admin" });
    }

    await ensureNotLastAdmin(caregiver);

    if (process.env.CLERK_SECRET_KEY && caregiver.clerkUserId) {
      try {
        const { clerkClient } = require("@clerk/express");
        await clerkClient.users.updateUserMetadata(caregiver.clerkUserId, {
          publicMetadata: { role: "caregiver" },
        });
      } catch (e) {
        console.warn("Failed to update Clerk user metadata for demotion", {
          clerkUserId: caregiver.clerkUserId,
          email: caregiver.email,
          error: e?.message || String(e),
        });
      }
    }

    if (caregiver.role !== "caregiver") {
      caregiver.role = "caregiver";
      await caregiver.save();
    }

    return res.json({
      message: "Admin demoted to caregiver",
      caregiver: {
        id: caregiver._id.toString(),
        email: caregiver.email,
        role: caregiver.role,
        isActive: caregiver.isActive,
      },
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error(error);
    res.status(status).json({ message: error?.message || "Server error" });
  }
};

/**
 * DELETE /api/admin/users/:caregiverId
 * Admin-only: Deprovision a user.
 * - Deletes the user in Clerk (if linked).
 * - Marks local Caregiver record as inactive (keeps TimeEntry history intact).
 */
exports.deleteUser = async (req, res) => {
  try {
    const caregiverId = (req.params?.caregiverId || "").trim();
    if (!caregiverId) {
      return res.status(400).json({ message: "caregiverId is required" });
    }

    const caregiver = await Caregiver.findById(caregiverId);
    if (!caregiver) {
      return res.status(404).json({ message: "Caregiver not found" });
    }

    // Prevent self-delete (lockout protection)
    if (isSameId(caregiver._id, req.user?.caregiverId || req.user?.id)) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    // If deleting an active admin, ensure at least one active admin remains.
    if (caregiver.isActive) {
      await ensureNotLastAdmin(caregiver);
    }

    // 1) Delete from Clerk (source of login)
    if (process.env.CLERK_SECRET_KEY && caregiver.clerkUserId) {
      try {
        const { clerkClient } = require("@clerk/express");
        await clerkClient.users.deleteUser(caregiver.clerkUserId);
      } catch (e) {
        // If the Clerk user is already gone, continue. Otherwise, fail fast.
        const message = e?.message || String(e);
        const status = e?.status || e?.statusCode;
        const isNotFound = status === 404 || /not\s*found/i.test(message);
        if (!isNotFound) {
          return res.status(502).json({
            message: "Failed to delete user from Clerk",
            detail: process.env.NODE_ENV !== "production" ? message : undefined,
          });
        }
      }
    }

    // 2) Soft-delete locally to preserve time logs
    caregiver.isActive = false;
    caregiver.role = "caregiver";
    await caregiver.save();

    return res.json({
      message: "User deleted",
      caregiver: {
        id: caregiver._id.toString(),
        email: caregiver.email,
        role: caregiver.role,
        isActive: caregiver.isActive,
      },
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error(error);
    res.status(status).json({ message: error?.message || "Server error" });
  }
};

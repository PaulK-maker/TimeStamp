const crypto = require("crypto");
const mongoose = require("mongoose");
const Tenant = require("../models/Tenant");
const Caregiver = require("../models/caregiver");
const TenantOtp = require("../models/TenantOtp");
const { isMailerConfigured, sendMail } = require("../utils/mailer");

function normalizeEmail(email) {
  return (email || "").toString().trim().toLowerCase();
}

function normalizeDigits(value) {
  return (value || "").toString().replace(/\D/g, "");
}

function getOtpSecret() {
  const fromEnv = (process.env.OTP_SECRET || "").trim();
  if (fromEnv) return fromEnv;

  // Fallback for dev/test convenience.
  if (process.env.NODE_ENV !== "production") {
    return (process.env.JWT_SECRET || "dev-otp-secret").toString();
  }

  // Production should explicitly set OTP_SECRET.
  return (process.env.JWT_SECRET || "").toString();
}

function computeCodeHash({ purpose, email, tenantId, code }) {
  const secret = getOtpSecret();
  const tenantPart = tenantId ? String(tenantId) : "";
  const payload = `${purpose}|${normalizeEmail(email)}|${tenantPart}|${normalizeDigits(code)}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function timingSafeEqualHex(a, b) {
  try {
    const aa = Buffer.from(String(a || ""), "hex");
    const bb = Buffer.from(String(b || ""), "hex");
    if (aa.length !== bb.length) return false;
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

function generateSixDigitCode() {
  // crypto.randomInt is available in modern Node.
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

async function loadCurrentCaregiver(req) {
  const id = req.user?.id;
  if (id && mongoose.Types.ObjectId.isValid(id)) {
    return Caregiver.findById(id);
  }

  const clerkUserId = req.user?.clerkUserId;
  if (clerkUserId) {
    return Caregiver.findOne({ clerkUserId });
  }

  return null;
}

function serializeTenant(tenant) {
  if (!tenant) return null;
  return {
    id: tenant._id.toString(),
    name: tenant.name,
    tenantCode: tenant.tenantCode || null,
    planSelected: Boolean(tenant.planSelected),
    planId: tenant.planId || null,
  };
}

function createOtpEmailText({ code, purpose, tenantName }) {
  if (purpose === "TENANT_BOOTSTRAP_CONFIRM") {
    return (
      `Your TimeStamp setup code: ${code}\n\n` +
      `Enter this one-time code to create your facility.\n` +
      `This code expires in 10 minutes.\n`
    );
  }

  const safeName = tenantName || "your facility";
  return (
    `Your TimeStamp invite code: ${code}\n\n` +
    `Enter this one-time code to join ${safeName}.\n` +
    `This code expires in 10 minutes.\n`
  );
}

async function enforceSendThrottle({ purpose, email, tenantId }) {
  const now = new Date();
  const normalized = normalizeEmail(email);

  const last = await TenantOtp.findOne({
    purpose,
    email: normalized,
    tenantId: tenantId || null,
    consumedAt: null,
    expiresAt: { $gt: now },
  })
    .sort({ createdAt: -1 })
    .select("lastSentAt sendCount sendWindowStartAt lockedUntil");

  if (!last) return null;

  if (last.lockedUntil && last.lockedUntil > now) {
    return {
      status: 429,
      message: "Too many attempts. Please wait and try again.",
      code: "OTP_RATE_LIMITED",
    };
  }

  const lastSentAt = last.lastSentAt ? new Date(last.lastSentAt) : null;
  if (lastSentAt && now - lastSentAt < 60 * 1000) {
    return {
      status: 429,
      message: "Please wait a moment before requesting another code.",
      code: "OTP_TOO_FREQUENT",
    };
  }

  // Simple rolling window: 15 minutes max 5 sends.
  const windowStart = last.sendWindowStartAt ? new Date(last.sendWindowStartAt) : now;
  const withinWindow = now - windowStart < 15 * 60 * 1000;
  if (withinWindow && Number(last.sendCount || 0) >= 5) {
    return {
      status: 429,
      message: "Too many codes requested. Please wait and try again.",
      code: "OTP_RATE_LIMITED",
    };
  }

  return last;
}

async function createFreshOtp({ purpose, email, tenantId, createdByCaregiverId }) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const code = generateSixDigitCode();
  const codeHash = computeCodeHash({ purpose, email, tenantId, code });

  // Invalidate any previous active OTPs for this (purpose,email,tenant)
  await TenantOtp.updateMany(
    {
      purpose,
      email: normalizeEmail(email),
      tenantId: tenantId || null,
      consumedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { expiresAt: now } }
  );

  const otp = await TenantOtp.create({
    purpose,
    email: normalizeEmail(email),
    tenantId: tenantId || null,
    codeHash,
    expiresAt,
    consumedAt: null,
    sendCount: 1,
    sendWindowStartAt: now,
    lastSentAt: now,
    verifyAttempts: 0,
    lockedUntil: null,
    createdByCaregiverId: createdByCaregiverId || null,
  });

  return { otp, code, expiresAt };
}

// POST /api/tenant/otp/send-join
// Admin-only: sends (or returns) a one-time code to join the admin's tenant.
exports.sendJoinOtp = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        message: "Tenant is not assigned for this account.",
        code: "TENANT_REQUIRED",
      });
    }

    const toEmail = normalizeEmail(req.body?.toEmail);
    if (!toEmail || !toEmail.includes("@")) {
      return res.status(400).json({ message: "A valid toEmail is required" });
    }

    const tenant = await Tenant.findById(tenantId).select("name");
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const throttle = await enforceSendThrottle({
      purpose: "TENANT_JOIN_INVITE",
      email: toEmail,
      tenantId,
    });
    if (throttle && throttle.status) {
      return res.status(throttle.status).json({ message: throttle.message, code: throttle.code });
    }

    const caregiver = await loadCurrentCaregiver(req);
    const { code, expiresAt } = await createFreshOtp({
      purpose: "TENANT_JOIN_INVITE",
      email: toEmail,
      tenantId,
      createdByCaregiverId: caregiver?._id,
    });

    const subject = `Your TimeStamp invite code`;
    const text = createOtpEmailText({ code, purpose: "TENANT_JOIN_INVITE", tenantName: tenant.name });

    if (isMailerConfigured()) {
      await sendMail({ to: toEmail, subject, text });
      return res.json({ message: "Invite code sent", toEmail, expiresAt });
    }

    // Copy-code fallback for non-technical setups when SMTP isn't configured.
    return res.json({
      message: "Email is not configured on the server. Copy this code and share it with the user.",
      code: "MAIL_NOT_CONFIGURED",
      toEmail,
      inviteCode: code,
      expiresAt,
    });
  } catch (err) {
    console.error("sendJoinOtp failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/tenant/otp/redeem-join
// Signed-in user: redeem a one-time invite code to join a tenant.
exports.redeemJoinOtp = async (req, res) => {
  try {
    const caregiver = await loadCurrentCaregiver(req);
    if (!caregiver) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (caregiver.tenantId) {
      return res.status(400).json({
        message: "Tenant is already assigned for this account.",
        code: "TENANT_ALREADY_ASSIGNED",
      });
    }

    const email = normalizeEmail(req.user?.email || caregiver.email);
    if (!email) {
      return res.status(400).json({
        message: "Email is required for invite redemption.",
        code: "EMAIL_REQUIRED",
      });
    }

    const code = normalizeDigits(req.body?.code);
    if (!code || code.length !== 6) {
      return res.status(400).json({ message: "A 6-digit code is required" });
    }

    const now = new Date();

    const otp = await TenantOtp.findOne({
      purpose: "TENANT_JOIN_INVITE",
      email,
      consumedAt: null,
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .select("+codeHash tenantId verifyAttempts lockedUntil expiresAt");

    if (!otp || !otp.tenantId) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    if (otp.lockedUntil && otp.lockedUntil > now) {
      return res.status(429).json({ message: "Too many attempts. Please wait and try again.", code: "OTP_RATE_LIMITED" });
    }

    const expected = otp.codeHash;
    const actual = computeCodeHash({ purpose: otp.purpose, email, tenantId: otp.tenantId, code });
    const matches = timingSafeEqualHex(expected, actual);

    if (!matches) {
      const nextAttempts = Number(otp.verifyAttempts || 0) + 1;
      const update = { $set: { verifyAttempts: nextAttempts } };
      if (nextAttempts >= 6) {
        update.$set.lockedUntil = new Date(now.getTime() + 10 * 60 * 1000);
      }
      await TenantOtp.updateOne({ _id: otp._id }, update);
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Assign tenantId (one-time; prevents switching)
    const updated = await Caregiver.findOneAndUpdate(
      {
        _id: caregiver._id,
        $or: [{ tenantId: { $exists: false } }, { tenantId: null }],
      },
      { $set: { tenantId: otp.tenantId } },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        message: "Tenant assignment race: account is no longer unassigned",
        code: "TENANT_ALREADY_ASSIGNED",
      });
    }

    await TenantOtp.updateOne({ _id: otp._id, consumedAt: null }, { $set: { consumedAt: now } });

    const tenant = await Tenant.findById(otp.tenantId).select("name tenantCode planSelected planId");

    return res.json({
      message: "Joined facility",
      tenant: serializeTenant(tenant),
    });
  } catch (err) {
    console.error("redeemJoinOtp failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/tenant/otp/send-bootstrap
// Admin-only: send (or return) a one-time code to confirm facility creation.
exports.sendBootstrapOtp = async (req, res) => {
  try {
    const caregiver = await loadCurrentCaregiver(req);
    if (!caregiver) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (caregiver.tenantId) {
      return res.status(400).json({
        message: "Tenant already assigned",
        code: "TENANT_ALREADY_ASSIGNED",
      });
    }

    const toEmail = normalizeEmail(req.user?.email || caregiver.email);
    if (!toEmail || !toEmail.includes("@")) {
      return res.status(400).json({ message: "A valid email is required for setup" });
    }

    const throttle = await enforceSendThrottle({
      purpose: "TENANT_BOOTSTRAP_CONFIRM",
      email: toEmail,
      tenantId: null,
    });
    if (throttle && throttle.status) {
      return res.status(throttle.status).json({ message: throttle.message, code: throttle.code });
    }

    const { code, expiresAt } = await createFreshOtp({
      purpose: "TENANT_BOOTSTRAP_CONFIRM",
      email: toEmail,
      tenantId: null,
      createdByCaregiverId: caregiver._id,
    });

    const subject = `Your TimeStamp setup code`;
    const text = createOtpEmailText({ code, purpose: "TENANT_BOOTSTRAP_CONFIRM" });

    if (isMailerConfigured()) {
      await sendMail({ to: toEmail, subject, text });
      return res.json({ message: "Setup code sent", toEmail, expiresAt });
    }

    return res.json({
      message: "Email is not configured on the server. Copy this code and use it to continue setup.",
      code: "MAIL_NOT_CONFIGURED",
      toEmail,
      setupCode: code,
      expiresAt,
    });
  } catch (err) {
    console.error("sendBootstrapOtp failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/tenant/otp/verify-bootstrap
// Admin-only: verify code, then create tenant and bind the admin.
exports.verifyBootstrapOtp = async (req, res) => {
  try {
    const caregiver = await loadCurrentCaregiver(req);
    if (!caregiver) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (caregiver.tenantId) {
      return res.status(400).json({
        message: "Tenant already assigned",
        code: "TENANT_ALREADY_ASSIGNED",
      });
    }

    const email = normalizeEmail(req.user?.email || caregiver.email);
    if (!email) {
      return res.status(400).json({ message: "Email is required for setup", code: "EMAIL_REQUIRED" });
    }

    const code = normalizeDigits(req.body?.code);
    if (!code || code.length !== 6) {
      return res.status(400).json({ message: "A 6-digit code is required" });
    }

    const now = new Date();

    const otp = await TenantOtp.findOne({
      purpose: "TENANT_BOOTSTRAP_CONFIRM",
      email,
      tenantId: null,
      consumedAt: null,
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .select("+codeHash verifyAttempts lockedUntil");

    if (!otp) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    if (otp.lockedUntil && otp.lockedUntil > now) {
      return res.status(429).json({ message: "Too many attempts. Please wait and try again.", code: "OTP_RATE_LIMITED" });
    }

    const actual = computeCodeHash({ purpose: otp.purpose, email, tenantId: null, code });
    const matches = timingSafeEqualHex(otp.codeHash, actual);

    if (!matches) {
      const nextAttempts = Number(otp.verifyAttempts || 0) + 1;
      const update = { $set: { verifyAttempts: nextAttempts } };
      if (nextAttempts >= 6) {
        update.$set.lockedUntil = new Date(now.getTime() + 10 * 60 * 1000);
      }
      await TenantOtp.updateOne({ _id: otp._id }, update);
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    const desiredName = (req.body?.name || "").toString().trim();
    const tenantName = desiredName || "My Facility";

    const tenant = await Tenant.create({
      name: tenantName,
      planSelected: false,
    });

    const bound = await Caregiver.findOneAndUpdate(
      {
        _id: caregiver._id,
        $or: [{ tenantId: { $exists: false } }, { tenantId: null }],
      },
      { $set: { tenantId: tenant._id } },
      { new: true }
    );

    if (!bound) {
      return res.status(409).json({
        message: "Tenant assignment race: caregiver is no longer unassigned",
        code: "TENANT_ALREADY_ASSIGNED",
        tenant: serializeTenant(tenant),
      });
    }

    await TenantOtp.updateOne({ _id: otp._id, consumedAt: null }, { $set: { consumedAt: now } });

    return res.status(201).json({
      message: "Tenant created and assigned",
      tenant: serializeTenant(tenant),
    });
  } catch (err) {
    console.error("verifyBootstrapOtp failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

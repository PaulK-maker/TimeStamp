const nodemailer = require("nodemailer");

function normalizeEmailList(value) {
  return (value || "")
    .toString()
    .split(/[,;\n]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function getMailConfig() {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const from = process.env.MAIL_FROM || user || null;

  const port = portRaw ? Number(portRaw) : 587;
  const secure = (process.env.SMTP_SECURE || "").toLowerCase() === "true";

  return {
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : null,
    from,
  };
}

function isMailerConfigured() {
  const cfg = getMailConfig();
  return Boolean(cfg.host && cfg.from);
}

function createTransport() {
  const cfg = getMailConfig();

  if (!cfg.host) {
    const err = new Error("SMTP is not configured (missing SMTP_HOST)");
    err.code = "MAIL_NOT_CONFIGURED";
    throw err;
  }

  const transportOptions = {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
  };

  if (cfg.auth) {
    transportOptions.auth = cfg.auth;
  }

  return nodemailer.createTransport(transportOptions);
}

async function sendMail({ to, subject, text, html }) {
  const cfg = getMailConfig();
  if (!cfg.from) {
    const err = new Error("MAIL_FROM is not configured");
    err.code = "MAIL_NOT_CONFIGURED";
    throw err;
  }

  const transport = createTransport();

  return transport.sendMail({
    from: cfg.from,
    to,
    subject,
    text,
    html,
  });
}

function getFacilitySignupNotificationRecipients() {
  const explicitRecipients = normalizeEmailList(
    process.env.FACILITY_SIGNUP_NOTIFICATION_EMAILS
  );

  if (explicitRecipients.length) {
    return [...new Set(explicitRecipients)];
  }

  return [
    ...new Set([
      ...normalizeEmailList(process.env.SUPERADMIN_EMAIL),
      ...normalizeEmailList(process.env.DEDICATED_NOTIFICATION_EMAIL),
      "pkaranjaxn@gmail.com",
      "hubtulivu@gmail.com",
    ]),
  ];
}

async function sendFacilitySignupNotification({ tenant, createdBy, source }) {
  const recipients = getFacilitySignupNotificationRecipients();
  if (!recipients.length) {
    return { sent: false, reason: "no-recipients" };
  }

  const tenantName = tenant?.name || "Unnamed facility";
  const tenantId = tenant?._id ? tenant._id.toString() : "unknown";
  const tenantCode = tenant?.tenantCode || "n/a";
  const createdByEmail = createdBy?.email || "unknown";
  const createdByName = [createdBy?.firstName, createdBy?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const subject = `[TimeStamp] New facility signup: ${tenantName}`;
  const text = [
    "A new facility has signed up in TimeStamp.",
    `Facility: ${tenantName}`,
    `Tenant ID: ${tenantId}`,
    `Tenant Code: ${tenantCode}`,
    `Created by: ${createdByName || createdByEmail}`,
    `Creator email: ${createdByEmail}`,
    `Source: ${source || "unknown"}`,
  ].join("\n");

  const html = `
    <p>A new facility has signed up in TimeStamp.</p>
    <ul>
      <li><strong>Facility:</strong> ${tenantName}</li>
      <li><strong>Tenant ID:</strong> ${tenantId}</li>
      <li><strong>Tenant Code:</strong> ${tenantCode}</li>
      <li><strong>Created by:</strong> ${createdByName || createdByEmail}</li>
      <li><strong>Creator email:</strong> ${createdByEmail}</li>
      <li><strong>Source:</strong> ${source || "unknown"}</li>
    </ul>
  `;

  await sendMail({
    to: recipients.join(","),
    subject,
    text,
    html,
  });

  return { sent: true, recipients };
}

module.exports = {
  getMailConfig,
  isMailerConfigured,
  getFacilitySignupNotificationRecipients,
  sendMail,
  sendFacilitySignupNotification,
};

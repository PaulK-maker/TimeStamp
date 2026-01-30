const nodemailer = require("nodemailer");

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

module.exports = {
  getMailConfig,
  isMailerConfigured,
  sendMail,
};

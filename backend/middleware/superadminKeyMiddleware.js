function requireSuperadminKey(req, res, next) {
  const expected = (process.env.SUPERADMIN_ACCESS_KEY || "").toString();
  const provided = (req.headers["x-superadmin-key"] || "").toString();

  // Fail closed: if no key configured, nobody gets in.
  if (!expected) {
    return res.status(401).json({
      message: "Superadmin key is required.",
      code: "SUPERADMIN_KEY_REQUIRED",
    });
  }

  if (!provided || provided !== expected) {
    return res.status(401).json({
      message: "Superadmin key is required.",
      code: "SUPERADMIN_KEY_REQUIRED",
    });
  }

  return next();
}

module.exports = {
  requireSuperadminKey,
};

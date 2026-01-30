const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!req.user.role) {
      return res.status(403).json({
        message: "Access denied: role not set",
      });
    }

    const userRole = req.user.role;
    const allowed = roles.includes(userRole);
    if (!allowed) {
      return res.status(403).json({
        message: "Access denied: insufficient permissions",
      });
    }

    next();
  };
};

module.exports = authorizeRoles;
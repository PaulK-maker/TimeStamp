// Gates payroll actions that create or submit a run (irreversible once sent
// to Gusto) beyond the base "admin" role check. Any admin can still view
// payroll runs/webhook events — this only applies to routes that mutate or
// submit. See project-guide/payroll-production-roadmap.md for the reasoning.
const requirePayrollRunAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (!req.user.payrollRunAccess) {
    return res.status(403).json({
      message: "Access denied: this admin account does not have payroll run/submit access.",
      code: "PAYROLL_RUN_ACCESS_REQUIRED",
    });
  }

  next();
};

module.exports = requirePayrollRunAccess;

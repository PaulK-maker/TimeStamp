const express = require("express");

const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const {
  requirePlanSelected,
  requireFeature,
} = require("../middleware/tenantPlanMiddleware");
const {
  listJobs,
  listMyJobs,
  createJob,
  updateJob,
} = require("../controllers/jobController");

const router = express.Router();

router.use(auth, requirePlanSelected());

router.get("/mine", listMyJobs);
router.get("/", listJobs);
router.post("/", authorizeRoles("admin"), requireFeature("dataManagement"), createJob);
router.put(
  "/:jobId",
  authorizeRoles("admin"),
  requireFeature("dataManagement"),
  updateJob
);

module.exports = router;
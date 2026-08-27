const express = require("express");

const router = express.Router();
const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const {
  listTraining,
  createTraining,
  updateTraining,
  deleteTraining,
} = require("../controllers/trainingController");

router.get("/", auth, authorizeRoles("admin", "staff"), listTraining);
router.post("/", auth, authorizeRoles("admin"), createTraining);
router.patch("/:id", auth, authorizeRoles("admin"), updateTraining);
router.delete("/:id", auth, authorizeRoles("admin"), deleteTraining);

module.exports = router;

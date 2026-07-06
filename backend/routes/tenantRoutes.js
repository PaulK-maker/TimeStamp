const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");

const {
  bootstrapTenant,
} = require("../controllers/tenantController");

// Any authenticated user with no tenant may create one (they become admin on creation).
router.post("/bootstrap", auth, bootstrapTenant);

module.exports = router;

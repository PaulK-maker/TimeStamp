const mongoose = require("mongoose");

// Singleton document (one per provider) that holds the live Gusto OAuth
// access/refresh token pair so the running server can refresh them itself
// instead of relying on a locally-run script writing to .env.
const gustoTokenSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, unique: true, default: "gusto" },
    companyId: { type: String, default: null },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    accessTokenExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GustoToken", gustoTokenSchema);

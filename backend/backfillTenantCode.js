const path = require("path");

// Always load env from backend/.env, regardless of the process working directory.
require("dotenv").config({ path: path.join(__dirname, ".env") });

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Tenant = require("./models/Tenant");

function normalizeTenantCode(value) {
  return (value || "")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

async function resolveTenantScope() {
  const isProd = (process.env.NODE_ENV || "").toLowerCase() === "production";

  const forcedTenantId = (process.env.TENANT_ID || "").trim();
  const forcedTenantCode = normalizeTenantCode(process.env.TENANT_CODE);

  const allowAllTenants = (process.env.ALLOW_ALL_TENANTS || "").toLowerCase() === "true";
  const confirm = (process.env.CONFIRM || "").trim().toUpperCase();

  if (forcedTenantId) return { type: "id", value: forcedTenantId };
  if (forcedTenantCode) return { type: "code", value: forcedTenantCode };

  if (allowAllTenants) {
    if (isProd && confirm !== "YES") {
      throw new Error(
        "In production, ALLOW_ALL_TENANTS=true requires CONFIRM=YES to run."
      );
    }
    return { type: "all", value: null };
  }

  if (isProd) {
    throw new Error(
      "In production you must set TENANT_ID or set ALLOW_ALL_TENANTS=true (with CONFIRM=YES)."
    );
  }

  // Non-prod convenience: if there is exactly one tenant, allow it.
  const count = await Tenant.countDocuments({});
  if (count === 1) return { type: "all", value: null };

  throw new Error(
    `Multiple tenants exist (${count}). Set TENANT_ID (recommended) or ALLOW_ALL_TENANTS=true to backfill codes.`
  );
}

(async () => {
  try {
    await connectDB();

    const dryRun = (process.env.DRY_RUN || "true").toLowerCase() === "true";
    const force = (process.env.FORCE || "").toLowerCase() === "true";

    const scope = await resolveTenantScope();

    let baseQuery = {};
    if (scope.type === "id") baseQuery._id = scope.value;
    if (scope.type === "code") baseQuery.tenantCode = scope.value;

    const missingOrEmpty = {
      $or: [{ tenantCode: { $exists: false } }, { tenantCode: null }, { tenantCode: "" }],
    };

    const query = force ? baseQuery : { ...baseQuery, ...missingOrEmpty };

    const tenants = await Tenant.find(query);

    console.log("Dry run:", dryRun);
    console.log("Force overwrite:", force);
    console.log("Scope:", scope.type, scope.value || "(all)");
    console.log("Tenants matched:", tenants.length);

    let updated = 0;
    let skipped = 0;

    for (const tenant of tenants) {
      const before = tenant.tenantCode || null;

      if (!force && before) {
        skipped += 1;
        continue;
      }

      if (force) {
        // Clear first so the model hook re-generates.
        tenant.tenantCode = null;
      }

      // Trigger model hook to generate a code.
      await tenant.validate();

      const after = tenant.tenantCode || null;
      if (!after) {
        console.warn("Skipping tenant with no generated code:", tenant._id.toString());
        skipped += 1;
        continue;
      }

      if (dryRun) {
        console.log(
          "DRY_RUN would set tenantCode:",
          tenant._id.toString(),
          tenant.name,
          before,
          "->",
          after
        );
        updated += 1;
        continue;
      }

      let attempts = 0;
      while (attempts < 5) {
        try {
          await tenant.save();
          updated += 1;
          console.log(
            "Set tenantCode:",
            tenant._id.toString(),
            tenant.name,
            before,
            "->",
            tenant.tenantCode
          );
          break;
        } catch (err) {
          // Duplicate key -> regenerate by clearing and validating again.
          if (err && err.code === 11000) {
            attempts += 1;
            tenant.tenantCode = null;
            await tenant.validate();
            continue;
          }
          throw err;
        }
      }
    }

    console.log("Updated:", updated);
    console.log("Skipped:", skipped);

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("backfillTenantCode failed:", err?.message || err);
    try {
      await mongoose.connection.close();
    } catch {
      // ignore
    }
    process.exit(1);
  }
})();

const path = require("path");

// Always load env from backend/.env, regardless of the process working directory.
require("dotenv").config({ path: path.join(__dirname, ".env") });

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Tenant = require("./models/Tenant");
const Caregiver = require("./models/caregiver");
const TimeEntry = require("./models/TimeEntry");
const MissedPunchRequest = require("./models/MissedPunchRequest");
const TimeEntryCorrection = require("./models/TimeEntryCorrection");

function normalizeTenantCode(value) {
  return (value || "")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

async function resolveOrCreateTenant() {
  const forcedTenantId = (process.env.TENANT_ID || "").trim();
  const forcedTenantCode = normalizeTenantCode(process.env.TENANT_CODE);
  const desiredName = (process.env.TENANT_NAME || "Default Facility").trim();
  const isProd = (process.env.NODE_ENV || "").toLowerCase() === "production";

  if (forcedTenantId) {
    const existing = await Tenant.findById(forcedTenantId);
    if (!existing) {
      throw new Error(`TENANT_ID ${forcedTenantId} not found`);
    }
    return existing;
  }

  if (forcedTenantCode) {
    const existing = await Tenant.findOne({ tenantCode: forcedTenantCode });
    if (!existing) {
      throw new Error(`TENANT_CODE ${forcedTenantCode} not found`);
    }
    return existing;
  }

  if (isProd) {
    throw new Error(
      "In production you must set TENANT_ID or TENANT_CODE explicitly before running this script (to avoid accidental tenant selection)."
    );
  }

  let tenant = await Tenant.findOne({ name: desiredName });
  if (!tenant) {
    const count = await Tenant.countDocuments({});
    if (count > 1) {
      throw new Error(
        `Multiple tenants exist (${count}). Set TENANT_ID explicitly to choose which tenant to backfill.`
      );
    }
    tenant = await Tenant.findOne();
  }

  if (!tenant) {
    tenant = await Tenant.create({ name: desiredName, planSelected: false });
  }

  return tenant;
}

(async () => {
  try {
    await connectDB();

    const tenant = await resolveOrCreateTenant();

    // Ensure a human-friendly code exists for this tenant going forward.
    if (!tenant.tenantCode) {
      await tenant.save();
    }

    const result = await Caregiver.updateMany(
      { $or: [{ tenantId: { $exists: false } }, { tenantId: null }] },
      { $set: { tenantId: tenant._id } }
    );

    console.log("Tenant assigned:", tenant._id.toString(), tenant.name);
    console.log("Caregivers matched:", result.matchedCount ?? result.n);
    console.log("Caregivers modified:", result.modifiedCount ?? result.nModified);

    // Hard-scope existing records by copying tenantId from caregiver
    const caregiverTenantPairs = await Caregiver.find({ tenantId: { $ne: null } })
      .select("_id tenantId")
      .lean();
    const caregiverToTenant = new Map(
      caregiverTenantPairs.map((c) => [String(c._id), String(c.tenantId)])
    );

    async function backfillCollection(model, { caregiverField, label }) {
      const cursor = model
        .find({ $or: [{ tenantId: { $exists: false } }, { tenantId: null }] })
        .select("_id tenantId " + caregiverField)
        .lean()
        .cursor();

      let scanned = 0;
      let updated = 0;

      for await (const doc of cursor) {
        scanned += 1;
        const caregiverId = doc[caregiverField];
        const mappedTenantId = caregiverId
          ? caregiverToTenant.get(String(caregiverId))
          : null;
        if (!mappedTenantId) continue;

        await model.updateOne(
          { _id: doc._id, $or: [{ tenantId: { $exists: false } }, { tenantId: null }] },
          { $set: { tenantId: mappedTenantId } }
        );
        updated += 1;
      }

      console.log(`${label} scanned:`, scanned);
      console.log(`${label} updated:`, updated);
    }

    await backfillCollection(TimeEntry, { caregiverField: "caregiver", label: "TimeEntry" });
    await backfillCollection(MissedPunchRequest, { caregiverField: "caregiver", label: "MissedPunchRequest" });
    await backfillCollection(TimeEntryCorrection, { caregiverField: "caregiver", label: "TimeEntryCorrection" });

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("Backfill failed:", err?.message || err);
    try {
      await mongoose.connection.close();
    } catch {
      // ignore
    }
    process.exit(1);
  }
})();

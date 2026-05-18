/**
 * seedJobs.js — Insert sample jobs for testing
 *
 * Usage:
 *   node scripts/seedJobs.js                  # seeds all tenants
 *   node scripts/seedJobs.js <tenantId>       # seeds a specific tenant only
 *
 * Run from the backend/ directory:
 *   cd backend && node scripts/seedJobs.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');

const SAMPLE_JOBS = [
  { name: 'Homecare Staff',   description: 'Direct care staff providing in-home services' },
  { name: 'Homecare Manager', description: 'Supervises care staff and coordinates care plans' },
  { name: 'Admin',            description: 'Administrative and office support role' },
];

function buildNameKey(name) {
  return (name || '').trim().toLowerCase();
}

async function seedForTenant(tenant, jobsCol) {
  let created = 0;
  let skipped = 0;
  const now = new Date();

  for (const sample of SAMPLE_JOBS) {
    const nameKey = buildNameKey(sample.name);
    const existing = await jobsCol.findOne({ tenantId: tenant._id, nameKey });

    if (existing) {
      console.log('  [skip] "' + sample.name + '" already exists');
      skipped += 1;
      continue;
    }

    await jobsCol.insertOne({
      _id: new mongoose.Types.ObjectId(),
      tenantId: tenant._id,
      name: sample.name,
      nameKey,
      description: sample.description,
      gustoJobUuid: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    console.log('  [added] "' + sample.name + '"');
    created += 1;
  }

  return { created, skipped };
}

(async () => {
  try {
    await connectDB();

    const db = mongoose.connection.db;
    const tenantsCol = db.collection('tenants');
    const jobsCol = db.collection('jobs');

    const tenantIdArg = (process.argv[2] || '').trim();
    let tenants;

    if (tenantIdArg) {
      if (!mongoose.Types.ObjectId.isValid(tenantIdArg)) {
        console.error('Invalid tenantId:', tenantIdArg);
        process.exit(1);
      }
      const t = await tenantsCol.findOne({ _id: new mongoose.Types.ObjectId(tenantIdArg) });
      if (!t) {
        console.error('Tenant not found:', tenantIdArg);
        process.exit(1);
      }
      tenants = [t];
    } else {
      tenants = await tenantsCol.find({}).toArray();
      if (tenants.length === 0) {
        console.error('No tenants found. Create a tenant first via the admin UI.');
        process.exit(1);
      }
    }

    console.log('Seeding jobs for ' + tenants.length + ' tenant(s)...');
    console.log('');

    for (const tenant of tenants) {
      console.log('Tenant: ' + (tenant.name || '(unnamed)') + ' [' + tenant._id + ']');
      const { created, skipped } = await seedForTenant(tenant, jobsCol);
      console.log('  -> ' + created + ' added, ' + skipped + ' already existed');
      console.log('');
    }

    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();

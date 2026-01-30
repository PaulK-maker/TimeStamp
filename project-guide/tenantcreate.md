# Tenant Setup (Create Facility + Assign Users)

This guide walks you through creating/choosing a **Tenant (Facility)**, assigning your users to it, generating a human-friendly **facility code (`tenantCode`)**, and selecting a plan so admins can use gated features.

> Why this exists: if you see `TENANT_REQUIRED` / “Tenant not assigned for this account” / a `403` from `/api/billing/me`, it means your logged-in user’s local `Caregiver` record has no `tenantId` yet.

---

## What “Tenant” means in this app

- A **Tenant** = one facility (one customer).
- Each local **Caregiver** belongs to exactly one tenant via `Caregiver.tenantId`.
- Your plan and feature gates (data management / printing) are enforced **per tenant**.

---

## Prerequisites

1. Backend `.env` is set up (Mongo connection string, Clerk keys if using Clerk).
2. You have at least one admin user you can log in with.
3. (Optional) You can run Node scripts from the repo root for legacy migrations.

---

## Step 1 — Start the app locally (recommended)

Open two terminals.

### Terminal A (backend)
From repo root:

```bash
cd backend
npm install
npm start
```

(If your project uses `node server.js` instead of `npm start`, use that.)

### Terminal B (frontend)
From repo root:

```bash
cd frontend
npm install
npm start
```

---

## Step 2 — Create/choose a Tenant and assign users (recommended: in-app)

Most users should NOT run scripts.

### 2A) Admin: create your facility (no scripts)

1. Sign in as an admin.
2. Open:

```text
/admin/billing
```

3. If you see “Setup required”, click **Create my facility**.

After this:
- Your admin account is assigned to the new tenant.
- The page will show your facility code (`tenantCode`) like `ABCD-1234`.

### 2B) Caregiver: join the facility by invite code (OTP)

If a caregiver signs in but has no tenant yet, they will be routed to:

```text
/tenant-setup
```

They can enter the 6-digit invite code the admin generated.

How the admin generates the invite code:
- Go to `/admin/billing`
- Use **Invite caregiver by email (one-time code)**

Note:
- The user must be signed in with the same email address the invite was sent to.

---

## Step 3 — Legacy migration (scripts)

These scripts are kept for legacy databases and ops use. They:

- Ensure a tenant exists (create one if needed)
- Assign that tenant to any caregivers missing `tenantId`
- Backfill `tenantId` onto time records that need it (hard scoping)
- Ensure the selected tenant has a human-friendly `tenantCode`

### 3A) Easiest path (single-tenant dev database)

From the repo root:

```bash
node backend/backfillTenantId.js
```

What you should see:
- A printed “Tenant assigned” line
- Caregivers matched / modified counts

### 3B) If you have multiple tenants (or in production)

In production, you MUST choose a tenant explicitly.

Choose by Mongo tenant id:

```bash
TENANT_ID="<tenantObjectId>" node backend/backfillTenantId.js
```

Or choose by facility code:

```bash
TENANT_CODE="ABCD1234" node backend/backfillTenantId.js
```

Notes:
- `TENANT_CODE` can be entered with dashes too: `ABCD-1234`.
- The script is idempotent: it’s safe to run more than once.

---

## Step 4 — Generate facility codes for existing tenants (one-time populate)

If your DB had tenants created before `tenantCode` existed, you can populate codes.

### 3A) Dry run (safe preview)

```bash
node backend/backfillTenantCode.js
```

This defaults to `DRY_RUN=true` and will print what it *would* write.

### 3B) Write codes (recommended: single tenant)

```bash
TENANT_ID="<tenantObjectId>" DRY_RUN=false node backend/backfillTenantCode.js
```

### 3C) Write codes for ALL tenants

Non-production:

```bash
ALLOW_ALL_TENANTS=true DRY_RUN=false node backend/backfillTenantCode.js
```

Production requires confirmation:

```bash
ALLOW_ALL_TENANTS=true CONFIRM=YES DRY_RUN=false node backend/backfillTenantCode.js
```

---

## Step 4 — Restart the backend

After running scripts, restart your backend server.

This ensures your next requests reflect the updated DB state.

---

## Step 5 — Verify tenant assignment is working

Open in your browser:

```text
http://localhost:5001/api/auth/me
```

Expected:
- `user.tenantId` is not null
- `user.tenantCode` is present
- `user.tenantName` may be present

If `user.tenantId` is still null:
- Your signed-in identity is not linked to the local `Caregiver` record you updated.
- Most often this is a Clerk linkage issue (see Troubleshooting below).

---

## Step 6 — Select your pricing plan (required)

Admins must select a plan before using gated features.

1. Go to the billing page:

```text
/admin/billing
```

2. Select a plan.
3. You should be redirected back to `/admin`.

If you still see `403` from `/api/billing/me`:
- You are still missing `tenantId` on the current account.
- Re-run Step 2 and then restart backend.

---

## What the UI should show when working

- Admin Dashboard shows:
  - `Facility code: XXXX-XXXX`
- Admin Billing page shows:
  - The facility code (same `tenantCode`)

---

## Troubleshooting

### A) “TENANT_REQUIRED” / `403` from `/api/billing/me`
Cause: The current logged-in user does not have `req.user.tenantId`.

Fix:
1. Run:
   ```bash
   node backend/backfillTenantId.js
   ```
2. Restart backend.
3. Refresh the browser.

### B) `/api/auth/me` shows `tenantId: null` even after backfill
Most common causes:

- You’re using Clerk auth but there is no local `Caregiver` record linked to your Clerk user.
- Your Clerk email changed or the record is linked to the wrong `clerkUserId`.

Fix checklist:
- Verify there is a `Caregiver` in Mongo with `clerkUserId` matching your signed-in Clerk user.
- Verify that caregiver has a `tenantId` set.

### C) Multiple tenants exist; script refuses to guess
This is expected behavior to avoid production mistakes.

Use:
- `TENANT_ID="..." node backend/backfillTenantId.js` or
- `TENANT_CODE="..." node backend/backfillTenantId.js`

### D) I want to create a new tenant (new facility)
This project currently creates tenants via scripts/backfill and does not yet provide a dedicated “Create Tenant” admin UI.

Recommended workflow today:
1. Create the tenant directly in MongoDB (insert into `tenants` collection) with at least:
   - `name`
   - (optional) `planSelected=false`
2. Run `node backend/backfillTenantCode.js` to generate a `tenantCode`.
3. Assign caregivers to that tenant by setting their `tenantId` (or by running a scripted backfill targeting that tenant).

If you want, we can add a dedicated admin-only API/UI to create tenants later.

---

## Reference commands (quick copy/paste)

- Assign tenant (dev):
  ```bash
  node backend/backfillTenantId.js
  ```

- Assign tenant by tenant id:
  ```bash
  TENANT_ID="<tenantObjectId>" node backend/backfillTenantId.js
  ```

- Assign tenant by facility code:
  ```bash
  TENANT_CODE="ABCD1234" node backend/backfillTenantId.js
  ```

- Populate missing facility codes (dry run):
  ```bash
  node backend/backfillTenantCode.js
  ```

- Populate missing facility codes (write, single tenant):
  ```bash
  TENANT_ID="<tenantObjectId>" DRY_RUN=false node backend/backfillTenantCode.js
  ```

- Populate missing facility codes (write, all tenants, production):
  ```bash
  ALLOW_ALL_TENANTS=true CONFIRM=YES DRY_RUN=false node backend/backfillTenantCode.js
  ```

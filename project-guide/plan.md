# Project Implementation Plan: TimeStamp Evolution

This document outlines the roadmap for transitioning to Clerk authentication, implementing per-tenant pricing/feature gating, and (later) implementing the Geofenced Time Tracking system.

## 1. Authentication Migration: Clerk Integration
Replace the custom `LoginPage.jsx` and backend JWT logic with Clerk for improved security and user management.

### Fix: Sign-In / Sign-Up / Clerk Reroute Errors (Practical Reset Plan)
You can simplify this a lot by first getting basic sign-in working end-to-end with one role, then layering admin/caregiver authorization on top. The current errors usually mean: email is not verified, keys or URLs don’t match localhost, or your route protection logic is blocking you even though you’re signed in.

Below is a practical way to reset and make it work without extra hustle.

#### 1) Basic sanity checks in Clerk dashboard
Do these first to remove hidden landmines.

- Clerk dashboard → Instance settings → Domains & URLs
    - Ensure `http://localhost:3000` is an allowed origin and redirect URL.
    - If you access the backend directly in a browser, also allow `http://localhost:5001`.
- Email & SMS
    - Use a real email you can access.
    - Sign up once and confirm the verification email.
- Paths
    - Ensure Sign-in URL and Sign-up URL match your SPA routes:
        - `/sign-in`
        - `/sign-up`

Once you have one confirmed test user, stick with that user until everything works.

#### 2) Minimal frontend setup (React / CRA)
Goal: get Clerk sign-in/sign-up components working and status visible, before adding any redirects or protection.

- Confirm your app is wrapped with `ClerkProvider` in `frontend/src/index.js` (already done).
- Confirm routes exist in `frontend/src/App.jsx` (required for Clerk navigation):
    - `/sign-in/*`
    - `/sign-up/*`
    - `/post-sign-in`

#### Further Considerations
- If you later add nested caregiver routes, consider giving “Dashboard” exact-match too (React Router `NavLink end`) so it won’t stay highlighted on sub-pages.
- Set env vars (CRA reads these only at startup):
    - `REACT_APP_CLERK_PUBLISHABLE_KEY=pk_...`
    - `REACT_APP_API_BASE_URL=http://localhost:5001` (matches `backend/.env` `PORT=5001`)
    - Restart `npm start` after changing `.env`.

At this stage, you should be able to:

- Go to `/sign-up`, register, verify email.
- Go to `/sign-in` and sign in with same credentials.
- Hit `/post-sign-in` and have the app route you to `/caregiver` or `/admin`.

If this still gives “verification failed” or “not authorized”, the problem is almost certainly mis-matched URLs/ports or a broken custom flow around Clerk’s components.

#### 3) Simplify backend: treat Clerk like a token provider
Instead of Clerk running your whole authorization logic, let it issue a session token, and let your Node/Express backend validate it.

- Frontend already attaches the Clerk token via `ClerkTokenBridge` + axios interceptor.
- Backend: set `CLERK_SECRET_KEY` so Clerk middleware + `authMiddleware.js` can validate Clerk sessions.
- Verify the key handshake by testing:
    - `GET http://localhost:5001/api/ping` returns 200
    - After signing in, `GET http://localhost:5001/api/auth/me` returns 200 with `{ user: { role: ... } }`

#### 4) Add clean role-based access (admin vs caregiver)
Once “any signed-in user” works, then add separation.

- In Clerk dashboard, set `publicMetadata.role = "admin"` for your admin test user.
- In the app, `/admin` should block only on role mismatch (not on sign-in).
- If an admin signs up before role is set, they will route as caregiver until metadata is updated and they sign in again.

#### 5) Common “verification failed / not authorized” culprits
- Missing `/sign-up` route (Clerk tries to navigate there from the SignIn UI).
- Using keys from a different Clerk instance (publishable key != secret key instance).
- Mixing local and deployed URLs in Clerk redirect settings.
- Backend port mismatch: frontend defaults to `http://localhost:5000` unless `REACT_APP_API_BASE_URL` overrides it.
- Backend port mismatch: frontend defaults to `http://localhost:5001` unless `REACT_APP_API_BASE_URL` overrides it.
- Backend missing `CLERK_SECRET_KEY`, causing `/api/auth/me` to return 401 even though frontend is signed in.

### Admin vs Caregiver Sign-Up (Current App Setup)
Because the backend stores `TimeEntry.caregiver` as a MongoDB ObjectId, the app must link every signed-in Clerk user to a local `Caregiver` document (even admins).

- **Caregiver sign-up (self-serve)**
    - Allow caregivers to use Clerk self-sign-up (`<SignUp />`) and then sign in.
    - On the first authenticated API request, the backend links the Clerk user to a local `Caregiver` record by:
        - `clerkUserId` match, otherwise
        - email match, otherwise
        - auto-provision a new `Caregiver` record.
    - Default role is `caregiver` unless Clerk claims specify otherwise.

- **Admin account creation (NOT self-serve)**
    - Do **not** rely on open self-signup to create admins.
    - Create admins using one of these approaches:
        - **Clerk Dashboard / Manual**: create the user (or allow them to sign up), then set `publicMetadata.role = "admin"`.
        - **Invite-only**: use Clerk invitations so only trusted emails can create accounts.
    - After role is set in Clerk, the backend will ensure a local `Caregiver` record exists for that Clerk user with `role: "admin"` (so admin requests and time logs queries work).
    - Important: If an admin initially signs up without the role metadata set, they will be treated as `caregiver` until the Clerk role is updated.

#### Operational Checklist
- **Backend env**
    - Set `CLERK_SECRET_KEY`.
    - Set a publishable key in one of: `CLERK_PUBLISHABLE_KEY` (preferred), `VITE_CLERK_PUBLISHABLE_KEY`, or `REACT_APP_CLERK_PUBLISHABLE_KEY`.
    - Confirm backend boots without 500s: `GET /api/ping` returns 200.

- **Frontend env**
    - Set `REACT_APP_CLERK_PUBLISHABLE_KEY`.
    - Set `REACT_APP_API_BASE_URL` to the running backend (ex: `http://localhost:5001`).
    - Restart `npm start` after any `.env` change (CRA only reads env at startup).

- **Caregiver onboarding (self-signup)**
    - User signs up via Clerk UI.
    - After sign-in, hit an authenticated endpoint once (the app already calls `/api/auth/me` during post-sign-in).
    - Verify in MongoDB `Caregiver` collection:
        - A record exists with `email` matching the Clerk email.
        - `clerkUserId` is set to `user_...`.
        - `role` is `caregiver`.

- **Admin onboarding (invite/manual)**
    - Create/invite the user in Clerk.
    - In Clerk dashboard, set `publicMetadata.role = "admin"` for that user.
    - Have the user sign in once (so the backend links/provisions the local record).
    - Verify in MongoDB `Caregiver` collection:
        - A record exists with `clerkUserId = user_...`.
        - `role` is `admin`.
    - Verify via API:
        - Authenticated `GET /api/auth/me` returns `role: "admin"`.
        - Admin endpoints (ex: `GET /api/admin/timelogs`) return 200 (not 403).

### Multi-Admin Management (How to Add/Remove Admins)
The app supports multiple admins. The role source of truth is **Clerk Public Metadata** (`publicMetadata.role`). The backend mirrors that role into MongoDB so authorization works consistently.

#### Add an admin (recommended: Clerk metadata)
- Create the user (invite or allow sign-up), then in Clerk Dashboard set:
    - `publicMetadata.role = "admin"`
- Have the user make one authenticated request (sign in and visit the app) so the backend links/provisions the local `Caregiver` record.

#### Add an admin (from inside the app)
- Use the Admin Dashboard → **User Management** section.
- Click **Promote** on a user.
- This calls `POST /api/admin/promote` and updates both:
    - Clerk user `publicMetadata.role = "admin"` (when `CLERK_SECRET_KEY` is configured)
    - Local MongoDB `Caregiver.role = "admin"`

#### Add an admin (CLI script)
- Run from the `backend/` folder:
    - `node createAdmin.js admin@yourdomain.com`
- This promotes the local MongoDB record and attempts to update Clerk metadata when `CLERK_SECRET_KEY` is available.

#### Dev-only bootstrap (quick initial admin setup)
- In `backend/.env` (non-production only):
    - `ENABLE_DEV_BOOTSTRAP=true`
    - `ADMIN_EMAILS=admin1@yourdomain.com,admin2@yourdomain.com`
- On next sign-in/request, matching emails are auto-promoted to admin if Clerk metadata isn’t set.

#### Remove admin access (demotion)
- Admin Dashboard → User Management → **Demote**
    - Calls `POST /api/admin/demote` and updates both Clerk metadata + MongoDB role.
- Safety: the backend prevents demoting the **last active admin** and prevents self-demotion.

#### Delete user (Clerk + local deprovision)
- Admin Dashboard → User Management → **Delete**
    - Calls `DELETE /api/admin/users/:caregiverId`
    - Deletes the Clerk account (so they cannot sign in)
    - Marks the local MongoDB `Caregiver.isActive=false` to preserve TimeEntry history
- Safety: the backend prevents deleting the **last active admin** and prevents self-delete.

- **Time tracking integrity check**
    - As a caregiver, call punch-in/out.
    - Verify new `TimeEntry` documents have:
        - `caregiver` stored as an ObjectId (not a `user_...` string).

- **If you see the error: “Cast to ObjectId failed for value \"user_...\" at path caregiver”**
    - A Clerk user id is being written where an ObjectId is expected.
    - Confirm the backend is linking Clerk users to the `Caregiver` model (a `Caregiver` doc must exist with `clerkUserId`).
    - Confirm the timeclock endpoints are using the linked caregiver `_id` for `TimeEntry.caregiver`.

- **Frontend Changes**:
    - Replace `LoginPage.jsx` with Clerk's `<SignIn />` and `<SignUp />` components.
    - Update `App.jsx` to use `ClerkProvider`.
    - Use `useAuth()` and `useUser()` hooks for session management.
    - Update `PrivateRoute.jsx` to leverage Clerk's `SignedIn` and `SignedOut` components.
- **Backend Changes**:
    - Remove custom JWT middleware.
    - Implement `@clerk/clerk-sdk-node` to validate session tokens in `authMiddleware.js`.
    - Sync Clerk user data with the local MongoDB `Caregiver` model via Webhooks.

### Superadmin access key (extra privacy gate)
The app supports a distinct `superadmin` role with a read-only UI at `/superadmin`.

In addition to Clerk authentication + role checks, superadmin API routes are protected by a required access key header. This is a simple “shared secret” layer so `/api/superadmin/*` stays private even if someone signs in with a superadmin account on an untrusted machine.

#### How it works
- Backend requires the request header: `x-superadmin-key`
- Expected value comes from: `SUPERADMIN_ACCESS_KEY` in `backend/.env`
- If the key is missing or invalid, the backend returns `401` with:
    - `code: "SUPERADMIN_KEY_REQUIRED"`

#### Post-sign-in UX (recommended)
- Superadmins can sign in normally.
- On `/superadmin`, the UI prompts for the access key.
- Once entered, the key is stored in browser local storage and automatically attached to superadmin API calls only.

#### Setup steps (local/dev)
1. Set the key in `backend/.env`:
     - `SUPERADMIN_ACCESS_KEY=your-long-random-string`
2. Restart the backend server.
3. Sign in as a user whose MongoDB role is `superadmin`.
4. Visit `/superadmin`, enter the key, click **Save key**, then **Refresh**.

Notes:
- This is not a substitute for production-grade security controls (e.g., IP allowlists / VPN / device trust), but it’s a practical extra gate.
- If you need to revoke access on a shared machine, use **Clear** on the `/superadmin` page (or clear site data) to remove the saved key.

## 2. Multi-Tenant Pricing & Plan Enforcement (Per Facility)

Goal: plans are **per tenant (facility)**, and the backend enforces both **seat limits** and **feature access**.

For the step-by-step operational setup (create/choose a tenant, generate a facility code, assign users, and select a plan), see: `project-guide/tenantcreate.md`.

### Plan catalog (initial / Stripe later)
Define plans centrally (backend config), with two key dimensions:

- **Seat limit**: maximum caregivers allowed for the tenant.
- **Features**:
    - `dataManagement` (admin management: view logs, manage caregivers, approve missed punches, promote/demote, etc.)
    - `printing` (facility export/print endpoints)

Current plan rules:

- Free: up to **1 caregiver**, no `dataManagement`, no `printing`
- Standard: **$10/mo**, up to **10 caregivers**, `dataManagement` yes, `printing` no
- Pro: **$15/mo**, up to **25 caregivers**, `dataManagement` yes, `printing` yes

### Tenant identity & binding
Design choice: “easy, safe, secure” means **no tenant switching**.

- Each local `Caregiver` record belongs to exactly one `tenantId`.
- Every authenticated request attaches `req.user.tenantId` from the linked caregiver record.
- Admin actions are always scoped to `req.user.tenantId`.

### Facility code (`tenantCode`) (human-friendly)
To make tenant selection safe and non-confusing in production (without using phone/email/PII), each tenant has a stable, human-friendly code:

- Stored on the `Tenant` model as `tenantCode` (uppercase, no dashes).
- Display in the UI as `XXXX-XXXX` for readability.
- Used by ops/scripts to target a tenant explicitly (preferred alternative to `TENANT_NAME`).

The frontend can read this via `GET /api/auth/me` (returns `tenantCode` and `tenantName` in the `user` payload) and also via `GET /api/billing/me` (returns `tenant.tenantCode`).

### Tenant scoping (what to enforce)
Two layers:

1) **Soft scoping** (ownership checks)
     - Before acting on a target user/record, verify it belongs to the same tenant.

2) **Hard scoping** (data carries `tenantId`)
     - Persist `tenantId` on core records (TimeEntry, missed punch request, corrections).
     - Filter queries by `tenantId` directly (faster + harder to regress).

### Feature gating (server-side)
Enforcement must happen on the backend (frontend is only UX).

- Block admin features until the tenant has `planSelected=true`.
- Apply feature checks by endpoint:
    - `dataManagement` gates “admin management” features (view logs, manage caregivers, review missed punches, promote/demote/delete)
    - `printing` gates export/printing endpoints

### “View logs” vs “print/export” split
To keep access clean:

- Viewing logs stays on a “view” endpoint gated by `viewLogs`.
- Export/print moves to a separate endpoint gated by `printing`.

### Seat limits (caregiver creation)
Enforce seat caps at create-time:

- When an admin creates a new caregiver, count caregivers in the tenant and block if at limit.
- Keep the behavior deterministic and tenant-scoped.

### Security hardening (admin-only timeclock reads)
Close the ID-based data leakage risk:

- Make `GET /api/timeclock/:caregiverId` and `GET /api/timeclock/:caregiverId/total-hours` admin-only.
- Always tenant-scope the underlying queries.

### One-time migration / backfill (production-safe)
Existing databases need tenant fields populated.

- Run the backfill script to assign `tenantId`:
    - In production, run with an explicit tenant target (required):
        - `TENANT_ID="<tenantObjectId>" node backend/backfillTenantId.js`
        - OR `TENANT_CODE="<tenantCode>" node backend/backfillTenantId.js`
- Script is idempotent (safe to re-run).

#### One-time populate: generate missing `tenantCode` values
Existing tenants may not have a code yet. Run the code backfill:

- Default is safe: `DRY_RUN=true` (no DB writes)
- One tenant (recommended):
    - `TENANT_ID="<tenantObjectId>" DRY_RUN=false node backend/backfillTenantCode.js`
- All tenants (production requires confirmation):
    - `ALLOW_ALL_TENANTS=true CONFIRM=YES DRY_RUN=false node backend/backfillTenantCode.js`

### Stripe integration (future)
Once Stripe is introduced:

- `Tenant` stores Stripe customer/subscription identifiers.
- Webhooks become the source of truth for subscription state.
- Plan enforcement remains backend-driven via plan/feature mapping.

---

## 3. Feature: Location-Validated Geofenced Time Tracking
Ensure caregivers are physically present at the facility when clocking in or out.

### Phase A: Data Capture & Storage
- **Geolocation API**: Integrate `navigator.geolocation` in the punch-in/out flow.
- **Reverse Geocoding**: Use an external API (e.g., Google Maps, OpenStreetMap/Nominatim) to convert coordinates to addresses.
- **Schema Update**: Update `TimeEntry.js` to include:
    ```javascript
    location: {
      lat: Number,
      lng: Number,
      address: String,
      isWithinFence: Boolean
    }
    ```

### Phase B: Geofencing Logic
- **Admin Configuration**: Add a `Facility` model to store approved addresses and allowed radii (e.g., 200 meters).
- **Validation Engine**:
    - Calculate distance between user coordinates and facility coordinates (Haversine formula).
    - Block the request if the distance exceeds the allowed radius.
- **Error Handling**: Provide clear feedback: *"You are currently 0.5 miles from the facility. Please clock in once you arrive."*

### Phase C: Admin Dashboard Enhancements
- **Map View**: Integrate a map (e.g., Leaflet or Google Maps) to show punch locations.
- **Audit Logs**: Highlight "Off-site" attempts or manual overrides.
- **Manual Override**: Add a "Force Punch" button available only to Admin roles for exceptional cases.

---

## 4. Additional Recommendations

### For Caregivers
- **Shift Reminders**: Push notifications or SMS alerts 15 minutes before a scheduled shift starts.
- **Earnings Preview**: A simple dashboard showing estimated pay for the current period based on logged hours.
- **Shift Notes/Handover**: A text area to leave notes for the next caregiver (e.g., "Patient had a restless night"). **(Future Phase: Requires HIPAA-compliant encryption for Protected Health Information/PHI)**.
- **Offline Support**: Allow "caching" a punch if the caregiver has poor signal, syncing it automatically once back online (with original timestamp).

### For Admins
- **Payroll Export**: One-click export of time logs to CSV or Excel formatted for common payroll software (QuickBooks, ADP).
- **Overtime Alerts**: Automatic flags when a caregiver exceeds 40 hours in a work week.
- **Document Management**: Track caregiver certifications (CPR, CNA license) and send alerts when they are nearing expiration.
- **Scheduling Module**: A calendar view to assign shifts, making it easy to see gaps in coverage.
- **Attendance Analytics**: Reports on punctuality and frequency of missed punches.

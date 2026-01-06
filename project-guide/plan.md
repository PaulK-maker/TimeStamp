# Project Implementation Plan: TimeStamp Evolution

This document outlines the roadmap for transitioning to Clerk authentication and implementing the Geofenced Time Tracking system.

## 1. Authentication Migration: Clerk Integration
Replace the custom `LoginPage.jsx` and backend JWT logic with Clerk for improved security and user management.

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

## 2. Feature: Location-Validated Geofenced Time Tracking
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

## 3. Additional Recommendations

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

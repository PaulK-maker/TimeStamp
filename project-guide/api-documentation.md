# API Documentation

This document outlines the primary API endpoints available in the TimeStamp backend.

## Base URL

- Local: `http://localhost:<PORT>/api` (commonly `5001` in this repo)

## Authentication & Authorization

The backend supports Clerk (preferred) and a legacy JWT fallback.

- Frontend sends `Authorization: Bearer <token>`.
- Backend verifies the token in `authMiddleware` and sets `req.user` including `role`.

### Auth (`/auth`)

- `GET /auth/me` (Signed-in): returns the authenticated user info/role used for routing.
	- Also includes `tenantId`, plus `tenantCode` and `tenantName` when assigned.

## Tenant setup (`/tenant`)

These endpoints are designed to replace “run a backfill script” for non-technical onboarding.

- `POST /tenant/bootstrap` (Admin-only)
	- Creates a new facility (Tenant) and assigns it to the current admin account **only if** they are currently unassigned.
	- Body (optional): `{ name?: string }`
	- Returns `{ tenant }`.

### Invite codes (OTP) (`/tenant/otp`)

TimeStamp uses **one-time invite codes** for joining an existing facility.

- `POST /tenant/otp/send-join` (Admin-only)
	- Sends a 6-digit invite code to an email address.
	- Body: `{ toEmail: string }`
	- If mail is not configured, returns a copyable code instead.

- `POST /tenant/otp/redeem-join` (Signed-in)
	- Joins the facility using a 6-digit invite code.
	- Body: `{ code: string }`
	- The signed-in user’s email must match the invite recipient.

## Billing / Plans (`/billing`) (Admin-only)

- `GET /billing/plans`
	- Returns `{ plans }`.

- `GET /billing/me`
	- Returns `{ tenant, plan }`.
	- If unassigned: `403 { code: "TENANT_REQUIRED" }`.

- `POST /billing/select-plan`
	- Body: `{ planId: string }`
	- Sets the plan for the tenant and returns `{ tenant, plan }`.

## Timeclock (`/timeclock`)

- `POST /timeclock/punch-in` (Signed-in): starts a new shift (server captures `punchIn`).
- `POST /timeclock/punch-out` (Signed-in): ends the active shift (server captures `punchOut`).
- `GET /timeclock/my-logs` (Signed-in): returns `{ logs }` sorted by `punchIn`.
	- Each log includes the raw fields (`punchIn`, `punchOut`) and effective fields:
		- `effectivePunchIn`
		- `effectivePunchOut`
	- Effective fields account for approved missed punch overlays without mutating stored punches.

Tenant requirement:
- If the current account has no `tenantId`, these endpoints return `403 { code: "TENANT_REQUIRED" }`.

## Admin (`/admin`) (Admin-only)

- `GET /admin/timelogs`:
	- Query params (optional):
		- `caregiverId`
		- `startDate` (ISO string)
		- `endDate` (ISO string)
	- Returns `{ count, logs }` sorted by `punchIn`.
	- Each log includes `effectivePunchIn` / `effectivePunchOut` when an overlay exists.

- `POST /admin/promote`:
	- Promote a caregiver to admin (also updates Clerk publicMetadata.role when linked).
- `POST /admin/demote`:
	- Demote an admin back to caregiver.
- `DELETE /admin/users/:caregiverId`:
	- Deprovision a user (Clerk delete when linked + local deactivate).

### Admin: Missed punch requests

- `GET /admin/missed-punch-requests?status=pending|approved|rejected|cancelled|all`
- `POST /admin/missed-punch-requests/:id/approve`
	- Approving creates/updates an overlay record for effective times.
- `POST /admin/missed-punch-requests/:id/reject`

## Missed punch requests (`/missed-punch`) (Signed-in)

- `POST /missed-punch/requests`
	- Body: `{ timeEntryId, missingField: "punchOut", requestedTime, reason }`
	- Constraints:
		- Underlying punches are never edited.
		- A request is only allowed when the punch is actually missing.
- `GET /missed-punch/requests/mine`
	- List the signed-in caregiver’s requests.
- `POST /missed-punch/requests/:id/cancel`
	- Cancels a pending request.

Tenant requirement:
- If the current account has no `tenantId`, these endpoints return `403 { code: "TENANT_REQUIRED" }`.

---

Note: Some legacy endpoints mentioned in older docs may no longer be active.

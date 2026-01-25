# API Documentation

This document outlines the primary API endpoints available in the TimeStamp backend.

## Base URL

- Local (default): `http://localhost:5000/api`

## Authentication & Authorization

The backend supports Clerk (preferred) and a legacy JWT fallback.

- Frontend sends `Authorization: Bearer <token>`.
- Backend verifies the token in `authMiddleware` and sets `req.user` including `role`.

### Auth (`/auth`)

- `GET /auth/me` (Signed-in): returns the authenticated user info/role used for routing.

## Timeclock (`/timeclock`)

- `POST /timeclock/punch-in` (Signed-in): starts a new shift (server captures `punchIn`).
- `POST /timeclock/punch-out` (Signed-in): ends the active shift (server captures `punchOut`).
- `GET /timeclock/my-logs` (Signed-in): returns `{ logs }` sorted by `punchIn`.
	- Each log includes the raw fields (`punchIn`, `punchOut`) and effective fields:
		- `effectivePunchIn`
		- `effectivePunchOut`
	- Effective fields account for approved missed punch overlays without mutating stored punches.

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

---

Note: Some legacy endpoints mentioned in older docs may no longer be active.

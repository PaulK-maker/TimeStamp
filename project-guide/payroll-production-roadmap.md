# Payroll Production Roadmap

This document describes the path from the current payroll foundation in TimeStamp to a production-ready, provider-backed payroll integration.

## Current State

TimeStamp already supports:

- tenant-scoped staff records
- tenant-scoped time tracking
- payroll profile metadata for staff
- draft payroll runs with worker snapshots
- gross-pay previews for draft runs
- duplicate-run prevention for the same pay period
- provider submission scaffolding
- Gusto payroll webhook ingestion with signature verification
- Gusto payroll status synchronization for payroll lifecycle events
- Gusto upstream payroll lookup plus prepare, update, and calculate orchestration before submit
- weekly overtime-aware distribution into Gusto hourly compensation rows based on local approved punch data
- minimal admin payroll UI for draft creation, submission, and webhook visibility
- manual verification via the payroll Postman guide

TimeStamp does not yet support:

- provider credential management
- production monitoring and runbooks

## Definition Of Done For Production

Payroll should only be considered production-ready when all of the following are true:

- admins can create, review, and submit a payroll run from the app
- provider responses and webhook events control local payroll status
- provider credentials are stored securely outside source control
- invalid staff payroll profiles are blocked before submission
- duplicate payroll submissions for the same period are blocked
- failed submissions and webhook failures are observable and actionable
- support runbooks exist for retry, rollback, and incident handling
- sandbox and pilot rollouts are completed before general release

## What TimeStamp Owns

TimeStamp should remain responsible for:

- staff payroll profile metadata needed for operations
- approved hours for a pay period
- draft payroll run creation
- audit-friendly run snapshots
- tenant scoping and access control
- provider references and local status tracking

## What Must Stay Provider-Backed

A provider such as Gusto must remain responsible for:

- payroll calculation
- tax withholding and deductions
- payment execution
- filings and regulatory compliance
- regulated payroll data collection and storage
- provider-side employee onboarding for tax and banking workflows

## Policy Boundary

TimeStamp must not become a payroll engine.

Do not store locally:

- SSNs
- bank account numbers
- routing numbers
- tax election forms
- withholding details
- provider secrets in logs or source control

Do not implement locally:

- custom tax logic
- net-pay calculation as source of truth
- payroll disbursement workflows
- filing workflows
- compliance rules that should come from the provider

Any local payroll math in TimeStamp is preview-only. Provider-confirmed state is the source of truth after submission.

## Phased Delivery Plan

### Phase 0: Foundation Completion

Goal: make the current draft-only foundation reliable enough to build on.

Scope:

- keep payroll profile validation aligned across controller and schema
- keep duplicate payroll-run prevention enforced at API and database level
- keep draft payroll runs clearly labeled as preview and pre-submission artifacts
- keep staff inclusion rules explicit for payroll eligibility, employment status, and payroll date windows
- keep manual verification up to date in the Postman guide

Dependencies:

- none beyond the current codebase

Exit criteria:

- invalid payroll profiles are rejected consistently
- duplicate payroll periods are blocked consistently
- draft-run behavior is documented and manually verified

### Phase 1: Provider Submission Integration

Goal: submit a validated draft payroll run to the provider from the backend.

Scope:

- add provider configuration and credential loading
- add a payroll submission service for the chosen provider
- add a dedicated submit endpoint for an existing draft payroll run
- store provider payroll ids and submission metadata on successful submission
- normalize provider error responses into actionable admin-facing errors

Dependencies:

- Phase 0 complete
- sandbox provider account and credentials available

Exit criteria:

- a draft run can be submitted successfully in sandbox
- rejected submissions return actionable errors
- local runs transition from `draft` to a submitted/provider-tracked state

### Phase 2: Webhooks And State Synchronization

Goal: make the provider the source of truth for payroll lifecycle state.

Scope:

- add webhook endpoint for provider payroll events
- verify webhook signatures
- deduplicate webhook events and store audit history
- reconcile provider events back to `PayrollRun` and `PayrollRunItem`
- handle success, processing, completion, and failure states

Dependencies:

- Phase 1 complete
- provider webhook secret configured

Exit criteria:

- duplicate events do not double-process
- local payroll status updates from webhook events reliably
- webhook failures are visible in logs and admin support tooling

### Phase 3: Admin Experience And Operational Controls

Goal: remove dependence on raw API calls and make payroll supportable by admins.

Scope:

- add admin payroll dashboard and run-history UI
- add payroll review and submit flow
- add staff payroll profile management UI
- expose failure reasons and current provider status in the UI
- clarify feature gating and locked states for plans without payroll access

Dependencies:

- Phase 1 complete for submission UX
- Phase 2 complete for trustworthy status display

Exit criteria:

- an admin can review and submit payroll without Postman
- failed or stuck runs are visible in the app
- staff payroll profile issues are visible before submission

### Phase 4: Security, Testing, And Launch Readiness

Goal: make the integration safe to release to real tenants.

Scope:

- add backend automated tests for validation, submission, and webhook handling
- add monitoring and alerting for failed submissions and webhook lag
- document support runbooks and rollback procedures
- validate secret handling and remove sensitive data from logs
- complete sandbox, pilot, and staged rollout validation

Dependencies:

- Phases 1 through 3 complete

Exit criteria:

- automated coverage exists for critical payroll flows
- monitoring and on-call response are defined
- staged rollout plan exists and has been tested

## What Is Still Unfinished Right Now

As of the current repository state, the following items are still missing for full payroll integration:

- webhook subscription creation and verification against Gusto APIs (requires a public URL, e.g. via ngrok or deployed backend)
- richer payroll failure reconciliation using Gusto payroll fetch / processing-request details
- production monitoring, alerting, and support runbooks
- backend automated tests for payroll workflows
- full sandbox end-to-end payroll run submission and pilot validation

**Completed since initial roadmap:**
- exact Gusto submission API contract locked (Bearer token, PUT `.../submit`, 202 Accepted)
- upstream Gusto payroll lookup, prepare, update employee_compensations, calculate, and poll flow
- local job dimension added to time entries (`job` ref + `jobSnapshot` captured at punch-in)
- per-job weekly overtime aggregation feeding exact Gusto `job_uuid` compensation row mapping
- admin jobs management (create, update, archive, link Gusto job_uuid)
- staff default job assignment with required job selection at punch-in
- Gusto webhook exact contract: verification-token handshake, HMAC SHA-256 signature, full event reconciliation
- staff payroll profile management UI added (`StaffPayrollProfilePanel`, `frontend/src/services/staff.js`, `AdminPayrollPage` updated)
- Gusto sandbox OAuth2 authorization code flow completed and verified
- Gusto sandbox credentials wired into `backend/.env` (`GUSTO_COMPANY_ACCESS_TOKEN`, `GUSTO_COMPANY_ID`, `GUSTO_REFRESH_TOKEN`, `GUSTO_API_BASE_URL`, `PAYROLL_PROVIDER_MODE=live`)
- Gusto sandbox company confirmed via `GET /v1/companies` — company name: Timestamp1, UUID: `007905e9-9c9c-4ed7-8239-573706a9f65f`
- `X-Gusto-API-Version: 2026-02-01` header added to all Gusto API requests in `gustoProvider.js`
- token refresh flow confirmed working via `grant_type=refresh_token`

## Gusto Sandbox Credential Setup Procedure

This section documents how sandbox credentials were obtained for future reference or re-setup.

### Prerequisites
- A Gusto developer account at https://dev.gusto.com
- A demo app created with a redirect URI of `http://localhost:5001/api/auth/gusto/callback`
- The backend running locally at port 5001

### Step 1 — Authorization Code Flow
Visit this URL in a browser (replace `CLIENT_ID`):
```
https://app.gusto-demo.com/oauth/authorize?client_id=CLIENT_ID&redirect_uri=http://localhost:5001/api/auth/gusto/callback&response_type=code&scope=public
```
After authorizing, the browser redirects to localhost and the backend returns a "Route not found" message containing `?code=XXXX`. Copy only the code value.

### Step 2 — Exchange Code for Tokens
Run within 60 seconds of getting the code (codes expire quickly):
```
curl.exe --ssl-no-revoke -X POST "https://api.gusto-demo.com/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=CODE&client_id=CLIENT_ID&client_secret=CLIENT_SECRET&redirect_uri=http%3A%2F%2Flocalhost%3A5001%2Fapi%2Fauth%2Fgusto%2Fcallback"
```
Response includes `access_token` (valid ~2 hours) and `refresh_token` (long-lived).

### Step 3 — Token Refresh (when access token expires)
```
curl.exe --ssl-no-revoke -X POST "https://api.gusto-demo.com/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=REFRESH_TOKEN&client_id=CLIENT_ID&client_secret=CLIENT_SECRET"
```
Each refresh returns a new `access_token` AND a new `refresh_token`. Update both in `.env`.

### Step 4 — Verify Connection
```
curl.exe --ssl-no-revoke \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "X-Gusto-API-Version: 2026-02-01" \
  "https://api.gusto-demo.com/v1/companies"
```
Returns company JSON confirming credentials are valid.

### Required .env Variables
```
GUSTO_COMPANY_ACCESS_TOKEN=
GUSTO_COMPANY_ID=007905e9-9c9c-4ed7-8239-573706a9f65f
GUSTO_REFRESH_TOKEN=
GUSTO_API_BASE_URL=https://api.gusto-demo.com
PAYROLL_PROVIDER_MODE=live
```

### Notes
- `client_credentials` grant type is NOT supported by Gusto — always use authorization code or refresh token flow
- Use `--ssl-no-revoke` on Windows to avoid certificate revocation check errors
- Use `curl.exe` (not `curl`) in PowerShell to avoid alias conflicts
- `GUSTO_COMPANY_ID` is the UUID from `GET /v1/companies`, NOT from the dev.gusto.com dashboard URL
- Minimum required API version for this app: `2026-02-01`

## Recommended Release Sequence

1. Keep the current foundation as draft-only payroll preparation.
2. Ship sandbox-only provider submission behind a limited feature flag.
3. Ship webhook handling and status reconciliation.
4. Ship admin UI for review, submission, and payroll history.
5. Add monitoring, runbooks, and rollback controls.
6. Run a pilot with limited tenants before general availability.

## File-By-File Implementation Map

### Phase 0: Foundation Completion

- `backend/controllers/caregiverController.js`
	Keep payroll profile validation as the main write-path guard for compensation type, rate/salary rules, and payroll eligibility.
- `backend/models/staff.js`
	Keep schema validation aligned with the controller so invalid payroll profiles are blocked consistently.
- `backend/controllers/payrollController.js`
	Keep draft-run creation, staff eligibility checks, preview math, and duplicate prevention stable.
- `backend/models/PayrollRun.js`
	Keep the one-run-per-period uniqueness rule aligned with the controller behavior.
- `project-guide/payroll-postman-test-guide.md`
	Keep manual verification steps current whenever payroll validation or draft-run behavior changes.

### Phase 1: Provider Submission Integration

- `backend/config/`
	Add a provider configuration module such as `gustoProvider.js` for credential loading, client creation, and API helpers.
- `backend/controllers/payrollController.js`
	Add a submit action for existing draft runs, state transitions, provider payroll id persistence, and actionable provider error handling.
- `backend/routes/adminRoutes.js`
	Add a new admin-only submission route such as `POST /api/admin/payroll-runs/:runId/submit`.
- `backend/package.json`
	Add the provider SDK or any required HTTP client dependency if a provider-specific library is used.
- `backend/.env.example`
	Document required provider environment variables and webhook secret placeholders.

### Phase 2: Webhooks And State Synchronization

- `backend/server.js`
	Register a dedicated payroll webhook endpoint before JSON body parsing if raw-body signature verification is required.
- `backend/routes/`
	Add a new webhook route file if the payroll webhook surface should stay separate from admin routes.
- `backend/controllers/payrollController.js` or a dedicated webhook controller
	Verify signatures, deduplicate events, map provider events to local runs, and update run/item statuses.
- `backend/models/PayrollWebhookEvent.js`
	Use this model as the webhook audit trail and idempotency anchor.
- `backend/models/PayrollRun.js`
	Persist provider submission state, timestamps, and last-error metadata as webhook events arrive.
- `backend/models/PayrollRunItem.js`
	Persist item-level submission, completion, and failure statuses when supported by provider events.

### Phase 3: Admin Experience And Operational Controls

- `frontend/src/App.jsx`
	Add routes for a payroll page and any staff payroll profile management screens.
- `frontend/src/pages/AdminDashboard.jsx`
	Link the dashboard into the payroll workflow or surface payroll status summaries.
- `frontend/src/pages/`
	Add pages such as `AdminPayrollPage.jsx` and `AdminStaffPayrollPage.jsx` for review, submission, and payroll profile management.
- `frontend/src/components/`
	Add reusable payroll tables, status badges, review panels, and validation/error display components.
- `frontend/src/services/`
	Add service helpers for payroll list, draft creation, draft submission, webhook event viewing, and payroll profile updates.

### Phase 4: Security, Testing, And Launch Readiness

- `backend/package.json`
	Add a backend test script and the minimum test framework needed for payroll workflows.
- `backend/controllers/payrollController.js`
	Add tests around draft creation, submission state changes, duplicate prevention, and webhook reconciliation.
- `backend/controllers/caregiverController.js`
	Add tests around payroll profile validation rules and edge cases.
- `project-guide/`
	Add support runbooks, rollout notes, and incident-response guidance if payroll moves toward launch.
- `README.md` and `project-guide/README.md`
	Keep production-readiness and operator-facing payroll docs discoverable from the main doc entry points.

## Suggested Sprint Plan

### Sprint 1: Stabilize The Foundation

Primary outcome:
Lock the current payroll foundation so draft payroll data is predictable and supportable.

Scope:

- verify controller/schema alignment for payroll profiles
- verify duplicate-run protection behavior in real environments
- confirm the Postman guide matches the current API behavior
- decide whether payroll eligibility rules need any additional fields before provider work begins

Task checklist:

- confirm `backend/controllers/caregiverController.js` and `backend/models/staff.js` enforce the same compensation rules
- confirm `backend/controllers/payrollController.js` and `backend/models/PayrollRun.js` enforce the same duplicate-period rule
- verify the current draft-run API contract in `backend/routes/adminRoutes.js`
- verify the staff payroll profile API contract in `backend/routes/staffRoutes.js`
- verify `project-guide/payroll-postman-test-guide.md` matches the live endpoint behavior
- document any remaining eligibility-rule decisions before provider submission starts

Milestone:

- draft payroll creation is considered stable and documented

### Sprint 2: Submit To Provider In Sandbox

Primary outcome:
An admin can submit a draft payroll run to the provider sandbox from the backend.

Scope:

- add provider config and secrets loading
- add draft submission endpoint
- persist provider payroll id and submission metadata
- normalize common submission failures

Initial implementation scaffold in this repo:

- `backend/config/gustoProvider.js` for provider mode, credential loading, payload construction, and submission handling
- `POST /api/admin/payroll-runs/:runId/submit` in `backend/routes/adminRoutes.js`
- submission handling in `backend/controllers/payrollController.js`
- provider environment variables documented in `backend/.env.example`

Milestone:

- first successful sandbox submission from TimeStamp

### Sprint 3: Webhook Truth And Status Sync

Primary outcome:
Provider events become the authoritative source for payroll state inside the app.

Scope:

- add webhook endpoint and signature verification
- add webhook audit logging and deduplication
- update local run and item statuses from provider events
- surface failure and completion states clearly in the backend responses

Milestone:

- end-to-end sandbox flow: draft -> submit -> webhook -> completed/failed status

### Sprint 4: Admin Payroll UI

Primary outcome:
Admins can operate payroll without raw API calls.

Scope:

- add payroll dashboard route and page
- add review-and-submit workflow
- add payroll history and status visibility
- add staff payroll profile management UI

Milestone:

- admin completes payroll workflow entirely in the frontend

### Sprint 5: Launch Readiness

Primary outcome:
The integration is safe to pilot with real tenants.

Scope:

- add automated test coverage for critical payroll flows
- add monitoring and alerting for submission and webhook failures
- document support runbooks and rollback steps
- validate staged rollout controls and pilot checklist

Milestone:

- pilot-ready release candidate

### Sprint 6: Pilot And Production Rollout

Primary outcome:
Roll out provider-backed payroll in a controlled way.

Scope:

- enable payroll for limited pilot tenants
- collect failure cases and support feedback
- tighten runbooks and operational thresholds
- graduate from pilot to broader availability only after stable webhook and support behavior

Milestone:

- production rollout decision based on pilot results, not assumption

## Payroll Production Checklist

Before payroll should be considered ready for production, all of the following should be true:

- payroll drafts can be submitted to the payroll provider
- provider webhooks update payroll status back into TimeStamp
- admins can review and submit payroll from the app
- invalid staff payroll profiles are blocked before submission
- duplicate payroll runs are blocked
- provider credentials are stored securely
- failed submissions and webhook problems trigger alerts
- support steps are documented for payroll issues
- sandbox testing is complete
- pilot rollout is completed before general release
- TimeStamp stays within the provider-backed compliance boundary
- SSNs, tax forms, and bank details are not stored locally
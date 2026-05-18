# Payroll Postman Test Guide

Use this sequence to manually verify the current payroll foundation behavior.

> **Note:** Backend runs on port **5001**, not 5000.

## Collection Variables

- `baseUrl` = `http://localhost:5001`
- `adminEmail` = your admin email
- `adminPassword` = your admin password
- `token` = blank initially
- `staffId` = set after listing staff
- `payPeriodStart` = `2026-04-01`
- `payPeriodEnd` = `2026-04-15`

## Preconditions

- The test user must be an `admin`.
- The user must have a `tenantId` assigned.
- The tenant must have a selected plan with `dataManagement` enabled.
- In the current plan config, that means `standard_10` or `pro_25`.

## Request Sequence

1. `Login Admin`
   - `POST {{baseUrl}}/api/auth/login`
   - Body:
     ```json
     {
       "email": "{{adminEmail}}",
       "password": "{{adminPassword}}"
     }
     ```
   - Save `token` from the response.

2. `Get Me`
   - `GET {{baseUrl}}/api/auth/me`
   - Header: `Authorization: Bearer {{token}}`
   - Confirm the response includes `role: admin` and a non-null `tenantId`.

3. `List Staff`
   - `GET {{baseUrl}}/api/staff`
   - Header: `Authorization: Bearer {{token}}`
   - Choose one returned staff member and save the id into `staffId`.

4. `Invalid Payroll Profile - Hourly Missing payRate`
   - `PUT {{baseUrl}}/api/staff/{{staffId}}/payroll-profile`
   - Headers:
     - `Authorization: Bearer {{token}}`
     - `Content-Type: application/json`
   - Body:
     ```json
     {
       "payrollEligible": true,
       "compensationType": "hourly",
       "salaryAmount": 52000
     }
     ```
   - Expected result: `400`.

5. `Invalid Payroll Profile - Salary Missing salaryAmount`
   - `PUT {{baseUrl}}/api/staff/{{staffId}}/payroll-profile`
   - Headers:
     - `Authorization: Bearer {{token}}`
     - `Content-Type: application/json`
   - Body:
     ```json
     {
       "payrollEligible": true,
       "compensationType": "salary",
       "payRate": 25
     }
     ```
   - Expected result: `400`.

6. `Valid Payroll Profile - Hourly`
   - `PUT {{baseUrl}}/api/staff/{{staffId}}/payroll-profile`
   - Headers:
     - `Authorization: Bearer {{token}}`
     - `Content-Type: application/json`
   - Body:
     ```json
     {
       "payrollEligible": true,
       "compensationType": "hourly",
       "payRate": 24.5,
       "workerClassification": "w2",
       "employmentStatus": "active",
       "payrollProvider": "gusto",
       "payrollProviderEmployeeId": "emp_123",
       "payrollStartDate": "2026-04-01"
     }
     ```
   - Expected result: `200`.

7. `Create Payroll Run`
   - `POST {{baseUrl}}/api/admin/payroll-runs`
   - Headers:
     - `Authorization: Bearer {{token}}`
     - `Content-Type: application/json`
   - Body:
     ```json
     {
       "payPeriodStart": "{{payPeriodStart}}",
       "payPeriodEnd": "{{payPeriodEnd}}"
     }
     ```
   - Expected result: `201` with message `Draft payroll run created`.

8. `Create Duplicate Payroll Run`
   - Repeat the same request as step 7.
   - Expected result: `409` with a duplicate-pay-period message.

9. `List Payroll Runs`
   - `GET {{baseUrl}}/api/admin/payroll-runs`
   - Header: `Authorization: Bearer {{token}}`
   - Expected result: `200` with the created run still in `draft` status.

10. `Submit Payroll Run (Mock Mode)`
    - Set `PAYROLL_PROVIDER_MODE=mock` in `backend/.env` and restart backend.
    - `POST {{baseUrl}}/api/admin/payroll-runs/{{runId}}/submit`
    - Header: `Authorization: Bearer {{token}}`
    - Expected result: `202` with `status: submitted` and a `mock-payroll-...` providerPayrollId.

## Phase A Results (Validated 2026-04-29)

All 10 steps above passed in mock mode:
- Login, auth, staff listing, profile validation, run creation, duplicate detection, listing, and mock submission all work correctly.
- `providerPayrollId` is set to `mock-payroll-{runId}-{timestamp}` in mock mode.

## Phase B: Live Gusto Submission

### Architecture Finding (2026-04-29)

Gusto's Embedded Payroll API has two authentication levels:

1. **System access token** — obtained via `POST /oauth/token` with `grant_type=system_access` using `client_id` + `client_secret`. Used to create partner-managed companies.
2. **Company access token** — scoped to a specific company. Required for all payroll operations (prepare, update, calculate, submit).

**Critical requirement:** The company must be created through `POST /v1/partner_managed_companies` (using the system token), NOT through the Gusto web UI. Companies created via the UI return `401` on payroll write endpoints (`/prepare`, `/calculate`, `/submit`) because your app is not recognized as their "partner."

### Production Onboarding Flow (Required Before Live Payroll Works)

When onboarding a new tenant to Gusto payroll:

```
1. POST /oauth/token  (grant_type=system_access) → get systemToken
2. POST /v1/partner_managed_companies (using systemToken) → get company_uuid + company_access_token
3. Store company_uuid as tenant's GUSTO_COMPANY_ID
4. Store company_access_token as tenant's GUSTO_COMPANY_ACCESS_TOKEN
5. Complete company onboarding: location, employees, tax info, pay schedule
6. Now payroll prepare/calculate/submit all work with the company_access_token
```

### Sandbox State (2026-04-29)

- **System access token**: works (`grant_type=system_access` returns valid token)
- **Partner-managed test company**: `44196a95-66a8-428e-86ea-9cb1183b966d` (stored in `.env` as `GUSTO_PARTNER_COMPANY_UUID`)
- **UI-created demo company** (`007905e9-...` / "Timestamp1"): payroll write endpoints return `401` (expected — not partner-managed)

### Next Steps for Full Live Test

1. Add a job/compensation to employee `1d8a8091-...` in the partner company
2. Add home address, work address, tax withholdings, and bank account
3. Set up a pay schedule OR create an off-cycle payroll
4. Update `GUSTO_COMPANY_ID` and `GUSTO_COMPANY_ACCESS_TOKEN` to the partner company values
5. Run steps 7 → 10 with `PAYROLL_PROVIDER_MODE=live`
6. Verify `202` response with real Gusto `payroll_uuid` as `providerPayrollId`

## Expected Status Summary

- Step 4: `400`
- Step 5: `400`
- Step 6: `200`
- Step 7: `201`
- Step 8: `409`
- Step 9: `200`
- Step 10 (mock): `202`

## Common Blockers

- `401`: invalid or missing auth token
- `403` with `TENANT_REQUIRED`: user has no tenant assigned
- `403` with `PLAN_REQUIRED`: tenant has no active selected plan
- `403` with `FEATURE_NOT_AVAILABLE`: tenant plan does not include `dataManagement`
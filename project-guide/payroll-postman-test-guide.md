# Payroll Postman Test Guide

Use this sequence to manually verify the current payroll foundation behavior.

## Collection Variables

- `baseUrl` = `http://localhost:5000`
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

## Expected Status Summary

- Step 4: `400`
- Step 5: `400`
- Step 6: `200`
- Step 7: `201`
- Step 8: `409`
- Step 9: `200`

## Common Blockers

- `401`: invalid or missing auth token
- `403` with `TENANT_REQUIRED`: user has no tenant assigned
- `403` with `PLAN_REQUIRED`: tenant has no active selected plan
- `403` with `FEATURE_NOT_AVAILABLE`: tenant plan does not include `dataManagement`
# Payroll Staged Rollout Plan

This document defines the three-stage process for moving Gusto payroll from sandbox to full production availability for all tenants.

---

## Overview

```
Stage 1 — Sandbox Validation (current)
         ↓  all checks pass
Stage 2 — Pilot (1–2 real facilities, real Gusto account)
         ↓  2 successful pay cycles, no incidents
Stage 3 — General Release (all tenants)
```

---

## Stage 1 — Sandbox Validation ✅ (Complete as of July 11, 2026)

**Goal**: Confirm the full payroll lifecycle works end-to-end in Gusto's demo environment before any real money moves.

### Completed
- [x] Payroll run creation (draft → submitted via `POST /api/payroll/run`)
- [x] Gusto submission with `providerPayrollId` returned and stored
- [x] Webhook subscription registered and Active (`b1d27760-b7be-4bb4-9c0c-a16f76c824d5`)
- [x] Webhook signature verification (HMAC SHA-256 with stored token)
- [x] Status updates via webhooks (`submitted` → `processing` → `completed`)
- [x] Failure event handling + alert emails (`payroll.processing_failed`)
- [x] Admin payroll UI — confirmation modal, blocking items table, error display
- [x] Staff payroll profiles — `providerEmployeeId` gating before submission
- [x] 39 unit tests passing (webhook sig, status mapping, profile validation)
- [x] Runbook documented for incident response

### Newly identified gaps (August 5, 2026 review)
- [x] Automated OAuth token refresh runs inside the deployed backend — fixed August 5, 2026
- [ ] Payroll access is split by role (view vs. run/submit), not granted to every `admin`
- [ ] Sandbox coverage includes at least one rejected/failed submission, one multi-employee run, and the new token-refresh path — not just the single happy-path run completed so far

### Exit Criteria
All of the above, including the newly identified gaps, must be ✅ before proceeding to Stage 2.

---

## Stage 2 — Pilot (1–2 Facilities, Real Gusto Account)

**Goal**: Process at least 2 real pay cycles with a live Gusto Embedded account for a known, cooperative facility owner before opening to all tenants.

**Prerequisite**: Gusto must approve your Embedded Payroll partnership application for production access. Contact embedded@gusto.com to start this process if not already in progress.

**Update (August 5, 2026):** the OAuth access-token refresh blocker below is now fixed — `gustoProvider.js` refreshes and persists tokens automatically via MongoDB (see `payroll-production-roadmap.md` and Runbook Incident 6). One new operational rule from that fix: don't run `gustoOnboardAndSubmit.js` or other local token-refresh scripts against the same Gusto app credentials while the deployed server is live — Gusto refresh tokens are single-use, so the two will race and invalidate each other.

### Setup Steps

1. **Production Gusto credentials**
   - Obtain a production Gusto Embedded app (`client_id` / `client_secret`)
   - Set `GUSTO_CLIENT_ID`, `GUSTO_CLIENT_SECRET`, `GUSTO_API_BASE=https://api.gusto.com` on Render (replacing sandbox values)
   - Keep sandbox values in a separate `.env.sandbox` file locally for testing

2. **Register production webhook subscription**
   - Run `node scripts/registerGustoWebhook.js` against the production API
   - Set new `GUSTO_WEBHOOK_VERIFICATION_TOKEN` in Render env
   - Verify subscription is **Active** on gusto.com dashboard

3. **Onboard pilot facility to Gusto**
   - Walk the facility owner through Gusto's embedded onboarding (company info, bank account, tax setup)
   - Gusto must verify their bank account before first payroll can be processed
   - Add at least 2 employees in Gusto; fill in their `payrollProviderEmployeeId` values in TimeStamp staff profiles

4. **Feature-flag payroll for pilot only** *(optional but recommended)*
   - Add a `payrollEnabled: true` field to the pilot facility's `Tenant` document in MongoDB
   - Gate the payroll nav link in the frontend behind this flag: `{tenant.payrollEnabled && <PayrollLink />}`
   - This prevents other tenants from seeing an incomplete payroll UI during the pilot

### Pilot Run Checklist (repeat for each pay cycle)

- [ ] Admin creates a payroll run draft with correct pay period
- [ ] All staff in the run have `providerEmployeeId` set — no blocking items
- [ ] Admin reviews hours in the confirmation modal
- [ ] Submit — `providerPayrollId` returned and stored
- [ ] Webhook events arrive within 5 minutes — status updates to `processing`
- [ ] Check date passes — status updates to `completed`
- [ ] No failure alert email received
- [ ] Employees receive direct deposit on scheduled date
- [ ] Admin confirms amounts matched expected hours × rate

### Exit Criteria for Stage 2
- [ ] 2 complete pay cycles processed with zero payment errors
- [ ] No failed webhooks or stuck `submitted` statuses
- [ ] Pilot facility admin confirms the UI workflow is clear and correct
- [ ] No runbook incidents triggered

---

## Stage 3 — General Release

**Goal**: Make payroll available to all Pro-tier tenants (or whichever plan tier includes payroll).

### Pre-launch Gate

Before removing the pilot feature flag, confirm:

- [ ] Gusto Embedded partnership fully approved and production credentials active
- [ ] Stage 2 exit criteria met (2 clean pay cycles)
- [ ] Payroll plan tier gate defined — which Stripe plans include payroll access? (`pro_25`? new `payroll` plan?)
- [ ] Billing page updated to show payroll as a feature of the qualifying plan
- [ ] Support email/help text in place for tenants who need help setting up Gusto

### Release Steps

1. **Remove or generalize the feature flag**
   - If you used `tenant.payrollEnabled`, either remove the gate or wire it to plan tier: `tenant.plan === "pro_25"`
   - Deploy frontend and backend together

2. **Send announcement to existing Pro tenants**
   - Email: "Payroll is now available — here's how to get started"
   - Link to a setup guide covering: connect Gusto account, add employees, run first payroll

3. **Monitor first week closely**
   - Watch Render logs for webhook errors
   - Check MongoDB for any `PayrollRun` documents stuck in `submitted` for more than 30 minutes
   - Respond to any failure alert emails within 1 business day

4. **Post-launch review (after 2 weeks)**
   - [ ] Review how many tenants have set up payroll profiles
   - [ ] Review webhook event success rate
   - [ ] Note any common blocking items or setup friction points
   - [ ] Update runbook if new incident types were encountered

---

## Rollback Plan

If a critical payroll bug is discovered after general release:

1. Re-add the `payrollEnabled` feature flag gated to only pilot tenants
2. Deploy the gate immediately (no data is deleted — runs stay in MongoDB)
3. Notify affected tenants: "Payroll is temporarily unavailable while we address an issue. No submitted payrolls have been affected."
4. Fix the issue in sandbox first (Stage 1 checklist)
5. Re-run pilot (Stage 2 checklist) with the fixed code
6. Re-release to general

---

## Key Contacts

| Contact | Purpose |
|---|---|
| embedded@gusto.com | Production approval, partnership issues, payroll disputes |
| Render dashboard | Backend deploys, env var changes, log inspection |
| dev.gusto.com | Sandbox app config, webhook subscription management |

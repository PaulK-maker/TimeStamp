# Payroll Operations Runbook

This document covers how to respond to payroll incidents in production. Keep this open any time you are reviewing, submitting, or troubleshooting a payroll run.

---

## Quick Reference — Payroll Run Statuses

| Status | Meaning | Action needed |
|---|---|---|
| `draft` | Created locally, not sent to Gusto | Review and submit when ready |
| `submitted` | Sent to Gusto, awaiting processing | Wait for webhook — no action needed |
| `processing` | Gusto is calculating | Wait — normal intermediate state |
| `completed` | Paid successfully | No action needed |
| `failed` | Gusto reported a failure | See Incident 1 below |
| `cancelled` | Reversed or cancelled in Gusto | See Incident 2 below |

---

## Incident 1 — Payroll Run Failed (`payroll.processing_failed`)

### Symptoms
- Alert email arrives: `[TimeStamp] ⚠️ Payroll failure`
- PayrollRun status shows `FAILED` in the Admin Payroll page
- `lastError` field shows Gusto's error message

### Step-by-step response

**Step 1 — Identify the run**
1. Go to Admin Dashboard → Payroll
2. Find the run with `FAILED` status — note the Provider ID (Gusto payroll UUID)

**Step 2 — Check Gusto for details**
1. Log into [app.gusto-demo.com](https://app.gusto-demo.com) (sandbox) or the live Gusto admin
2. Navigate to the company → Payroll → find the payroll by UUID
3. Read the failure reason — common causes:
   - Bank account not verified
   - Employee missing tax info or bank account
   - Insufficient funds
   - Payroll submitted outside allowed processing window

**Step 3 — Decide: fix and resubmit OR cancel**

If the issue is fixable (e.g. missing employee info):
1. Fix the issue in Gusto directly (employee tax setup, bank account, etc.)
2. In TimeStamp Admin → Payroll, the run will still show `failed`
3. You cannot resubmit the same `PayrollRun` document — create a new draft for the same pay period after Gusto cancels the failed one

If the issue is not fixable (e.g. wrong pay period):
1. Cancel the payroll in Gusto dashboard
2. Wait for `payroll.cancelled` webhook — TimeStamp will update status to `cancelled`
3. Create a new draft run with the correct dates

**Step 4 — Update MongoDB manually if webhook doesn't fire**

If the status doesn't update automatically within 10 minutes:
```bash
# Connect to MongoDB and update the run manually
# Replace RUN_ID with the PayrollRun _id from the admin UI
db.payrollruns.updateOne(
  { _id: ObjectId("RUN_ID") },
  { $set: { status: "cancelled", lastError: "Manually cancelled after processing_failed — see Gusto dashboard" } }
)
```

---

## Incident 2 — Payroll Reversed or Cancelled (`payroll.reversed`, `payroll.cancelled`)

### Symptoms
- PayrollRun status shows `CANCELLED`
- May or may not have received an alert email (cancellations don't trigger failure alerts)

### Step-by-step response

1. Check Gusto dashboard to understand why the payroll was reversed
2. If it was a Gusto-initiated reversal (e.g. fraud review), contact Gusto support
3. If it was admin-initiated (you cancelled it), create a new draft run for the same pay period
4. Notify affected employees of the delay

---

## Incident 3 — Payroll Submitted But Status Stuck at `submitted`

### Symptoms
- Run was submitted successfully (202 response)
- Status has not moved to `processing` or `completed` after several hours
- No webhook events appear in the Webhook Events table

### Causes
- Gusto webhook subscription is inactive or was deleted
- `GUSTO_WEBHOOK_VERIFICATION_TOKEN` mismatch (backend rejecting Gusto's requests)
- Render backend was restarted and missed webhook events

### Step-by-step response

**Step 1 — Check webhook subscription**
1. Go to [dev.gusto.com](https://dev.gusto.com) → Applications → Timestamp1 → Webhook subscriptions
2. Confirm state is **Active** — if Pending or inactive, re-verify using the verification token

**Step 2 — Check Render logs for rejected webhook requests**
1. Render dashboard → TimeCapcha backend → Logs
2. Search for `GUSTO_WEBHOOK` or `401` or `signature`
3. If you see `Gusto webhook signature verification failed` — the `GUSTO_WEBHOOK_VERIFICATION_TOKEN` env var may be wrong or missing

**Step 3 — Manually sync status from Gusto**
If webhooks are still not arriving, check Gusto directly and update MongoDB:
```bash
# Set status to match what Gusto shows
db.payrollruns.updateOne(
  { providerPayrollId: "GUSTO_PAYROLL_UUID" },
  { $set: {
    status: "completed",
    completedAt: new Date(),
    "providerMetadata.manualStatusSync": true
  }}
)
```

---

## Incident 4 — Submit Button Returns "Resolve payroll item issues"

### Symptoms
- Admin clicks "Review & Submit" → confirms → sees blocking items table
- One or more staff show: `providerEmployeeId is required before provider submission`

### Resolution
1. In Admin Payroll page → Staff Payroll Profiles section
2. Find the blocked staff member — status badge shows **Incomplete**
3. Click Edit → fill in **Gusto Employee ID** (`payrollProviderEmployeeId`)
   - Find this UUID in Gusto: Company → Employees → click employee → URL contains the UUID
4. Save the profile
5. Return to the payroll run and click "Review & Submit" again

---

## Incident 5 — Webhook Verification Token Lost or Expired

### Symptoms
- Gusto subscription shows **Pending** again
- Render logs show `Gusto webhook verification token is not configured`

### Resolution
1. Run the registration script to get a new token:
   ```bash
   cd backend
   WEBHOOK_URL=https://timecapcha.onrender.com/api/payroll/webhook node scripts/registerGustoWebhook.js
   ```
2. Check Render logs for `=== GUSTO WEBHOOK VERIFICATION TOKEN ===`
3. Set `GUSTO_WEBHOOK_VERIFICATION_TOKEN=<new token>` in Render environment variables
4. Redeploy backend
5. Go to dev.gusto.com → verify the subscription with the new token

---

## Routine Checks (Weekly)

Before each payroll run:
- [ ] All staff who worked this period have `payrollEligible: true` and a Gusto Employee ID set
- [ ] Pay period dates are correct (no overlap with previous submitted run)
- [ ] Gusto webhook subscription is **Active** on dev.gusto.com
- [ ] Render backend is healthy (check `/api/ping`)

After each payroll run submits:
- [ ] Status moves from `submitted` → `processing` → `completed` within the check date
- [ ] No failure alert email received
- [ ] Webhook Events table shows at least one `processed` event for the run

---

## Key UUIDs and URLs (Sandbox)

| Item | Value |
|---|---|
| Gusto sandbox app | [dev.gusto.com/applications/d547c152-5a08-4fc9-b60e-3bdb383cf9ea](https://dev.gusto.com/applications/d547c152-5a08-4fc9-b60e-3bdb383cf9ea) |
| Webhook subscription UUID | `b1d27760-b7be-4bb4-9c0c-a16f76c824d5` |
| Partner-managed company UUID | `44196a95-66a8-428e-86ea-9cb1183b966d` |
| Backend URL | `https://timecapcha.onrender.com` / `https://api.timecapcha.app` |
| Admin payroll page | `https://timecapcha.app/admin/payroll` |

---

## Contact

- **Gusto Embedded Support**: embedded@gusto.com — for sandbox approvals, company issues, payroll disputes
- **Render Support**: dashboard.render.com → Support — for backend/infra issues

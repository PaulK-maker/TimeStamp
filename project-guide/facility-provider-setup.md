# Facility / Provider Setup Guide

This guide gives a clear step-by-step flow for adding:

- a new facility (tenant)
- a new provider/staff user to that facility
- a payroll provider connection context (Gusto sandbox phase)

Use this when admins ask: "How do I add a new facility/provider?"

Use this when the facility does not already exist and you need to onboard a new subscriber from scratch.

---

## New Subscriber Flow

Use this flow when you are onboarding a brand-new customer or facility that does not yet exist in TimeStamp.

1. Sign in as the admin who will own the new facility.
2. Open `/admin/billing`.
3. Under **Setup required**, click **Email me a one-time setup code**.
4. Enter the 6-digit setup code that arrives in the admin email inbox.
5. Click **Verify & create facility**.
6. Confirm the facility is created and the facility name/code appear on the Billing page.
7. Select the correct billing plan for the new subscriber.
8. Open **Invite staff member by email (one-time code)** and send invite codes to the staff members who will work at that facility.
9. Ask each staff member to:
   - sign in with the same email address that received the invite code
   - open `/tenant-setup`
   - enter the 6-digit invite code
   - click **Join with invite code**
10. Confirm the staff member appears in the correct facility and reaches the expected dashboard.

Important:
- The setup code is for creating the first facility record.
- The invite code is for adding staff or additional admins to that facility.
- One facility equals one tenant.
- Keep the facility code for support reference.

## Before you start

Confirm all of these first:

1. Backend is running.
2. Frontend is running.
3. You can sign in as an admin.

Local run commands:

```bash
cd backend
npm install
npm start
```

```bash
cd frontend
npm install
npm start
```

---

## Part 1: Add a new facility (tenant)

1. Sign in as an admin.
2. Open `/admin/billing`.
3. If you see **Setup required**, click **Email me a one-time setup code**.
4. Enter the 6-digit code sent to your admin email.
5. Click **Verify & create facility**.
6. Confirm the facility details appear (name/code/plan area).
7. Select a plan immediately so admin features unlock.

Notes:
- One facility equals one tenant.
- Keep the facility code for support reference.

---

## Part 2: Add a new provider/staff member

In TimeStamp, "provider" in day-to-day admin language usually means a staff member/caregiver account assigned to a facility.

1. Sign in as an admin.
2. Open `/admin/billing`.
3. In **Invite staff member by email (one-time code)**, enter the provider/staff email.
4. Click **Send invite code**.
5. Tell the user to:
   - sign in with the same email address
   - open `/tenant-setup`
   - enter the 6-digit code
   - click **Join with invite code**
6. Confirm they are assigned to the correct facility and reach their expected dashboard.

Important:
- The invite code is tied to the exact email used for sign-in.
- If email delivery fails, use the copy-code fallback shown in the UI.

---

## Part 3: If "provider" means payroll provider (Gusto)

Use this only for payroll integration context.

1. Keep payroll in sandbox/pilot mode until production roadmap requirements are complete.
2. Confirm backend provider config is set for Gusto sandbox.
3. Use partner-managed company flow for payroll write endpoints.
4. Follow provider submission sequence for payroll runs.
5. Save provider payroll ID in MongoDB and rely on provider webhooks for status truth.

Key reminder:
- TimeStamp is the operational layer.
- The payroll provider (such as Gusto) is the source of truth for payroll execution, taxes, and compliance.

---

## Quick troubleshooting

### Setup required still appears

- Go back to `/admin/billing`.
- Request a fresh one-time setup code.
- Complete **Verify & create facility** again.

### Invite code not working

Check these first:

1. Did the user sign in with the same email the code was sent to?
2. Did the code expire?
3. Did they redeem it on `/tenant-setup`?

If needed, send a new invite code.

### User signed in but not assigned to facility

Most common causes:

1. email mismatch
2. tenant setup not completed
3. expired code

Resend a new invite code and re-run tenant setup.

---

## Source docs

- `tenantcreate.md`
- `plan.md`
- `README.md`

---

## Plan Review (Current)

Current billing tiers are:

1. Free: $0/month, up to 2 staff, no payroll feature.
2. Standard: $35/month, up to 20 staff, no payroll feature.
3. Pro: $55/month, up to 40 staff, payroll feature included.

Operational note:
- Existing internal plan IDs remain `free_1`, `standard_10`, and `pro_25` for backward compatibility.
- Stripe price env var names also remain `STRIPE_PRICE_STANDARD_10` and `STRIPE_PRICE_PRO_25`.

---

## Office SOP (Quick Checklist)

Use this section as a copy-ready checklist for office admins.

### SOP A: Create a new facility

1. Sign in as admin.
2. Open `/admin/billing`.
3. Click **Email me a one-time setup code**.
4. Enter the 6-digit code.
5. Click **Verify & create facility**.
6. Select a plan.
7. Confirm facility name and code are visible.

### SOP B: Add a new provider/staff user

1. Open `/admin/billing`.
2. In **Invite staff member by email (one-time code)**, enter their work email.
3. Click **Send invite code**.
4. Tell the user:
   - sign in with that exact email
   - go to `/tenant-setup`
   - enter code
   - click **Join with invite code**
5. Confirm user appears in the correct facility.

### SOP C: Fast issue handling

1. Code failed: send a new invite code.
2. User not assigned: confirm email match and complete `/tenant-setup`.
3. Billing still says setup required: rerun setup code flow in `/admin/billing`.

---

## Before Onboarding The First Client

Use this as a go/no-go checklist before inviting your first paying facility.

1. Billing plans and Stripe prices are aligned.
2. Stripe webhook is live and verified (`/api/stripe/webhook`).
3. Duplicate or test subscriptions are cleaned up in Stripe.
4. Production secrets are hardened (`JWT_SECRET`, `SUPERADMIN_ACCESS_KEY`).
5. Dev bootstrap is disabled in production (`ENABLE_DEV_BOOTSTRAP=false`).
6. End-to-end smoke test passes on deployed app:
   - sign up admin
   - create facility
   - choose plan
   - invite staff and redeem invite code
   - verify admin features unlock by plan
7. If selling Pro with payroll:
   - payroll provider mode/config is validated for your rollout stage
   - payroll submission and webhook status sync are tested in sandbox first
   - payroll is operationally monitored before any production payroll commitments

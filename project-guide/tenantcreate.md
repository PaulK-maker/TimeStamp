# Facility Setup Guide

This guide explains the safest, easiest way for a non-technical admin to:

- create a new facility
- invite a new staff member
- help the staff member join the correct facility

The recommended workflow uses the app UI. Scripts are only for legacy cleanup or technical support.

---

## Before you start

Make sure all 3 of these are true:

1. The backend is running.
2. The frontend is running.
3. You can sign in as an admin.

If you are setting this up locally, start the app like this.

### Backend

```bash
cd backend
npm install
npm start
```

### Frontend

```bash
cd frontend
npm install
npm start
```

---

## What a facility means in this app

- One facility = one tenant.
- Each staff member belongs to exactly one facility.
- Billing, plan limits, and admin features are tied to that facility.

This is designed to be safe for non-technical users:

- staff do not choose from a list of facilities
- staff join by a one-time invite code
- the app prevents a signed-in user from switching facilities by accident

---

## Quick answer

If you only need the shortest version:

### To add a new facility

1. Sign in as an admin.
2. Open `/admin/billing`.
3. If you see **Setup required**, click **Email me a one-time setup code**.
4. Enter the 6-digit code.
5. Click **Verify & create facility**.
6. Select a plan.

### To add a new staff member

1. Sign in as an admin.
2. Open `/admin/billing`.
3. In **Invite staff member by email (one-time code)**, enter the staff member's email.
4. Click **Send invite code**.
5. Tell the staff member to sign in with that same email.
6. Tell them to open `/tenant-setup` and enter the 6-digit code.

---

## Part 1: Add a new facility

Use this when you are creating a facility for the first time.

### Step 1: Sign in as an admin

Sign in with your admin account.

If your account is valid but not yet attached to a facility, the app will usually guide you toward setup.

### Step 2: Open the Billing page

Go to:

```text
/admin/billing
```

### Step 3: Start facility setup

If the page shows **Setup required**, use the box labeled:

`Create your facility (recommended)`

You may enter a facility name first, but this is optional.

Then click:

`Email me a one-time setup code`

### Step 4: Enter the 6-digit code

The app sends a one-time code to the admin email you are signed in with.

Enter that code in the **One-time code** field and click:

`Verify & create facility`

### Step 5: Confirm the facility was created

After success, the billing page should show:

- the facility name
- the facility code
- the plan area

The facility code looks like this:

```text
ABCD-1234
```

Keep this code for support/reference. Normal staff do not need to type it during setup.

### Step 6: Select a plan

Choose the facility plan on the same billing page.

This is required before the admin features are fully available.

After selecting a plan, the app should take you back to:

```text
/admin
```

---

## Part 2: Add a new staff member

Use this after the facility already exists.

### Step 1: Open the Billing page

Go to:

```text
/admin/billing
```

### Step 2: Find the invite section

Use the section labeled:

`Invite staff member by email (one-time code)`

### Step 3: Enter the staff member's email

Enter the exact email address the staff member will use to sign in.

This is important.

The invite only works if:

- the admin sends the code to `name@example.com`
- the staff member signs in using `name@example.com`

If they sign in with a different email, the code will not attach them to the facility.

### Step 4: Send the code

Click:

`Send invite code`

If email is configured on the server, the staff member will receive the code by email.

If email is not configured, the app shows a **Copy-code fallback** box. In that case:

1. copy the code
2. send it to the staff member manually
3. remind them that the code expires

### Step 5: Tell the staff member exactly what to do

Send these instructions to the staff member:

1. Sign in with the same email address the invite was sent to.
2. Open `/tenant-setup`.
3. Enter the 6-digit invite code.
4. Click **Join with invite code**.

### Step 6: Confirm they joined successfully

After they redeem the code, the app assigns them to the facility and sends them to the correct dashboard.

For a normal staff member, that should be:

```text
/staff
```

---

## Recommended wording for a non-technical admin

If you are writing instructions for office staff or a facility manager, use wording like this:

### Create a facility

1. Sign in as admin.
2. Open Billing.
3. Request the setup code.
4. Enter the code from your email.
5. Create the facility.
6. Pick a plan.

### Add a staff member

1. Open Billing.
2. Enter the staff member's email.
3. Send the invite code.
4. Tell the staff member to sign in with the same email the invite was sent to.
5. Tell them to enter the code on the Join Facility page.

That flow is easier and safer than asking staff to choose a facility manually.

---

## Why this flow is safe for non-technical users

This setup is intentionally designed to reduce mistakes.

- No facility picker: staff cannot accidentally join the wrong facility from a dropdown.
- Email match required: the invite is tied to the staff member's signed-in email.
- One-time codes expire: an old code cannot be reused forever.
- One facility per user: once assigned, the account is not supposed to bounce between facilities.
- Admin-led setup: the facility admin controls who gets invited.

---

## Troubleshooting

### Problem: I see `Setup required`

Meaning: your signed-in account exists, but it is not attached to a facility yet.

Fix:

1. Go to `/admin/billing`.
2. Use **Create your facility (recommended)**.
3. Request the setup code.
4. Verify the code.

### Problem: The staff member says the invite code does not work

Check these first:

1. Did they sign in with the same email address the code was sent to?
2. Did the code expire?
3. Did they enter the code on `/tenant-setup`?

If needed, send a fresh code from `/admin/billing`.

### Problem: The admin does not receive the setup code email

If email is not configured, the app should show a fallback code on screen.

Use that code directly.

### Problem: The invited user signs in but is not in the facility

This usually means one of these:

1. they used the wrong email address
2. they never completed `/tenant-setup`
3. their code expired before they redeemed it

The safest fix is to send a new invite code and have them try again.

### Problem: Billing says tenant is missing

If you still see `TENANT_REQUIRED`, the current account is not correctly linked to a local staff record with a `tenantId`.

For normal day-to-day use, do not run scripts first. Try the in-app setup flow again.

If that still fails, then a technical admin can investigate the local staff record and legacy backfill scripts.

---

## Legacy scripts

These are for technical support, not for most admins.

### Assign tenant data in older databases

```bash
node backend/backfillTenantId.js
```

### Backfill missing facility codes

```bash
node backend/backfillTenantCode.js
```

Only use these when cleaning up an older database or when the normal UI flow cannot complete due to legacy data.

---

## Best practice checklist for admins

- Create the facility first.
- Select a plan immediately.
- Invite staff by email, not by sharing a code widely.
- Tell staff to sign in with the same email the invite was sent to.
- Resend a fresh code instead of troubleshooting an old one for too long.
- Keep the facility code for support, but do not treat it like the invite code.

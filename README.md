# TimeStamp

TimeStamp is a web application for staff to log their work hours and for administrators to manage time entries.

## Project Guide

For detailed information on setup, architecture, and API documentation, please refer to the [Project Guide](project-guide/README.md).

## Quick Start

1. **Backend**: `cd backend && npm install && npm run dev`
2. **Frontend**: `cd frontend && npm install && npm start`

See the [Setup Guide](project-guide/setup.md) for more details.

Notes:
- If you use Clerk on the frontend, the backend must have `CLERK_SECRET_KEY` set (see `backend/.env.example`).
- Example env files are provided in `backend/.env.example` and `frontend/.env.example`.

## Admin Quick Sheet

This is the short version for a non-technical admin.

### Add a New Facility

1. Sign in as an admin.
2. Open `/admin/billing`.
3. If you see **Setup required**, click **Email me a one-time setup code**.
4. Enter the 6-digit code sent to your email.
5. Click **Verify & create facility**.
6. Select a plan.

### Add a New Staff Member

1. Sign in as an admin.
2. Open `/admin/billing`.
3. In **Invite staff member by email (one-time code)**, enter the staff member's email.
4. Click **Send invite code**.
5. Tell the staff member to sign in with that same email.
6. Tell them to open `/tenant-setup` and enter the 6-digit code.

### Safety Notes

- Always send the invite to the exact email address the staff member will use to sign in.
- If the staff member uses a different email, the invite code will not attach them to the facility.
- If email is not configured on the server, copy the fallback code shown on the billing page and send it manually.
- The facility code is for support/reference. The invite code is the one staff members use to join.

For the full version, see [project-guide/tenantcreate.md](project-guide/tenantcreate.md).

## Staff Invite Templates

Use these templates when sending instructions to a new staff member.

### Email Template

```text
Subject: Your TimeStamp facility invite

Hello,

You have been invited to join our facility in TimeStamp.

Please follow these steps:

1. Sign in using this email address: [staff email]
2. Open: /tenant-setup
3. Enter this 6-digit invite code: [invite code]
4. Click Join with invite code

Important:
- Use the same email address this message was sent to.
- If you use a different email, the code will not work.
- If the code has expired, contact your admin for a new one.

After you finish, you will be taken to your staff dashboard.
```

### Text Message Template

```text
You’ve been invited to join TimeStamp.

1. Sign in with this email: [staff email]
2. Go to /tenant-setup
3. Enter code: [invite code]
4. Tap Join with invite code

Important: use the same email this invite was sent to. If the code expires, ask me for a new one.
```

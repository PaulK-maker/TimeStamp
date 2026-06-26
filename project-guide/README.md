# Project Guide

Welcome to the TimeStamp Project Guide. This directory contains documentation to help you understand, set up, and develop the TimeStamp application.

## Contents

- [Setup Guide](setup.md): Instructions on how to get the project running locally.
- [Tenant Setup (Create Facility + Assign Users)](tenantcreate.md): Step-by-step guide to create/choose a tenant, generate a facility code, assign users, and select a plan.
- [Facility / Provider Setup Guide](facility-provider-setup.md): Step-by-step flow for onboarding a new subscriber/facility, inviting staff or an additional admin, and handling payroll-provider context.
- [Architecture Overview](architecture.md): A high-level look at how the frontend and backend interact.
- [API Documentation](api-documentation.md): Details about the backend endpoints.
- [Database Schema](database.md): Information about the MongoDB models.
- [Schema Analysis](schema-analysis.md): Technical deep-dive into schema changes for new features.
- [Implementation Plan](plan.md): Roadmap for Clerk integration, tenant billing, future payroll integration through a provider such as Gusto, and geofencing features.
- [Payroll Production Roadmap](payroll-production-roadmap.md): Clear path from the current payroll foundation to a production-ready provider-backed payroll integration.
- [Payroll Postman Test Guide](payroll-postman-test-guide.md): Manual verification steps for payroll profile validation and draft payroll run creation.

## Project Overview

TimeStamp is a web application designed for staff to log their time and for admins to manage those logs. It uses a modern tech stack with React on the frontend and Node.js/Express on the backend, with MongoDB as the database.

## Go-Live Status (June 14, 2026)

### ✅ Completed — Security & Legal
- `NODE_ENV=production` set on Render — dev bootstrap disabled in production
- `JWT_SECRET` replaced with a strong random secret on Render
- `SUPERADMIN_ACCESS_KEY` hardened to a long random string on Render
- **Terms of Service & Acceptable Use Policy** — new `/terms` page with full legal content covering employer responsibilities, employee monitoring notice, payroll disclaimer, data accuracy disclaimer, billing terms, and limitation of liability
- **Privacy Policy** — replaced placeholder with real 11-section policy (data collection, usage, sharing, retention, security, user rights)
- Clerk sign-up UI now shows Terms and Privacy links (passive consent, industry standard)

### ❌ Remaining Before Go-Live

| # | Task | Risk if skipped |
|---|------|----------------|
| 1 | Cancel duplicate Stripe subscriptions `sub_1TFpzsGlYnDvUBQGCt6kS7Ie` and `sub_1TEjo6GlYnDvUBQGzi0Pepra` in Stripe Dashboard | Real customers double-billed |
| 2 | End-to-end checkout test on deployed app — new user → checkout → confirm plan activates via webhook automatically | Billing flow untested on production |
| 3 | Full new-user smoke test on deployed app — sign up → assign tenant → select plan → confirm admin features unlock | Core user journey untested on production |

### Not Required for Initial Go-Live (Post-Launch / Payroll Phase)
- Update MongoDB `PayrollRun` with submitted `providerPayrollId`
- Gusto webhook payroll status sync
- Admin UI for payroll review and submission (Phase 3 roadmap)
- Payroll must remain sandbox/pilot only until Phase 4 of payroll production roadmap is complete

---

## Recent Changes

### June 25, 2026
- **Admin Dashboard** — time logs now support search, date filtering, sorting, and pagination for easier high-volume review
- **Admin Dashboard** — top action buttons updated to wrap cleanly on smaller screens
- **Staff Dashboard** — active shift now shows a live running duration timer while clocked in

### June 14, 2026
- **Terms of Service & Acceptable Use Policy** — new `TermsOfService.jsx` page at `/terms` with tailored content for a workforce time-recording SaaS
- **Privacy Policy** — `PrivacyPolicy.jsx` rewritten with real content (replaces placeholder)
- **Clerk sign-up** — Terms and Privacy links wired into the Clerk `SignUp` component via `appearance.layout`
- **Footer** — Terms of Service link added
- **Security hardening** — `NODE_ENV=production`, strong `JWT_SECRET`, and strong `SUPERADMIN_ACCESS_KEY` set on Render

### May 26, 2026
- **Gusto sandbox company approved** — Gusto Embedded Support (Tatiana) confirmed sandbox company `44196a95` is approved
- **Payroll SUBMITTED** — `providerPayrollId: fef1d6d6-6903-4642-b2e5-419b7a0d002e` — Gross $1,960.00 · Taxes $548.52 · Net $1,411.48 (80 hrs × $24.50); status 202 Accepted

### May 21, 2026
- **Admin Dashboard — Invite Staff** — new "✉️ Invite Staff" button on all admin dashboards; opens a modal to email a join OTP; falls back to copy-code if SMTP is unavailable
- **Invite API SMTP fix** — `tenantOtpController.js` now catches SMTP errors instead of returning 500; copy-code always shown on success or delivery failure
- **Gusto company bank verified** — used sandbox `send_test_deposits` API to instantly simulate microdeposits and verify the company bank account (`12a5f771-3113-404c-a6eb-f2824d478d74`)
- **`backend/scripts/verifyCompanyBank.js`** — new one-shot script that automates sandbox bank verification via the Gusto `send_test_deposits` → `verify` API flow
- **`backend/scripts/gustoOnboardAndSubmit.js`** — updated pay period dates (2026-05-19 → 2026-05-25, check 2026-05-28); added fallback to reuse existing open payrolls when creation returns 422
- **Gusto payroll loaded** — off-cycle payroll `aff2706c-4342-4fbc-9429-cd22e25e9c9d` created and loaded with 80 regular hours; blocked at calculate step pending Gusto company approval (`needs_approval` blocker — requires Gusto risk team review)

### May 18, 2026
- **Caregiver Dashboard** — missed punch request form converted to a modal dialog with shift context, status badges for all request states (pending/rejected/approved/withdrawn), and a full request history table
- **`backend/scripts/seedJobs.js`** — seed script to insert sample jobs (Homecare Staff, Homecare Manager, Admin) for any tenant; useful for local testing without a paid plan

### Jobs Quick Reference
- Admins create/manage jobs: Admin Dashboard → 🧩 Jobs section
- For local dev seeding: `cd backend && node scripts/seedJobs.js`
- Gusto job UUID link is optional — only needed when submitting payroll hours to Gusto

### Payroll Note

Future payroll support is planned as a provider-backed integration, not a built-in payroll engine.
TimeStamp may prepare payroll-ready operational data such as staff records and approved hours, but payroll execution, tax handling, filings, and regulated payroll data should remain with a payroll provider such as Gusto.

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
- [Payroll Runbook](payroll-runbook.md): Incident response guide covering failed runs, stuck statuses, webhook issues, and rollback steps.
- [Payroll Staged Rollout Plan](payroll-staged-rollout.md): Three-stage rollout plan (sandbox → pilot → general release) with exit criteria and rollback procedures.

## Project Overview

TimeStamp is a web application designed for staff to log their time and for admins to manage those logs. It uses a modern tech stack with React on the frontend and Node.js/Express on the backend, with MongoDB as the database.

## Go-Live Status (Updated: July 11, 2026)

### ✅ Completed — Security & Legal
- `NODE_ENV=production` set on Render — dev bootstrap disabled in production
- `JWT_SECRET` replaced with a strong random secret on Render
- `SUPERADMIN_ACCESS_KEY` hardened to a long random string on Render
- **Terms of Service & Acceptable Use Policy** — new `/terms` page with full legal content covering employer responsibilities, employee monitoring notice, payroll disclaimer, data accuracy disclaimer, billing terms, and limitation of liability
- **Privacy Policy** — replaced placeholder with real 11-section policy (data collection, usage, sharing, retention, security, user rights)
- Clerk sign-up UI now shows Terms and Privacy links (passive consent, industry standard)

### ✅ Completed — Stripe Duplicate Subscriptions
- Confirmed all three subscription IDs (`sub_1TFpzsGlYnDvUBQGCt6kS7Ie`, `sub_1TEjo6GlYnDvUBQGzi0Pepra`, `sub_1TPtGnGlYnDvUBQGZEBYCRGr`) return "No such subscription" in live mode — all were test-mode only, no real customers were ever charged, billing is clean

### ✅ Completed — New Facility Onboarding Fix (July 6, 2026)
- New subscribers signing up via Clerk now see a **"Create a new facility"** card on `/tenant-setup` — previously only the invite-code card existed, blocking new facility owners
- `POST /api/tenant/bootstrap` no longer requires admin role — any authenticated user with no tenant can create one
- Facility creator is automatically promoted to `admin` role on creation

### ✅ Completed — Gusto Payroll Integration Phases 2–4 (July 11, 2026)
- **Phase 2 — Webhooks**: Gusto webhook subscription registered and Active (UUID `b1d27760-b7be-4bb4-9c0c-a16f76c824d5`); HMAC SHA-256 signature verification live; `GUSTO_WEBHOOK_VERIFICATION_TOKEN` set on Render; status updates flow automatically from Gusto → MongoDB
- **Phase 3 — Admin Payroll UI**: Confirmation modal with irreversible warning before submit; blocking items table for staff missing `providerEmployeeId`; inline `lastError` display for failed runs; formatted pay period dates
- **Phase 4 — Security, Testing & Monitoring**: 39 Jest unit tests passing (webhook sig, status mapping, payroll profile validation); failed payroll alert emails via `sendPayrollFailureAlert`; payroll incident runbook at `project-guide/payroll-runbook.md`; staged rollout plan at `project-guide/payroll-staged-rollout.md`

### ❌ Remaining Before Full Go-Live (2 Smoke Tests)

| # | Task | What you need |
|---|------|---------------|
| 1 | End-to-end checkout smoke test — new user → sign up → create facility → checkout → confirm plan activates via Stripe webhook | Fresh email + Stripe test card `4242 4242 4242 4242` |
| 2 | Full new-user smoke test — sign up → create facility → select plan → confirm admin features unlock | Same as above |

> Stripe test cards require no real bank account. Use card `4242 4242 4242 4242`, any future expiry, any CVC/ZIP.

### Not Required for Initial Go-Live (Post-Launch / Payroll Phase)
- Gusto production credentials (requires Embedded Payroll partnership approval from Gusto)
- Pilot facility onboarding to real Gusto account (Stage 2 of staged rollout)
- General payroll release to all tenants (Stage 3 of staged rollout)

---

## Recent Changes

### August 5, 2026
- **Payroll completion plan re-reviewed against Gusto Embedded's "5 Key Steps" framework** (Requirements → Design → Integrate → Test → Deploy) — new section added to `payroll-production-roadmap.md`
- **Security fix: hardcoded Gusto sandbox client secret removed from source.** `backend/server.js`'s `/api/auth/gusto/callback` route, plus six tracked scripts (`getGustoToken.js`, `gustoOnboardAndSubmit.js`, `registerGustoWebhook.js`, `verifyCompanyBank.js`, `checkBankVerify.js`, `tryBankVerify.js`, `probeSandbox.js`), had the Gusto sandbox `client_id`/`client_secret` hardcoded directly in committed source (introduced in commit `bf6858c`, 2026-05-18). All now read `GUSTO_CLIENT_ID` / `GUSTO_CLIENT_SECRET` from environment variables, which already existed in `backend/.env` (git-ignored) with matching values, so local dev is unaffected. **Action required: confirm `GUSTO_CLIENT_ID` and `GUSTO_CLIENT_SECRET` are set in the Render environment** — the `/api/auth/gusto/callback` route now returns 503 instead of working if they're missing there. The exposed secret is for the sandbox app only (`api.gusto-demo.com`), not production, but it's already in git history — rotating it with Gusto is recommended.
- **Fix: automatic OAuth token refresh shipped.** Added `backend/models/GustoToken.js` (single Mongo document) and `ensureFreshGustoAccessToken()` in `backend/config/gustoProvider.js`, which refreshes the Gusto access token 5 minutes before expiry and persists the rotated pair to MongoDB, called once at the top of every `submitPayrollRun`. Bootstraps once from `GUSTO_COMPANY_ACCESS_TOKEN`/`GUSTO_REFRESH_TOKEN`, then MongoDB is the source of truth. All 39 existing Jest tests still pass unaffected. New operational rule: don't run `gustoOnboardAndSubmit.js` against the same credentials while the deployed server is live — Gusto refresh tokens are single-use, so the two will invalidate each other. Recovery steps for a broken/invalid refresh token are documented as Runbook Incident 6.
- **Gap found: payroll access is not role-scoped.** Any `admin` with the `payroll` feature flag can both view and submit payroll runs; no separate "view only" permission exists yet.
- Fixed a stale plan-catalog entry in `plan.md`: Standard ($35/mo) includes `printing` as of the August 2, 2026 `backend/config/plans.js` change — previously documented as Pro-only.

### July 11, 2026
- **Gusto Payroll Phase 2 — Webhooks complete** — subscription registered and Active; HMAC signature verification live; webhook status sync working end-to-end
- **Gusto Payroll Phase 3 — Admin UI enhancements** — confirmation modal before payroll submit; blocking items table for missing employee IDs; inline error display; formatted pay period dates
- **Gusto Payroll Phase 4 — Security, testing & monitoring complete** — 39 Jest unit tests passing; failed payroll alert emails; payroll runbook published; staged rollout plan published
- **CORS fix** — `https://api.timecapcha.app` added to backend allowed origins
- **Webhook token secured** — verification token only logged on first boot when env var is not yet set

### July 6, 2026
- **New facility onboarding fixed** — `TenantSetupPage.jsx` now shows a "Create a new facility" card alongside the invite code card; new subscribers no longer get stuck on invite-only screen after Clerk sign-up
- **Bootstrap route opened** — `POST /api/tenant/bootstrap` no longer gated behind admin role; any authenticated user with no tenant can create one and is automatically promoted to admin
- **Stripe duplicate subscriptions resolved** — confirmed all three flagged subscription IDs existed in test mode only; no live subscriptions were created, no customers were ever charged
- **Invite flow verified** — full staff invite flow reviewed: Admin Dashboard → Invite Staff modal → 6-digit OTP email → worker signs up with same email → enters code on `/tenant-setup` → joins facility → redirected to `/staff`

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

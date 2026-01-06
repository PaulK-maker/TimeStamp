# API Documentation

This document outlines the primary API endpoints available in the TimeStamp backend.

## Base URL
`http://localhost:5000/api`

## Authentication (`/auth`)

- `POST /auth/register`: Register a new user.
- `POST /auth/login`: Authenticate a user and return a token.
- `GET /auth/create-admin-once`: (Development only) Create an initial admin user.

## Caregivers (`/caregivers`)

- `GET /caregivers`: Retrieve a list of all caregivers (Admin only).
- `POST /caregivers`: Create a new caregiver profile.
- `GET /caregivers/:id`: Get details for a specific caregiver.

## Time Entries / Punches (`/punches` or `/timeclock`)

- `POST /punches/in`: Clock in for a shift.
- `POST /punches/out`: Clock out from a shift.
- `GET /punches/history`: Retrieve shift history for the authenticated user.

---

*Note: This documentation is subject to change as the project evolves.*

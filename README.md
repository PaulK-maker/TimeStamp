# TimeStamp

TimeStamp is a web application for caregivers to log their work hours and for administrators to manage time entries.

## Project Guide

For detailed information on setup, architecture, and API documentation, please refer to the [Project Guide](project-guide/README.md).

## Quick Start

1. **Backend**: `cd backend && npm install && npm run dev`
2. **Frontend**: `cd frontend && npm install && npm start`

See the [Setup Guide](project-guide/setup.md) for more details.

Notes:
- If you use Clerk on the frontend, the backend must have `CLERK_SECRET_KEY` set (see `backend/.env.example`).
- Example env files are provided in `backend/.env.example` and `frontend/.env.example`.

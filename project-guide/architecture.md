# Architecture Overview

The TimeStamp application follows a classic Client-Server architecture.

## Frontend (React)

The frontend is built with React and managed using `react-scripts`. It is located in the `frontend/` directory.

- **Components**: Reusable UI elements like `Header`, `TimeLogsTable`, and `ClerkTokenBridge`.
- **Pages**: Main views like `AdminDashboard`, `CaregiverDashboard`, and `LoginPage`.
- **Services**: API interaction logic using `axios` and token management.
- **Context**: (If applicable) Global state management.

### Key flows

- **Authentication**: Clerk is used on the frontend. The app exchanges Clerk session tokens with the backend via the `Authorization` header.
- **Admin printable reports**: Admins can build a print-friendly report from captured punches (read-only) and optionally print one page per caregiver.
- **Missed punch requests**: Caregivers can request a missing punch (e.g., punch-out). Admins approve/reject. Approvals create an overlay record so reports/logs can show an effective punch time without editing the original time entry.

## Backend (Node.js & Express)

The backend is a RESTful API built with Express, located in the `backend/` directory.

- **Models**: Mongoose schemas for `User`, `Caregiver`, and `TimeEntry`.
- **Controllers**: Logic for handling requests and interacting with the database.
- **Routes**: API endpoint definitions (e.g., `/api/auth`, `/api/caregivers`, `/api/punches`).
- **Middleware**: Authentication and role-based access control (RBAC).

### Auth & RBAC

- **Preferred**: Clerk token verification when `CLERK_SECRET_KEY` is configured.
- **Fallback**: legacy JWT logic is kept to avoid breaking older flows during migration.
- **Roles**: `admin` vs `caregiver`, sourced from Clerk `publicMetadata.role` when available.

## Data Flow

1. The user interacts with the React frontend.
2. The frontend makes HTTP requests to the Express backend using `axios`.
3. The backend validates the request (JWT/Clerk authentication).
4. The backend performs CRUD operations on the MongoDB database.
5. The backend sends a JSON response back to the frontend.
6. The frontend updates the UI based on the response.

### Printing data without mutating punches

Time entries are treated as system-captured records. When a missed punch is approved, the backend stores an overlay “effective time” record and returns `effectivePunchIn`/`effectivePunchOut` in responses. This keeps original punches intact while allowing accurate reporting.

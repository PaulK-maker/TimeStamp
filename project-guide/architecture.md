# Architecture Overview

The TimeStamp application follows a classic Client-Server architecture.

## Frontend (React)

The frontend is built with React and managed using `react-scripts`. It is located in the `frontend/` directory.

- **Components**: Reusable UI elements like `Header`, `TimeLogsTable`, and `ClerkTokenBridge`.
- **Pages**: Main views like `AdminDashboard`, `CaregiverDashboard`, and `LoginPage`.
- **Services**: API interaction logic using `axios` and token management.
- **Context**: (If applicable) Global state management.

## Backend (Node.js & Express)

The backend is a RESTful API built with Express, located in the `backend/` directory.

- **Models**: Mongoose schemas for `User`, `Caregiver`, and `TimeEntry`.
- **Controllers**: Logic for handling requests and interacting with the database.
- **Routes**: API endpoint definitions (e.g., `/api/auth`, `/api/caregivers`, `/api/punches`).
- **Middleware**: Authentication and role-based access control (RBAC).

## Data Flow

1. The user interacts with the React frontend.
2. The frontend makes HTTP requests to the Express backend using `axios`.
3. The backend validates the request (JWT/Clerk authentication).
4. The backend performs CRUD operations on the MongoDB database.
5. The backend sends a JSON response back to the frontend.
6. The frontend updates the UI based on the response.

# Setup Guide

Follow these steps to get the TimeStamp project running on your local machine.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [MongoDB](https://www.mongodb.com/try/download/community) (Local instance or MongoDB Atlas)
- npm (comes with Node.js)

## Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend` folder and add the following variables:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   # Required if the frontend uses Clerk
   CLERK_SECRET_KEY=your_clerk_secret_key
   # Optional but recommended
   CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `frontend` folder and add:
   ```env
   REACT_APP_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   # Optional override (NO /api suffix)
   REACT_APP_API_BASE_URL=http://localhost:5000
   ```
4. Start the React application:
   ```bash
   npm start
   ```

## Running Both Simultaneously

You can open two terminal windows, one for the backend and one for the frontend, and run the start commands in each.

## If Sign-In "Works" But You Get Unauthorized

If you sign in via Clerk and then see an Unauthorized error on `/post-sign-in`, it means the backend cannot validate the Clerk session token.

- Ensure `backend/.env` includes `CLERK_SECRET_KEY=...`
- Restart the backend (`npm run dev`)
- Confirm MongoDB is running (the backend maps Clerk users to a Caregiver record)

import React from "react";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";
import Calendar from "../components/Calendar";

export default function CalendarPage() {
  return (
    <>
      <SignedIn>
        <div className="container">
          <h1 className="pageTitle">Calendar</h1>
          <p className="pageSubtitle">
            A small planner for personal notes (saved locally in this browser).
          </p>
          <Calendar />
        </div>
      </SignedIn>
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>
    </>
  );
}

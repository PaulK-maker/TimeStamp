// // src/App.js
// import React from "react";
// import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
// import LoginPage from "./pages/LoginPage";
// import AdminDashboard from "./pages/AdminDashboard";

// function App() {
//   return (
//     <Router>
//       <Routes>
//         {/* Redirect "/" to /login */}
//         <Route path="/" element={<Navigate to="/login" replace />} />
        
//         {/* Login page */}
//         <Route path="/login" element={<LoginPage />} />

//         {/* Admin dashboard */}
//         <Route path="/admin" element={<AdminDashboard />} />

//         {/* Catch-all route for unknown URLs */}
//         <Route path="*" element={<p>Page not found</p>} />
//       </Routes>
//     </Router>
//   );
// }

// export default App;


import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import CaregiverDashboard from "./pages/CaregiverDashboard"; // punch page
import AdminDashboard from "./pages/AdminDashboard";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import ClerkTokenBridge from "./components/ClerkTokenBridge";
import RequireAdmin from "./components/RequireAdmin";
import RequireAdminPlanSelected from "./components/RequireAdminPlanSelected";
import TopNav from "./components/TopNav";
import Footer from "./components/Footer";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import PostSignIn from "./pages/PostSignIn";
import SignOutPage from "./pages/SignOutPage";
import AboutUs from "./pages/AboutUs";
import ContactPage from "./pages/ContactPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CalendarPage from "./pages/CalendarPage";
import AdminPrintReportPage from "./pages/AdminPrintReportPage";
import AdminBillingPage from "./pages/AdminBillingPage";
import TenantSetupPage from "./pages/TenantSetupPage";
import RequireSuperadmin from "./components/RequireSuperadmin";
import SuperadminDashboard from "./pages/SuperadminDashboard";

function App() {
  return (
    <div className="appShell">
      <ClerkTokenBridge />
      <SignedIn>
        <TopNav />
      </SignedIn>
      <div className="appContent">
        <Routes>
          {/* Default route */}
          <Route
            path="/"
            element={
              <>
                <SignedIn>
                  <Navigate to="/post-sign-in" replace />
                </SignedIn>
                <SignedOut>
                  <Navigate to="/sign-in" replace />
                </SignedOut>
              </>
            }
          />

          {/* Clerk sign-in */}
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          <Route path="/post-sign-in" element={<PostSignIn />} />
          <Route path="/tenant-setup" element={<TenantSetupPage />} />
          <Route path="/sign-out" element={<SignOutPage />} />

          {/* Public info pages */}
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />

          {/* Signed-in tools */}
          <Route path="/calendar" element={<CalendarPage />} />

        {/* Legacy login routes -> Clerk */}
        <Route path="/login" element={<Navigate to="/sign-in" replace />} />
        <Route path="/caregiver-login" element={<Navigate to="/sign-in" replace />} />

        {/* Caregiver main page */}
        <Route
          path="/caregiver"
          element={
            <>
              <SignedIn>
                <CaregiverDashboard />
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" replace />
              </SignedOut>
            </>
          }
        />

        {/* Admin dashboard */}
        <Route
          path="/admin"
          element={
            <RequireAdminPlanSelected>
              <AdminDashboard />
            </RequireAdminPlanSelected>
          }
        />

        {/* Admin billing / plan selection */}
        <Route
          path="/admin/billing"
          element={
            <RequireAdmin>
              <AdminBillingPage />
            </RequireAdmin>
          }
        />

        {/* Admin printable reports */}
        <Route
          path="/admin/reports/print"
          element={
            <RequireAdminPlanSelected>
              <AdminPrintReportPage />
            </RequireAdminPlanSelected>
          }
        />

        {/* Superadmin (read-only) */}
        <Route
          path="/superadmin"
          element={
            <RequireSuperadmin>
              <SuperadminDashboard />
            </RequireSuperadmin>
          }
        />

          {/* Catch-all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

export default App;
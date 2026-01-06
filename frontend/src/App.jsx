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
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import CaregiverDashboard from "./pages/CaregiverDashboard"; // punch page
import AdminDashboard from "./pages/AdminDashboard";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import ClerkTokenBridge from "./components/ClerkTokenBridge";
import SignInPage from "./pages/SignInPage";
import PostSignIn from "./pages/PostSignIn";
import SignOutPage from "./pages/SignOutPage";

function App() {
  return (
    <Router>
      <ClerkTokenBridge />
      <Routes>
        {/* Default route */}
        <Route path="/" element={<Navigate to="/sign-in" replace />} />

        {/* Clerk sign-in */}
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/post-sign-in" element={<PostSignIn />} />
        <Route path="/sign-out" element={<SignOutPage />} />

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
            <>
              <SignedIn>
                <AdminDashboard />
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" replace />
              </SignedOut>
            </>
          }
        />

        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
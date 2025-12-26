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
// import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";               // admin login
import CaregiverLoginPage from "./pages/CaregiverLoginPage"; // new
import CaregiverDashboard from "./pages/CaregiverDashboard"; // punch page
import AdminDashboard from "./pages/AdminDashboard";

function App() {
  return (
    <Router>
      <Routes>
        {/* Admin login */}
        <Route path="/login" element={<LoginPage />} />

        {/* Caregiver login */}
        <Route path="/caregiver-login" element={<CaregiverLoginPage />} />

        {/* Caregiver main page */}
        <Route path="/caregiver" element={<CaregiverDashboard />} />

        {/* Admin dashboard */}
        <Route path="/admin" element={<AdminDashboard />} />

        {/* Optional: default route */}
        {/* <Route path="*" element={<Navigate to="/login" />} /> */}
      </Routes>
    </Router>
  );
}

export default App;
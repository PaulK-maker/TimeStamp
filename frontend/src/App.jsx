// import { BrowserRouter, Routes, Route } from "react-router-dom";
// import Login from "./pages/login";
// import AdminDashboard from "./pages/AdminDashboard";

// function App() {
//   return (
//     <BrowserRouter>
//       <Routes>
//         <Route path="/" element={<Login />} />
//         <Route path="/admin" element={<AdminDashboard />} />
//       </Routes>
//     </BrowserRouter>
//   );
// }

// export default App;

// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import PrivateRoute from "./components/PrivateRoute";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <AdminDashboard />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </Router>
  );
}

export default App;
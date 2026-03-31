import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import StudentDashboard from "./dashboards/StudentDashboard";
import AdminDashboard from "./dashboards/AdminDashboard";
import TechnicianDashboard from "./dashboards/TechnicianDashboard";
import { autoCloseResolvedIssues } from "./services/supabaseService";

function App() {
  useEffect(() => {
    // Run auto-close on app load
    autoCloseResolvedIssues();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/student"
          element={(
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/admin"
          element={(
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/technician"
          element={(
            <ProtectedRoute allowedRoles={["technician"]}>
              <TechnicianDashboard />
            </ProtectedRoute>
          )}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


/* export default App; */

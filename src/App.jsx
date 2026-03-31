import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import CitizenDashboard from "./dashboards/CitizenDashboard";
import AdminDashboard from "./dashboards/AdminDashboard";
import OfficerDashboard from "./dashboards/OfficerDashboard";
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
          path="/citizen"
          element={(
            <ProtectedRoute allowedRoles={["citizen"]}>
              <CitizenDashboard />
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
          path="/officer"
          element={(
            <ProtectedRoute allowedRoles={["officer"]}>
              <OfficerDashboard />
            </ProtectedRoute>
          )}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


/* export default App; */

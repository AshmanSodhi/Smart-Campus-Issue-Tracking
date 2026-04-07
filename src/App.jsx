import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useRef } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import CitizenDashboard from "./dashboards/CitizenDashboard";
import AdminDashboard from "./dashboards/AdminDashboard";
import OfficerDashboard from "./dashboards/OfficerDashboard";
import { autoCloseResolvedIssues } from "./services/supabaseService";
import { APP_CONFIG } from "./config/appConfig";

function App() {
  const hasRunAutoCloseRef = useRef(false);

  useEffect(() => {
    if (hasRunAutoCloseRef.current) {
      return;
    }
    hasRunAutoCloseRef.current = true;
    autoCloseResolvedIssues(APP_CONFIG.AUTO_CLOSE_DAYS);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
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

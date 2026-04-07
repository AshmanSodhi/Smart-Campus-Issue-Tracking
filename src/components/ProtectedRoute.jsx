import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { initializeAuthFromSession } from "../services/supabaseService";
import { normalizePortalRole } from "../config/appConfig";
import "./protected-route.css";

function ProtectedRoute({ allowedRoles, children }) {
  const [authReady, setAuthReady] = useState(false);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const resolvedRole = await initializeAuthFromSession();
        setRole(normalizePortalRole(resolvedRole));
      } catch {
        setRole(null);
      } finally {
        setAuthReady(true);
      }
    };

    bootstrapAuth();
  }, []);

  if (!authReady) {
    return <div className="auth-loading">Checking session...</div>;
  }

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;

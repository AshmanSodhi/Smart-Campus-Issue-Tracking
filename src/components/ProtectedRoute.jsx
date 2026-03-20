import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getRole, initializeAuthFromSession } from "../services/supabaseService";

function ProtectedRoute({ allowedRoles, children }) {
  const [authReady, setAuthReady] = useState(false);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const cachedRole = getRole();
        if (cachedRole) {
          setRole(cachedRole);
          setAuthReady(true);
          return;
        }

        const resolvedRole = await initializeAuthFromSession();
        setRole(resolvedRole);
      } catch {
        setRole(null);
      } finally {
        setAuthReady(true);
      }
    };

    bootstrapAuth();
  }, []);

  if (!authReady) {
    return <div style={{ padding: "24px", fontFamily: "Arial, sans-serif" }}>Checking session...</div>;
  }

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;

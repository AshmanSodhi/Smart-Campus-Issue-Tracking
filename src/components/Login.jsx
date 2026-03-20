import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  initializeAuthFromSession,
  isTestEmailLoginEnabled,
  loginWithEmailForTesting,
  signInWithGoogle,
} from "../services/supabaseService";
import "./login.css";

function Login() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [testEmail, setTestEmail] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const role = await initializeAuthFromSession();
        if (role === "student") {
          navigate("/student");
        } else if (role === "admin") {
          navigate("/admin");
        } else if (role === "technician") {
          navigate("/technician");
        }
      } catch (error) {
        setErrorMessage(error.message || "Login blocked: use your VIT student account.");
      }
    };

    restoreSession();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      await signInWithGoogle();
    } catch (error) {
      setErrorMessage(error.message || "Google login failed. Please try again.");
      setLoading(false);
    }
  };

  const handleTestEmailLogin = () => {
    setErrorMessage("");
    try {
      const role = loginWithEmailForTesting(testEmail);
      if (role === "student") {
        navigate("/student");
      } else if (role === "admin") {
        navigate("/admin");
      } else if (role === "technician") {
        navigate("/technician");
      }
    } catch (error) {
      setErrorMessage(error.message || "Test email login failed.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-shell">
        <section className="login-showcase" aria-label="Smart Campus introduction">
          <p className="showcase-kicker">Smart Campus</p>
          <h1>Issue Tracking and Resolution Hub</h1>
          <p>
            Report issues, follow progress, and collaborate with your campus operations teams
            from one workspace.
          </p>
          <div className="showcase-points">
            <span>Live status timeline</span>
            <span>Student, Admin, Technician dashboards</span>
            <span>Image-backed issue evidence</span>
          </div>
        </section>

        <section className="login-card" aria-label="Sign in to Smart Campus">
          <h2>Welcome Back</h2>
          <p className="login-subtitle">
            Continue with your campus Google account to access your dashboard.
          </p>

          <div className="portal-roles" aria-label="Portal role options">
            <span>Student</span>
            <span>Admin</span>
            <span>Technician</span>
          </div>

          <button onClick={handleGoogleLogin} disabled={loading}>
            {loading ? "Redirecting..." : "Continue with Google"}
          </button>

          {isTestEmailLoginEnabled() && (
            <>
              <div className="login-divider">or</div>
              <input
                type="email"
                placeholder="Temporary test email login"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <button className="secondary" onClick={handleTestEmailLogin} disabled={loading}>
                Login with Email (Temporary)
              </button>
            </>
          )}

          {errorMessage && <div className="login-error">{errorMessage}</div>}

          <div className="login-info">
            Use your <strong>@vitstudent.ac.in</strong> account. Google is primary login.
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  initializeAuthFromSession,
  loginWithEmailAndPassword,
  signInWithGoogle,
  submitTechnicianApplication,
} from "../services/supabaseService";
import "./login.css";

function Login() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [emailLoginInput, setTestEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showTechRegistration, setShowTechRegistration] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState("");
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [techForm, setTechForm] = useState({
    fullName: "",
    email: "",
    department: "",
    phone: "",
    reason: "",
  });

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

  const handleEmailPasswordLogin = async () => {
    setErrorMessage("");
    try {
      const role = await loginWithEmailAndPassword(emailLoginInput, adminPassword);
      if (role === "student") {
        navigate("/student");
      } else if (role === "admin") {
        navigate("/admin");
      } else if (role === "technician") {
        navigate("/technician");
      }
    } catch (error) {
      setErrorMessage(error.message || "Email/password login failed.");
    }
  };

  const updateTechField = (field, value) => {
    setTechForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleTechRegistration = async () => {
    setRegistrationMessage("");
    setErrorMessage("");
    setRegistrationLoading(true);

    try {
      await submitTechnicianApplication(techForm);
      setRegistrationMessage("Application submitted. Admin approval is required before technician login.");
      setTechForm({
        fullName: "",
        email: "",
        department: "",
        phone: "",
        reason: "",
      });
    } catch (error) {
      setErrorMessage(error.message || "Technician registration failed.");
    } finally {
      setRegistrationLoading(false);
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
            Students must use Google OAuth. Admin and Technician can login with email and password.
          </p>

          <div className="portal-roles" aria-label="Portal role options">
            <span>Student</span>
            <span>Admin</span>
            <span>Technician</span>
          </div>

          <button onClick={handleGoogleLogin} disabled={loading}>
            {loading ? "Redirecting..." : "Continue with Google"}
          </button>

          <div className="login-divider">or</div>
          <input
            type="email"
            placeholder="Admin/Technician email"
            value={emailLoginInput}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
          <button className="secondary" onClick={handleEmailPasswordLogin} disabled={loading}>
            Login with Email + Password
          </button>

          {errorMessage && <div className="login-error">{errorMessage}</div>}

          <button
            type="button"
            className="secondary registration-toggle"
            onClick={() => setShowTechRegistration((prev) => !prev)}
            disabled={registrationLoading || loading}
          >
            {showTechRegistration ? "Hide Technician Registration" : "Apply for Technician Access"}
          </button>

          {showTechRegistration && (
            <div className="tech-registration-panel">
              <h3>Technician Registration</h3>
              <p>Submit your details. Admin approval is required before technician login access is enabled.</p>

              <input
                placeholder="Full Name"
                value={techForm.fullName}
                onChange={(e) => updateTechField("fullName", e.target.value)}
                disabled={registrationLoading}
              />
              <input
                placeholder="Email"
                value={techForm.email}
                onChange={(e) => updateTechField("email", e.target.value)}
                disabled={registrationLoading}
              />
              <input
                placeholder="Department"
                value={techForm.department}
                onChange={(e) => updateTechField("department", e.target.value)}
                disabled={registrationLoading}
              />
              <input
                placeholder="Phone Number"
                value={techForm.phone}
                onChange={(e) => updateTechField("phone", e.target.value)}
                disabled={registrationLoading}
              />
              <textarea
                placeholder="Why do you need technician access?"
                value={techForm.reason}
                onChange={(e) => updateTechField("reason", e.target.value)}
                disabled={registrationLoading}
                rows={3}
              />

              <button type="button" onClick={handleTechRegistration} disabled={registrationLoading}>
                {registrationLoading ? "Submitting..." : "Submit Application"}
              </button>

              {registrationMessage && <div className="login-success">{registrationMessage}</div>}
            </div>
          )}

          <div className="login-info">
            Use Google for student access. Admin/technician access requires database role + password auth.
            <br />
            <button className="link-btn"onClick={() => navigate("/register")}>
              Apply for Technician Access (Dedicated Form)
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;

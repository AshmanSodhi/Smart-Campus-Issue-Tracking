import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  initializeAuthFromSession,
  loginWithEmailAndPassword,
  signInWithGoogle,
  submitTechnicianApplication,
} from "../services/supabaseService";
import { APP_CONFIG, normalizePortalRole } from "../config/appConfig";
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

  const navigateForRole = (roleValue) => {
    const role = normalizePortalRole(roleValue);
    if (role === APP_CONFIG.ROLES.CITIZEN) {
      navigate("/citizen");
      return;
    }
    if (role === APP_CONFIG.ROLES.ADMIN) {
      navigate("/admin");
      return;
    }
    if (role === APP_CONFIG.ROLES.OFFICER) {
      navigate("/officer");
    }
  };

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const role = await initializeAuthFromSession();
        navigateForRole(role);
      } catch (error) {
        setErrorMessage(error.message || "Login blocked: please use your government account.");
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
      navigateForRole(role);
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
      setRegistrationMessage("Application submitted. Admin approval is required before Government Officer login.");
      setTechForm({
        fullName: "",
        email: "",
        department: "",
        phone: "",
        reason: "",
      });
    } catch (error) {
      setErrorMessage(error.message || "Government Officer registration failed.");
    } finally {
      setRegistrationLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-shell">
        <section className="login-showcase" aria-label="Government Issue Tracking introduction">
          <div className="showcase-brand">
            <img src="/logo-verification.svg" alt="Government Issue Tracking logo" className="showcase-logo" />
            <span>{APP_CONFIG.APP_NAME}</span>
          </div>
          <p className="showcase-kicker">Government Issue Tracking</p>
          <h1>Issue Tracking and Resolution Hub</h1>
          <p>
            Report issues, follow progress, and collaborate with government agencies
            from one workspace.
          </p>
          <div className="showcase-points">
            <span>Live status timeline</span>
            <span>Citizen, Admin, Government Officer dashboards</span>
            <span>Image-backed issue evidence</span>
          </div>
        </section>

        <section className="login-card" aria-label="Sign in to Government Issue Tracking">
          <h2>Welcome Back</h2>
          <p className="login-subtitle">
            Citizens must use Google OAuth. Admin and Government Officers can login with email and password.
          </p>

          <div className="portal-roles" aria-label="Portal role options">
            <span>Citizen</span>
            <span>Admin</span>
            <span>Government Officer</span>
          </div>

          <button onClick={handleGoogleLogin} disabled={loading}>
            {loading ? "Redirecting..." : "Continue with Google"}
          </button>

          <div className="login-divider">or</div>
          <input
            id="emailLoginInput"
            name="emailLoginInput"
            type="email"
            placeholder="Admin/Government Officer email"
            value={emailLoginInput}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <input
            id="adminPassword"
            name="adminPassword"
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
            {showTechRegistration ? "Hide Government Officer Registration" : "Apply for Government Officer Access"}
          </button>

          {showTechRegistration && (
            <div className="tech-registration-panel">
              <h3>Government Officer Registration</h3>
              <p>Submit your details. Admin approval is required before officer login access is enabled.</p>

              <input
                id="techFormFullName"
                name="techFormFullName"
                placeholder="Full Name"
                value={techForm.fullName}
                onChange={(e) => updateTechField("fullName", e.target.value)}
                disabled={registrationLoading}
              />
              <input
                id="techFormEmail"
                name="techFormEmail"
                placeholder="Email"
                value={techForm.email}
                onChange={(e) => updateTechField("email", e.target.value)}
                disabled={registrationLoading}
              />
              <input
                id="techFormDepartment"
                name="techFormDepartment"
                placeholder="Department"
                value={techForm.department}
                onChange={(e) => updateTechField("department", e.target.value)}
                disabled={registrationLoading}
              />
              <input
                id="techFormPhone"
                name="techFormPhone"
                placeholder="Phone Number"
                value={techForm.phone}
                onChange={(e) => updateTechField("phone", e.target.value)}
                disabled={registrationLoading}
              />
              <textarea
                id="techFormReason"
                name="techFormReason"
                placeholder="Why do you need officer access?"
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
            Use Google for citizen access. Admin/officer access requires database role + password auth.
            <br />
            <button className="link-btn" onClick={() => navigate("/register")}>
              Apply for Officer Access (Dedicated Form)
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;

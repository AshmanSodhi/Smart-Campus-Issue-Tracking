import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { initializeAuthFromSession, signInWithGoogle } from "../services/supabaseService";
import "./login.css";

function Login() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const role = await initializeAuthFromSession();
        if (role === "student") {
          navigate("/student");
        } else if (role === "admin") {
          navigate("/admin");
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

  return (

    <div className="login-container">

      <div className="login-card">

        <h2>Smart Campus System</h2>

        <button onClick={handleGoogleLogin} disabled={loading}>
          {loading ? "Redirecting..." : "Continue with Google"}
        </button>

        {errorMessage && <div className="login-error">{errorMessage}</div>}

        <div className="login-info">
          Use your <strong>@vitstudent.ac.in</strong> Google account.
        </div>

      </div>

    </div>

  );
}

export default Login;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestPasswordReset } from "../services/supabaseService";
import "./password-reset.css";

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await requestPasswordReset(email);
      setMessage("Reset link sent. Check your email and open the link to set a new password.");
    } catch (err) {
      setError(err.message || "Unable to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="password-page">
      <div className="password-card">
        <h1>Forgot Password</h1>
        <p>Enter your admin/officer email and we will send you a password reset link.</p>

        {error && <div className="password-error">{error}</div>}
        {message && <div className="password-success">{message}</div>}

        <form onSubmit={handleSubmit} className="password-form">
          <label htmlFor="resetEmail">Email</label>
          <input
            id="resetEmail"
            name="resetEmail"
            type="email"
            placeholder="name@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <button type="button" className="plain-link" onClick={() => navigate("/")}>
          Back to Login
        </button>
      </div>
    </div>
  );
}

export default ForgotPassword;

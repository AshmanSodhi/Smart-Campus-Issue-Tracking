import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  establishRecoverySessionFromUrl,
  updateCurrentUserPassword,
} from "../services/supabaseService";
import "./password-reset.css";

function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checkingLink, setCheckingLink] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const validateRecoveryLink = async () => {
      setCheckingLink(true);
      setError("");

      try {
        const hasSession = await establishRecoverySessionFromUrl();
        if (!hasSession) {
          setError("This reset link is invalid or expired. Please request a new link.");
          setRecoveryReady(false);
          return;
        }

        setRecoveryReady(true);
      } catch (err) {
        setError(err.message || "Reset link validation failed.");
        setRecoveryReady(false);
      } finally {
        setCheckingLink(false);
      }
    };

    validateRecoveryLink();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await updateCurrentUserPassword(newPassword);
      setMessage("Password updated successfully. Redirecting to login...");
      setTimeout(() => navigate("/"), 1500);
    } catch (err) {
      setError(err.message || "Unable to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="password-page">
      <div className="password-card">
        <h1>Reset Password</h1>
        <p>Create a new password for your account.</p>

        {checkingLink && <div className="password-info">Validating reset link...</div>}
        {error && <div className="password-error">{error}</div>}
        {message && <div className="password-success">{message}</div>}

        {recoveryReady && !checkingLink && (
          <form onSubmit={handleSubmit} className="password-form">
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading}
            />

            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />

            <button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}

        <button type="button" className="plain-link" onClick={() => navigate("/")}>
          Back to Login
        </button>
      </div>
    </div>
  );
}

export default ResetPassword;

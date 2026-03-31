import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { submitTechnicianApplication } from "../services/supabaseService";
import "./register.css";

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    department: "",
    phone: "",
    reason: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await submitTechnicianApplication(formData);
      setMessage(
        "Registration submitted successfully! Admins will review your application."
      );
      setFormData({
        fullName: "",
        email: "",
        department: "",
        phone: "",
        reason: "",
      });
      setTimeout(() => navigate("/"), 3000);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-box">
        <h1>Technician Registration</h1>
        <p className="register-subtitle">
          Apply for technician access to help manage campus issues
        </p>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="fullName">Full Name *</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              placeholder="John Doe"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="your.email@campus.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="department">Department *</label>
            <input
              type="text"
              id="department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
              placeholder="e.g., Maintenance, IT"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number *</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reason">Why do you want technician access? *</label>
            <textarea
              id="reason"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              required
              placeholder="Describe your role and why you need technician access..."
              rows="4"
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? "Submitting..." : "Submit Application"}
          </button>
        </form>

        <p className="back-to-login">
          Already have access?{" "}
          <button
            onClick={() => navigate("/")}
            className="link-button"
          >
            Back to Login
          </button>
        </p>
      </div>
    </div>
  );
}

export default Register;

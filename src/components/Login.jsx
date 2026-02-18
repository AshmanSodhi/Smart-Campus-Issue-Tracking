import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/authService";
import "./login.css";

function Login() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const handleLogin = () => {

    const role = login(email, password);

    if (role === "student") {
      navigate("/student");
    }
    else if (role === "admin") {
      navigate("/admin");
    }
    else {
      alert("Invalid Credentials");
    }
  };

  return (

    <div className="login-container">

      <div className="login-card">

        <h2>Smart Campus System</h2>

        <input
          type="email"
          placeholder="Email"
          onChange={(e) =>
            setEmail(e.target.value)
          }
        />

        <input
          type="password"
          placeholder="Password"
          onChange={(e) =>
            setPassword(e.target.value)
          }
        />

        <button onClick={handleLogin}>
          Login
        </button>

        <div className="login-info">
          Student: student@campus.com / 1234
          <br />
          Admin: admin@campus.com / 1234
        </div>

      </div>

    </div>

  );
}

export default Login;

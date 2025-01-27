import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Login.css";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
        const response = await axios.post("http://localhost:4000/api/login", { // ✅ Fixed URL
            username,
            password
        });

        if (response.data && response.data.userId) {
            localStorage.setItem("isAuthenticated", "true");
            localStorage.setItem("username", response.data.username);
            navigate("/dashboard");
        } else {
            setError("Invalid username or password.");
        }
    } catch (error) {
        setError("Login failed. Please check your credentials.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <img src="/logo.ico" alt="OnBoard360 Logo" className="login-logo" />
        <h2>Welcome to OnBoard360</h2>
        <p className="subtitle">Login to access your dashboard</p>

        {error && <p className="error-message">{error}</p>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
            />
          </div>
          <div className="form-group password-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          <button type="submit" className="login-button">Login</button>
        </form>
      </div>
    </div>
  );
};

export default Login;

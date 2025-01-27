import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Login.css";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState("Local"); // Default to Local
  const [domains, setDomains] = useState([]); // Store domains
  const [error, setError] = useState("");
  const [domainError, setDomainError] = useState(""); // Show if domain is not found
  const [formattedUsername, setFormattedUsername] = useState(""); // Store extracted username
  const [isDropdownDisabled, setIsDropdownDisabled] = useState(false); // Control dropdown

  const navigate = useNavigate();

  // Fetch available domains from the database
  useEffect(() => {
    const fetchDomains = async () => {
      try {
        const response = await axios.get("http://localhost:4000/api/domains");
        setDomains(response.data); // Set domains from API
      } catch (err) {
        console.error("Error fetching domains:", err);
      }
    };
    fetchDomains();
  }, []);

  // Handle Username Change & Auto-Select Domain
  const handleUsernameChange = (e) => {
    let input = e.target.value;
    setUsername(input); // Keep the full input in the UI

    if (input.includes("\\")) {
      const [enteredDcName, extractedUsername] = input.split("\\");

      if (enteredDcName === ".") {
        // If user enters .\username, force select Local
        setAccountType("Local");
        setIsDropdownDisabled(true);
        setFormattedUsername(extractedUsername); // Store extracted username
        setDomainError(""); // Clear domain error
      } else {
        // Handle LDAP domain selection
        const matchedDomain = domains.find(domain => domain.dc_name.toLowerCase() === enteredDcName.toLowerCase());

        if (matchedDomain) {
          setAccountType(matchedDomain.id);
          setDomainError(""); // Clear error if domain is found
          setIsDropdownDisabled(true); // Disable dropdown for LDAP
        } else {
          setDomainError(`Entered domain "${enteredDcName}" not available.`);
          setIsDropdownDisabled(false);
        }

        setFormattedUsername(extractedUsername); // Store extracted username separately
      }
    } else {
      // Reset to default if user removes domain prefix
      setDomainError("");
      setFormattedUsername(input);
      setIsDropdownDisabled(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      let loginData = { username: formattedUsername, password };

      if (accountType !== "Local") {
        // Domain account login
        loginData.domain_id = accountType;
        const response = await axios.post("http://localhost:4000/api/ldapusers_login", loginData);

        if (response.data && response.data.success) {
          localStorage.setItem("isAuthenticated", "true");
          localStorage.setItem("username", response.data.user.username);
          navigate("/dashboard");
        } else {
          setError(response.data.error || "Domain login failed.");
        }
      } else {
        // Local account login
        const response = await axios.post("http://localhost:4000/api/login", loginData);

        if (response.data && response.data.userId) {
          localStorage.setItem("isAuthenticated", "true");
          localStorage.setItem("username", response.data.username);
          navigate("/dashboard");
        } else {
          setError("Invalid username or password.");
        }
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
              onChange={handleUsernameChange}
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

          {/* Account Type Dropdown */}
          <div className="account-type-container">
            <label>Account Type:</label>
            <select 
              value={accountType} 
              onChange={(e) => setAccountType(e.target.value)} 
              disabled={isDropdownDisabled} // Disable dropdown when dc_name\username or .\username is entered
            >
              <option value="Local">Local</option>
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.dc_name}
                </option>
              ))}
            </select>
          </div>

          {/* Domain Error Message */}
          {domainError && <p className="error-message">{domainError}</p>}

          <button type="submit" className="login-button">Login</button>
        </form>
      </div>
    </div>
  );
};

export default Login;

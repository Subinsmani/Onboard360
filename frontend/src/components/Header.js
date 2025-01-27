import React, { useState } from "react";
import { Link } from "react-router-dom";
import Profile from "./Profile";

const Header = () => {
  const [hoveredLink, setHoveredLink] = useState(null);

  // Styles
  const headerStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2c3e50",
    padding: "0.5em 2em",
    color: "white",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  };

  const logoContainerStyle = {
    display: "flex",
    alignItems: "center",
    gap: "0.5em",
  };

  const logoStyle = {
    width: "32px",
    height: "32px",
  };

  const logoTextStyle = {
    fontSize: "1.5em",
    fontWeight: "bold",
    color: "#e67e22",
  };

  const navStyle = {
    display: "flex",
    gap: "1.5em",
  };

  const linkStyle = {
    textDecoration: "none",
    color: "white",
    fontSize: "1em",
    transition: "color 0.3s ease",
  };

  const linkHoverStyle = {
    ...linkStyle,
    color: "#e67e22",
  };

  const userSettingsStyle = {
    display: "flex",
    alignItems: "center",
    gap: "1em",
  };

  const inputStyle = {
    padding: "0.5em",
    border: "none",
    borderRadius: "5px",
    outline: "none",
    marginBottom: "0px",
  };

  return (
    <header style={headerStyle}>
      {/* Logo Section */}
      <div style={logoContainerStyle}>
        <img src="/logo.ico" alt="Logo" style={logoStyle} />
        <div style={logoTextStyle}>Onboard360</div>
      </div>

      {/* Navigation Links */}
      <nav style={navStyle}>
        <Link
          to="/dashboard"
          style={hoveredLink === "dashboard" ? linkHoverStyle : linkStyle}
          onMouseEnter={() => setHoveredLink("dashboard")}
          onMouseLeave={() => setHoveredLink(null)}
        >
          Dashboard
        </Link>
        <Link
          to="/admin"
          style={hoveredLink === "admin" ? linkHoverStyle : linkStyle}
          onMouseEnter={() => setHoveredLink("admin")}
          onMouseLeave={() => setHoveredLink(null)}
        >
          Admin
        </Link>
      </nav>

      {/* User Settings Section */}
      <div style={userSettingsStyle}>
        <input type="text" placeholder="Search Employee" style={inputStyle} />
        <Profile /> {/* ✅ Profile Dropdown Component */}
      </div>
    </header>
  );
};

export default Header;

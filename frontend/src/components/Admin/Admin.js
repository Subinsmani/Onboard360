import React, { useState } from "react";
import UserManagement from "./UserManagement/UserManagement";
import "./Admin.css";

const Admin = () => {
  const [selectedTab, setSelectedTab] = useState("dashboard");

  return (
    <div className="admin-container">
      {/* Left Panel */}
      <aside className="left-panel">
        <nav className="nav-menu">
          <button
            className={`nav-button ${selectedTab === "user-management" ? "selected" : ""}`}
            onClick={() => setSelectedTab("user-management")}
          >
            User Management
          </button>
        </nav>
      </aside>

      {/* Main Admin Content */}
      <main className="admin-content">
        {selectedTab === "dashboard" && (
          <>
            <h1 className="admin-title">Admin Panel</h1>
            <p className="admin-text">
              Welcome to the Admin panel. Manage users, roles, and settings here.
            </p>
          </>
        )}

        {selectedTab === "user-management" && <UserManagement />}
      </main>
    </div>
  );
};

export default Admin;

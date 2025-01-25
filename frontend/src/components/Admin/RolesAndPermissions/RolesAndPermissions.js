import React, { useState, useEffect } from "react";
import axios from "axios";
import "./RolesAndPermissions.css";

const RolesAndPermissions = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);

  useEffect(() => {
    fetchRolePermissions();
  }, []);

  // ✅ Fetch roles with permissions from backend
  const fetchRolePermissions = async () => {
    try {
      const response = await axios.get("http://localhost:4000/api/role_permissions");
      const uniqueRoles = response.data.reduce((acc, role) => {
        const exists = acc.find(
          (r) => r.role_id === role.role_id && r.permission_id === role.permission_id
        );
        if (!exists) acc.push(role);
        return acc;
      }, []);

      setRoles(uniqueRoles);
      setLoading(false);
    } catch (error) {
      console.error("❌ Error fetching role permissions:", error);
      setError("Failed to load roles and permissions.");
      setLoading(false);
    }
  };

  /**
   * Handle role selection via checkbox.
   * @param {number} roleId - The ID of the selected role.
   */
  const handleCheckboxChange = (roleId) => {
    setSelectedRole((prevSelected) => (prevSelected === roleId ? null : roleId));
  };

  return (
    <div className="roles-management-container">
      <div className="roles-management-header">
        <button className="add-role-btn">+ Add Role</button>
      </div>

      {/* Display Error Message */}
      {error && <p className="error-message">{error}</p>}

      {/* Display Loading Indicator or Roles Table */}
      {loading ? (
        <p className="loading-message">Loading roles...</p>
      ) : (
        <div className="table-container">
          <table className="roles-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Role Name</th>
                <th>Permissions</th>
              </tr>
            </thead>
            <tbody>
              {roles.length > 0 ? (
                roles.map((role, index) => (
                  <tr key={`${role.role_id}-${index}`}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedRole === role.role_id}
                        onChange={() => handleCheckboxChange(role.role_id)}
                      />
                    </td>
                    <td>{role.role_name}</td>
                    <td>{role.permission_name || "N/A"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="no-roles">No roles found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RolesAndPermissions;

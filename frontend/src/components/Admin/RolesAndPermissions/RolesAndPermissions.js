import React, { useState, useEffect } from "react";
import axios from "axios";
import "./RolesAndPermissions.css";
import NewRole from "./NewRole";
import ManageRole from "./ManageRole";

const RolesAndPermissions = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  const [isNewRoleOpen, setIsNewRoleOpen] = useState(false);
  const [isManageRoleOpen, setIsManageRoleOpen] = useState(false);

  useEffect(() => {
    fetchRolesWithPermissions();
  }, []);

  // Fetch roles and merge with permissions
  const fetchRolesWithPermissions = async () => {
    try {
      const rolesResponse = await axios.get("http://localhost:4000/api/roles");
      const permissionsResponse = await axios.get("http://localhost:4000/api/role_permissions");
      
      const allRoles = Array.isArray(rolesResponse.data) ? rolesResponse.data : [];
      const rolePermissions = Array.isArray(permissionsResponse.data) ? permissionsResponse.data : [];

      // Merge roles with their permissions
      const mergedRoles = allRoles.map((role) => {
        const matchedRole = rolePermissions.find((rp) => rp.role_id === role.id);
        return {
          role_id: role.id,
          role_name: role.roles_name,
          permissions: matchedRole ? matchedRole.permissions : "N/A",
        };
      });

      // Sort roles by role_id in ascending order
      mergedRoles.sort((a, b) => a.role_id - b.role_id);

      setRoles(mergedRoles);
      setLoading(false);
    } catch (error) {
      setError("Failed to load roles and permissions.");
      setLoading(false);
    }
  };

  // Handle role selection via checkbox
  const handleCheckboxChange = (roleId) => {
    setSelectedRole((prevSelected) => (prevSelected === roleId ? null : roleId));
  };

  return (
    <div className="roles-management-container">
      <div className="roles-management-header">
        <div className="header-left">
          <button 
            className="manage-role-btn"
            onClick={() => setIsManageRoleOpen(true)}
            disabled={!selectedRole}
          >
            Manage Roles
          </button>
        </div>
        <button className="add-role-btn" onClick={() => setIsNewRoleOpen(true)}>
          + Add Role
        </button>
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
                        disabled={role.role_id === 1} // Disable checkbox for role_id = 1
                      />
                    </td>
                    <td>{role.role_name}</td>
                    <td>{role.permissions || "N/A"}</td>
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

      {/* New Role Modal */}
      <NewRole 
        isOpen={isNewRoleOpen} 
        onClose={() => setIsNewRoleOpen(false)} 
        onRoleAdded={fetchRolesWithPermissions} 
      />

      {/* Manage Role Modal */}
      {isManageRoleOpen && (
        <ManageRole 
          isOpen={isManageRoleOpen} 
          onClose={() => setIsManageRoleOpen(false)} 
          selectedRoleId={selectedRole} 
          onRoleUpdated={fetchRolesWithPermissions} 
        />
      )}
    </div>
  );
};

export default RolesAndPermissions;

import React, { useState, useEffect } from "react";
import axios from "axios";
import "./NewRole.css";

const ManageRole = ({ isOpen, onClose, selectedRoleId, onRoleUpdated }) => {
  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && selectedRoleId) {
      fetchRoleDetails();
      fetchPermissions();
    }
  }, [isOpen, selectedRoleId]);

  // Fetch all available permissions
  const fetchPermissions = async () => {
    try {
      const response = await axios.get("http://localhost:4000/api/permissions");
      setPermissions(response.data);
    } catch (error) {
      setError("Failed to load permissions.");
    }
  };

  // Fetch role details including role name and assigned permissions
  const fetchRoleDetails = async () => {
    try {
      // Fetch the role name first
      const roleResponse = await axios.get(`http://localhost:4000/api/roles/${selectedRoleId}`);
      setRoleName(roleResponse.data.roles_name);

      // Fetch role permissions
      const permissionsResponse = await axios.get("http://localhost:4000/api/role_permissions");
      const rolePermissions = permissionsResponse.data.find((role) => role.role_id === selectedRoleId);

      setSelectedPermissions(rolePermissions ? rolePermissions.permissions.split(", ").map((perm) => perm.trim()) : []);
    } catch (error) {
      setError("Role not found or unable to fetch details.");
    }
  };

  // Toggle permission selection
  const togglePermission = (permissionName) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionName)
        ? prev.filter((perm) => perm !== permissionName)
        : [...prev, permissionName]
    );
  };

  // Update Role Permissions - Handles Missing Permissions & Allows Updates
  const handleUpdateRole = async () => {
    if (!selectedRoleId) {
      setError("Invalid role selection.");
      return;
    }

    if (selectedPermissions.length === 0) {
      setError("At least one permission must be selected.");
      return;
    }

    try {
      // Step 1: Attempt to delete existing permissions
      await axios.delete(`http://localhost:4000/api/role_permissions/${selectedRoleId}`).catch(error => {
        // Fix: If delete fails with 404, allow adding new permissions
        if (error.response && error.response.status === 404) {
          console.warn("No existing permissions found, continuing with update.");
        } else {
          throw error; // If other error, stop execution
        }
      });

      // Step 2: Add new permissions for this role if any are selected
      await axios.post("http://localhost:4000/api/role_permissions", {
        role_id: selectedRoleId,
        permission_ids: selectedPermissions.map((perm) => {
          const foundPermission = permissions.find((p) => p.name === perm);
          return foundPermission ? foundPermission.id : null;
        }).filter(id => id !== null)
      });

      onRoleUpdated();
      onClose();
    } catch (error) {
      setError("Failed to update permissions.");
    }
  };

  // Delete Role
  const handleDeleteRole = async () => {
    if (!selectedRoleId) return;

    try {
      await axios.delete(`http://localhost:4000/api/roles/${selectedRoleId}`);
      onRoleUpdated();
      onClose();
    } catch (error) {
      setError("Failed to delete role.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Manage Role</h2>
        {error && <p className="error-message">{error}</p>}

        {/* Role Name Display */}
        <label>Role Name:</label>
        <input type="text" value={roleName} disabled />

        {/* Permissions List with Clickable Selection */}
        <div className="permissions-list-container">
          <h3>Assigned Permissions</h3>
          <ul className="permissions-list">
            {permissions.length > 0 ? (
              permissions.map((permission) => (
                <li
                  key={permission.id}
                  className={selectedPermissions.includes(permission.name) ? "selected" : ""}
                  onClick={() => togglePermission(permission.name)}
                >
                  {permission.name}
                </li>
              ))
            ) : (
              <p className="no-permissions">No permissions found.</p>
            )}
          </ul>
        </div>

        {/* Button UI */}
        <div className="modal-buttons">
          <button onClick={handleUpdateRole} disabled={!selectedRoleId || selectedPermissions.length === 0}>
            Update
          </button>
          <button className="delete-btn" onClick={handleDeleteRole} disabled={!selectedRoleId}>
            Delete
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ManageRole;

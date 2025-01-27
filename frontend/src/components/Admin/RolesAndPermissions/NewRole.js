import React, { useState, useEffect } from "react";
import axios from "axios";
import "./NewRole.css";

const NewRole = ({ isOpen, onClose, onRoleAdded }) => {
  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchPermissions();
    }
  }, [isOpen]);

  const fetchPermissions = async () => {
    try {
      const response = await axios.get("http://localhost:4000/api/permissions");
      setPermissions(response.data);
    } catch (error) {
      console.error("Failed to fetch permissions:", error);
      setError("Failed to load permissions.");
    }
  };

  const handleAddRole = async () => {
    if (!roleName.trim()) {
      setError("Role name is required.");
      return;
    }

    if (selectedPermissions.length === 0) {
      setError("At least one permission must be selected.");
      return;
    }

    try {
      // Add Role with selected permissions
      const response = await axios.post("http://localhost:4000/api/roles_create", {
        name: roleName.trim(),
        permissions: selectedPermissions
      });

      if (response.data.roleId) {
        onRoleAdded();
        setRoleName("");
        setSelectedPermissions([]);
        setError("");
        onClose();
      }
    } catch (error) {
      setError("Failed to create role.");
    }
  };

  const togglePermission = (permissionId) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Add New Role</h2>
        {error && <p className="error-message">{error}</p>}
        
        <label>Role Name:</label>
        <input 
          type="text" 
          value={roleName} 
          onChange={(e) => setRoleName(e.target.value)} 
        />

        {/* Scrollable Permissions List */}
        <div className="permissions-list-container">
          <h3>Select Permissions</h3>
          <ul className="permissions-list">
            {permissions.length > 0 ? (
              permissions.map((permission) => (
                <li 
                  key={permission.id}
                  className={selectedPermissions.includes(permission.id) ? "selected" : ""}
                  onClick={() => togglePermission(permission.id)}
                >
                  {permission.name}
                </li>
              ))
            ) : (
              <p className="no-permissions">No permissions found.</p>
            )}
          </ul>
        </div>

        <div className="modal-buttons">
          <button onClick={handleAddRole} disabled={!roleName.trim() || selectedPermissions.length === 0}>
            Add
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default NewRole;

// ManageGroup.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import "./ManageGroup.css";

const ManageGroup = ({ groupId, onClose, onGroupDeleted, onRoleUpdated }) => {
  // User Management State Variables
  const [allUsers, setAllUsers] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupName, setGroupName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Roles Management State Variables
  const [availableRoles, setAvailableRoles] = useState([]);
  const [groupRoles, setGroupRoles] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedGroupRoles, setSelectedGroupRoles] = useState([]);

  useEffect(() => {
    if (groupId) {
      loadGroupDetailsAndUsers();
      loadRoles(); // Load roles when groupId changes
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  /**
   * Fetch group details and members, then all users excluding current members.
   */
  const loadGroupDetailsAndUsers = async () => {
    try {
      setLoading(true);
      setError("");

      // Fetch group details
      const groupResponse = await axios.get(`http://localhost:4000/api/groups/${groupId}`);
      const groupData = groupResponse.data;
      setGroupName(groupData.name); // Set group name

      // Fetch group members
      const membersResponse = await axios.get(`http://localhost:4000/api/groups/${groupId}/members`);
      setGroupMembers(membersResponse.data);

      // Extract member identifiers to exclude from all users
      const memberIds = membersResponse.data.map(user => `${user.id}-${user.type.toLowerCase()}`);

      // Fetch all users
      const usersResponse = await axios.get("http://localhost:4000/api/users");
      const filteredUsers = usersResponse.data.filter(
        user => !memberIds.includes(`${user.id}-${user.type.toLowerCase()}`)
      );
      setAllUsers(filteredUsers);
    } catch (error) {
      console.error("❌ Error fetching data:", error.response?.data || error.message);
      setError("Failed to load group details or users.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🆕 Load Roles: Fetch all available roles and roles assigned to the group.
   */
  const loadRoles = async () => {
    try {
        setError("");

        // Fetch all available roles
        const rolesResponse = await axios.get("http://localhost:4000/api/roles");
        const allRoles = rolesResponse.data; // List of all roles with {id, roles_name}

        // Fetch the group's current role_id
        const groupResponse = await axios.get(`http://localhost:4000/api/groups/${groupId}/roles`);
        const roleData = groupResponse.data;

        // Ensure roleData is valid and map role_id to role details
        let assignedRoles = [];
        if (roleData && roleData.role_id) {
            const foundRole = allRoles.find(role => role.id === roleData.role_id);
            if (foundRole) {
                assignedRoles = [{ role_id: foundRole.id, role_name: foundRole.roles_name }];
            }
        }

        // Remove assigned roles from available roles list
        const filteredAvailableRoles = allRoles.filter(role => role.id !== roleData.role_id);

        // Update state
        setAvailableRoles(filteredAvailableRoles);
        setGroupRoles(assignedRoles); // Ensure this is an array

    } catch (error) {
        console.error("❌ Error fetching roles:", error.response?.data || error.message);
        setError("Failed to load roles.");
    }
};

  /**
   * 🆕 Handle selection of roles in the Available and Group Roles tables.
   * @param {number} roleId - The ID of the role.
   * @param {string} tableType - The table from which the role is selected ("available" or "group").
   */
  const handleRoleSelect = (roleId, tableType) => {
    if (tableType === "available") {
      setSelectedRoles(prev =>
        prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
      );
    } else if (tableType === "group") {
      setSelectedGroupRoles(prev =>
        prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
      );
    }
  };

  /**
   * 🆕 Add selected roles to the group.
   */
  const addRolesToGroup = async () => {
    if (selectedRoles.length === 0) {
      alert("⚠ No roles selected for addition.");
      return;
    }

    try {
      const roleId = selectedRoles[0];

      await axios.put(`http://localhost:4000/api/groups/${groupId}/update_role`, { role_id: roleId });

      setSelectedRoles([]);
      loadRoles(); // Reload roles inside ManageGroup

      if (onRoleUpdated) {
        onRoleUpdated();
      }
    } catch (error) {
      console.error("❌ Error adding role:", error.response?.data || error.message);
      alert("❌ Failed to add role.");
    }
  };

  /**
   * 🆕 Remove selected roles from the group.
   */
  const removeRolesFromGroup = async () => {
    if (selectedGroupRoles.length === 0) {
      alert("⚠ No roles selected for removal.");
      return;
    }

    try {
      const roleId = selectedGroupRoles[0];

      await axios.put(`http://localhost:4000/api/groups/${groupId}/remove_role`, { role_id: roleId });

      setSelectedGroupRoles([]);
      loadRoles(); // Reload roles inside ManageGroup

      if (onRoleUpdated) {
        onRoleUpdated();
      }
    } catch (error) {
      console.error("❌ Error removing role:", error.response?.data || error.message);
      alert("❌ Failed to remove role.");
    }
  };

  /**
   * Handle selection of users in the All Users and Group Members tables.
   * @param {number} userId - The ID of the user.
   * @param {string} userType - The type of user ("Local" or "LDAP").
   * @param {string} tableType - The table from which the user is selected ("all" or "group").
   */
  const handleUserSelect = (userId, userType, tableType) => {
    const userObject = { id: userId, type: userType.toLowerCase() };

    if (tableType === "all") {
      setSelectedUsers(prev =>
        prev.some(user => user.id === userObject.id && user.type === userObject.type)
          ? prev.filter(user => !(user.id === userObject.id && user.type === userObject.type))
          : [...prev, userObject]
      );
    } else if (tableType === "group") {
      setSelectedMembers(prev =>
        prev.some(user => user.id === userObject.id && user.type === userObject.type)
          ? prev.filter(user => !(user.id === userObject.id && user.type === userObject.type))
          : [...prev, userObject]
      );
    }
  };

  /**
   * Add selected users to the group.
   */
  const addUsersToGroup = async () => {
    if (selectedUsers.length === 0) {
      alert("⚠ No users selected for addition.");
      return;
    }

    try {
      const payload = { users: selectedUsers };
      await axios.post(`http://localhost:4000/api/groups/${groupId}/add`, payload);
      alert("✅ Users added successfully.");
      setSelectedUsers([]);
      loadGroupDetailsAndUsers();
    } catch (error) {
      console.error("❌ Error adding users to group:", error.response?.data || error.message);
      alert("❌ Failed to add users to the group.");
    }
  };

  /**
   * Remove selected members from the group.
   */
  const removeUsersFromGroup = async () => {
    if (selectedMembers.length === 0) {
      alert("⚠ No users selected for removal.");
      return;
    }

    try {
      const payload = { users: selectedMembers };
      await axios.post(`http://localhost:4000/api/groups/${groupId}/remove`, payload);
      alert("✅ Users removed successfully.");
      setSelectedMembers([]);
      loadGroupDetailsAndUsers();
    } catch (error) {
      console.error("❌ Error removing users from group:", error.response?.data || error.message);
      alert("❌ Failed to remove users from the group.");
    }
  };

  /**
   * Delete the entire group.
   */
  const deleteGroup = async () => {
    const confirmDelete = window.confirm("⚠️ Are you sure you want to delete this group? This action cannot be undone.");
    if (!confirmDelete) return;

    try {
      setIsDeleting(true);
      await axios.delete(`http://localhost:4000/api/groups/${groupId}`);
      alert("✅ Group deleted successfully.");
      if (onGroupDeleted) onGroupDeleted(groupId); // Notify parent component
      onClose(); // Close the popup
    } catch (error) {
      console.error("❌ Error deleting group:", error.response?.data || error.message);
      alert("❌ Failed to delete the group.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="popup-overlay"></div>

      <div className="popup">
        <div className="popup-content">
          {/* Display dynamic group name in the header */}
          <h2>Manage "{groupName}" Group Members</h2>

          {loading ? (
            <p>Loading...</p>
          ) : (
            <>
              {/* 🆕 Users Management Section */}
              <div className="manage-group-content">
                {/* All Users Table */}
                <div className="user-list">
                  <h3>All Local and Domain Users</h3>
                  <div className="scrollable-box">
                    <table className="user-table">
                      <thead>
                        <tr>
                          <th>Username</th>
                          <th>Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allUsers.length > 0 ? (
                          allUsers.map(user => (
                            <tr
                              key={`${user.id}-${user.type.toLowerCase()}`}
                              className={
                                selectedUsers.some(
                                  selected => selected.id === user.id && selected.type === user.type.toLowerCase()
                                )
                                  ? "selected"
                                  : ""
                              }
                              onClick={() => handleUserSelect(user.id, user.type, "all")}
                            >
                              <td>{user.name}</td>
                              <td>{user.type.toLowerCase() === "local" ? "Local" : "LDAP"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="2" className="no-users">
                              No users available
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="action-buttons">
                  <button
                    onClick={addUsersToGroup}
                    title="Add selected users to group"
                    aria-label="Add selected users to group"
                  >
                    &#x2192;
                  </button>
                  <button
                    onClick={removeUsersFromGroup}
                    title="Remove selected members from group"
                    aria-label="Remove selected members from group"
                  >
                    &#x2190;
                  </button>
                </div>

                {/* Group Members Table */}
                <div className="user-list">
                  <h3>Group Members</h3>
                  <div className="scrollable-box">
                    <table className="user-table">
                      <thead>
                        <tr>
                          <th>Username</th>
                          <th>Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupMembers.length > 0 ? (
                          groupMembers.map(user => (
                            <tr
                              key={`${user.id}-${user.type.toLowerCase()}`}
                              className={
                                selectedMembers.some(
                                  selected => selected.id === user.id && selected.type === user.type.toLowerCase()
                                )
                                  ? "selected"
                                  : ""
                              }
                              onClick={() => handleUserSelect(user.id, user.type, "group")}
                            >
                              <td>{user.name}</td>
                              <td>{user.type.toLowerCase() === "local" ? "Local" : "LDAP"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="2" className="no-users">
                              No group members
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              {/* 🆕 End of Users Management Section */}

              {/* 🆕 Roles Management Section */}
              <div className="roles-management">
                {/* Available Roles Table */}
                <div className="user-list">
                  <h3>Available Roles</h3>
                  <div className="scrollable-box">
                    <table className="user-table">
                      <thead>
                        <tr>
                          <th>Role Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableRoles.length > 0 ? (
                          availableRoles.map(role => (
                            <tr
                              key={role.id}
                              className={selectedRoles.includes(role.id) ? "selected" : ""}
                              onClick={() => handleRoleSelect(role.id, "available")}
                            >
                              <td>{role.roles_name}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="no-users">No roles available</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Role Action Buttons */}
                <div className="action-buttons">
                  <button
                    onClick={addRolesToGroup}
                    title="Add selected roles to group"
                    aria-label="Add selected roles to group"
                  >
                    &#x2192;
                  </button>
                  <button
                    onClick={removeRolesFromGroup}
                    title="Remove selected roles from group"
                    aria-label="Remove selected roles from group"
                  >
                    &#x2190;
                  </button>
                </div>

                {/* Group Roles Table */}
                <div className="user-list">
                  <h3>Group Roles</h3>
                  <div className="scrollable-box">
                    <table className="user-table">
                      <thead>
                        <tr>
                          <th>Role Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupRoles.length > 0 ? (
                          groupRoles.map(role => (
                            <tr
                              key={role.role_id}
                              className={selectedGroupRoles.includes(role.role_id) ? "selected" : ""}
                              onClick={() => handleRoleSelect(role.role_id, "group")}
                            >
                              <td>{role.role_name}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="no-users">No roles assigned</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              {/* 🆕 End of Roles Management Section */}
            </>
          )}

          {/* Bottom Buttons: Delete Group and Close */}
          <div className="bottom-buttons">
            <button
              className="delete-btn"
              onClick={deleteGroup}
              disabled={isDeleting}
              aria-label="Delete this group"
            >
              {isDeleting ? "Deleting..." : "Delete Group"}
            </button>
            <button
              className="close-btn"
              onClick={onClose}
              aria-label="Close manage group popup"
            >
              Close
            </button>
          </div>

          {/* Error Message */}
          {error && <p className="error-message">{error}</p>}
        </div>
      </div>
    </>
  );
};

export default ManageGroup;

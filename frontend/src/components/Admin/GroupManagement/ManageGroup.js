// ManageGroup.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import "./ManageGroup.css";

const ManageGroup = ({ groupId, onClose, onGroupDeleted }) => {
  const [allUsers, setAllUsers] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupName, setGroupName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (groupId) {
      loadGroupDetailsAndUsers();
    }
  }, [groupId]);

  /**
   * Fetch group details and members, then all users excluding current members.
   */
  const loadGroupDetailsAndUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const groupResponse = await axios.get(`http://localhost:4000/api/groups/${groupId}`);
      const groupData = groupResponse.data;
      setGroupName(groupData.name); // Set group name
      const membersResponse = await axios.get(`http://localhost:4000/api/groups/${groupId}/members`);
      setGroupMembers(membersResponse.data);
      const memberIds = membersResponse.data.map(user => `${user.id}-${user.type.toLowerCase()}`);
      const usersResponse = await axios.get("http://localhost:4000/api/users");
      const filteredUsers = usersResponse.data.filter(
        user => !memberIds.includes(`${user.id}-${user.type.toLowerCase()}`)
      );
      setAllUsers(filteredUsers);
    } catch (error) {
      console.error("❌ Error fetching data:", error);
      setError("Failed to load group details or users.");
    } finally {
      setLoading(false);
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
      console.error("❌ Error removing users from group:", error);
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
      console.error("❌ Error deleting group:", error);
      alert("❌ Failed to delete the group.");
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Handle selection of users in the All Users table.
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
                <button onClick={addUsersToGroup} title="Add selected users to group" aria-label="Add selected users to group">
                  &#x2192;
                </button>
                <button onClick={removeUsersFromGroup} title="Remove selected members from group" aria-label="Remove selected members from group">
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

import React, { useState, useEffect } from "react";
import axios from "axios";
import AddLocalUser from "./AddLocalUser";
import DomainUser from "./DomainUser";
import "./UserManagement.css";

const UserManagement = () => {
  const [localUsers, setLocalUsers] = useState([]);
  const [domainUsers, setDomainUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isDomainUserOpen, setIsDomainUserOpen] = useState(false);
  const [selectedLocalUsers, setSelectedLocalUsers] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  /**
   * Fetch all necessary data concurrently.
   */
  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError("");
      await Promise.all([fetchUsers(), fetchGroups()]);

      setLoading(false);
    } catch (err) {
      console.error("❌ Error fetching data:", err);
      setError("Failed to load data.");
      setLoading(false);
    }
  };

  /**
   * Fetch both local and domain users.
   */
  const fetchUsers = async () => {
    try {
      // Fetch Local Users
      const localUsersResponse = await axios.get("http://localhost:4000/api/localusers");
      setLocalUsers(localUsersResponse.data);

      // Fetch Domain Users
      const domainUsersResponse = await axios.get("http://localhost:4000/api/domainusers");
      setDomainUsers(domainUsersResponse.data);
    } catch (error) {
      console.error("❌ Error fetching users:", error);
      setError("Failed to load users.");
    }
  };

  /**
   * Fetch groups from the backend.
   */
  const fetchGroups = async () => {
    try {
      const response = await axios.get("http://localhost:4000/api/groups");
      setGroups(response.data);
    } catch (error) {
      console.error("❌ Error fetching groups:", error);
      setError("Failed to load groups.");
    }
  };

  /**
   * Handler called when a new user is added.
   */
  const handleUserAdded = () => {
    fetchAllData();
  };

  /**
   * Handle checkbox state changes for selecting local users.
   * @param {number|string} userId - The ID of the user.
   */
  const handleCheckboxChange = (userId) => {
    setSelectedLocalUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  /**
   * Handle deletion of selected local users.
   */
  const handleDeleteUsers = async () => {
    if (selectedLocalUsers.length === 0) return;

    if (!window.confirm("Are you sure you want to delete the selected users?")) {
      return;
    }

    try {
      await axios.post("http://localhost:4000/api/localusers/delete", { userIds: selectedLocalUsers });
      fetchAllData();
      setSelectedLocalUsers([]);
    } catch (error) {
      console.error("❌ Failed to delete users:", error);
      setError("Failed to delete selected users.");
    }
  };

  /**
   * Get the groups associated with a user based on their ID and type.
   * @param {number|string} identifier - The ID of the user (local or ldap_user_id).
   * @param {string} type - The type of user ("local" or "ldap").
   * @returns {string} - A comma-separated list of group names or "No Group".
   */
  const getUserGroups = (identifier, type) => {
    if (!identifier || !groups.length) {
      return "No Group";
    }

    const identifierStr = identifier.toString();
    const matchedGroups = groups.filter((group) => {
      if (type === "local") {
        return (
          group.local_user_ids &&
          group.local_user_ids.split(",").map((id) => id.trim()).includes(identifierStr)
        );
      } else if (type === "ldap") {
        return (
          group.ldap_user_ids &&
          group.ldap_user_ids.split(",").map((id) => id.trim()).includes(identifierStr)
        );
      }
      return false;
    });

    const groupNames = matchedGroups.map((group) => group.name).join(", ");
    return groupNames || "No Group";
  };

  return (
    <div className="user-management-container">
      <div className="user-management-header">
        <button className="add-user-btn" onClick={() => setIsAddUserOpen(true)}>
          + Add Local User
        </button>
        <button className="sync-user-btn" onClick={() => setIsDomainUserOpen(true)}>
          Sync Users From Domain
        </button>
      </div>

      {selectedLocalUsers.length > 0 && (
        <div className="delete-btn-container">
          <button className="delete-btn" onClick={handleDeleteUsers}>
            Delete Selected Local Users ({selectedLocalUsers.length})
          </button>
        </div>
      )}

      {/* Modal Components */}
      <AddLocalUser
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        onUserAdded={handleUserAdded}
      />
      <DomainUser
        isOpen={isDomainUserOpen}
        onClose={() => setIsDomainUserOpen(false)}
        onUserSynced={handleUserAdded}
      />

      {/* Error Message */}
      {error && <p className="error-message">{error}</p>}

      {/* Loading State */}
      {loading ? (
        <p className="loading-message">Loading users...</p>
      ) : (
        <div className="table-container">
          {/* Local Users Table */}
          <h3>Local Users</h3>
          <table className="user-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Username</th>
                <th>Full Name</th>
                <th>Group</th>
                <th>Created Date</th>
                <th>Status</th>
                <th>Email Address</th>
                <th>Phone Number</th>
              </tr>
            </thead>
            <tbody>
              {localUsers.length > 0 ? (
                localUsers.map((user) => (
                  <tr key={`local-${user.id}`}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedLocalUsers.includes(user.id)}
                        onChange={() => handleCheckboxChange(user.id)}
                      />
                    </td>
                    <td>{user.username}</td>
                    <td>{`${user.first_name} ${user.last_name}`}</td>
                    <td>{getUserGroups(user.id, "local")}</td>
                    <td>{new Date(user.created_date).toLocaleDateString()}</td>
                    <td className={`status ${user.status.toLowerCase()}`}>{user.status}</td>
                    <td>{user.email_address}</td>
                    <td>{user.phone_number}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="no-users">
                    No local users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Domain Users Table */}
          <h3>Domain Users</h3>
          <table className="user-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Group</th>
                <th>Created Date</th>
                <th>Status</th>
                <th>Email Address</th>
                <th>Phone Number</th>
              </tr>
            </thead>
            <tbody>
              {domainUsers.length > 0 ? (
                domainUsers.map((user) => {
                  // Determine Created Date
                  let createdDate = "N/A";
                  if (user.whencreated) {
                    try {
                      createdDate = new Date(user.whencreated).toLocaleDateString();
                    } catch (error) {
                      createdDate = "Invalid Date";
                    }
                  }

                  // Determine Status
                  let status = "Inactive";
                  if (user.useraccountcontrol) {
                    const userControl = parseInt(user.useraccountcontrol, 10);
                    status = (userControl & 0x2) === 0 ? "Active" : "Inactive";
                  }

                  return (
                    <tr key={`domain-${user.ldap_user_id || user.samaccountname}`}>
                      <td>{user.samaccountname || "N/A"}</td>
                      <td>{user.displayname || "N/A"}</td>
                      <td>{getUserGroups(user.ldap_user_id, "ldap")}</td>
                      <td>{createdDate}</td>
                      <td className={`status ${status.toLowerCase()}`}>{status}</td>
                      <td>{user.mail || "N/A"}</td>
                      <td>{user.mobile || "N/A"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="no-users">
                    No domain users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

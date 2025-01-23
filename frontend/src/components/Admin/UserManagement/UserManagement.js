import React, { useState, useEffect } from "react";
import axios from "axios";
import AddLocalUser from "./AddLocalUser";
import "./UserManagement.css";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Fetch Users from API
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    axios.get("http://localhost:4000/api/users")
      .then(response => {
        setUsers(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error fetching users:", error);
        setError("Failed to load users.");
        setLoading(false);
      });
  };

  // Handle user addition
  const handleUserAdded = () => {
    fetchUsers();
  };

  // Handle checkbox selection
  const handleCheckboxChange = (userId) => {
    setSelectedUsers((prevSelected) =>
      prevSelected.includes(userId)
        ? prevSelected.filter((id) => id !== userId)
        : [...prevSelected, userId]
    );
  };

  // Handle delete users
  const handleDeleteUsers = () => {
    if (selectedUsers.length === 0) return;

    axios.post("http://localhost:4000/api/users/delete", { userIds: selectedUsers })
      .then(() => {
        fetchUsers();
        setSelectedUsers([]);
      })
      .catch((error) => {
        console.error("Error deleting users:", error);
        setError("Failed to delete users.");
      });
  };

  return (
    <div className="user-management-container">
      {/* Action Buttons */}
      <div className="user-management-header">
        <button className="add-user-btn" onClick={() => setIsAddUserOpen(true)}>+ Add Local User</button>
        <button className="sync-user-btn">Sync User From Domain</button>
      </div>

      {/* Show Delete Button if Users are Selected */}
      {selectedUsers.length > 0 && (
        <div className="delete-btn-container">
          <button className="delete-btn" onClick={handleDeleteUsers}>
            Delete Selected ({selectedUsers.length})
          </button>
        </div>
      )}

      {/* Add Local User Modal */}
      <AddLocalUser isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} onUserAdded={handleUserAdded} />

      {/* Error Message */}
      {error && <p className="error-message">{error}</p>}

      {/* Loading State */}
      {loading ? (
        <p className="loading-message">Loading users...</p>
      ) : (
        <div className="table-container">
          <table className="user-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Username</th>
                <th>Full Name</th>
                <th>Created Date</th>
                <th>Status</th>
                <th>Email Address</th>
                <th>Phone Number</th>
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => handleCheckboxChange(user.id)}
                      />
                    </td>
                    <td>{user.username}</td>
                    <td>{`${user.first_name} ${user.last_name}`}</td>
                    <td>{new Date(user.created_date).toLocaleDateString()}</td>
                    <td className={`status ${user.status.toLowerCase()}`}>{user.status}</td>
                    <td>{user.email_address}</td>
                    <td>{user.phone_number}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="no-users">No users found.</td>
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

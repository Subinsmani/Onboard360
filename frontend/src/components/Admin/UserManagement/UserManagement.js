import React, { useState, useEffect } from "react";
import axios from "axios";
import AddLocalUser from "./AddLocalUser";
import DomainUser from "./DomainUser";
import "./UserManagement.css";

const UserManagement = () => {
  const [localUsers, setLocalUsers] = useState([]);
  const [domainUsers, setDomainUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isDomainUserOpen, setIsDomainUserOpen] = useState(false);
  const [selectedLocalUsers, setSelectedLocalUsers] = useState([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    setLoading(true);
    setError("");

    axios.get("http://localhost:4000/api/localusers")
      .then(response => {
        setLocalUsers(response.data);
      })
      .catch(() => {
        setError("Failed to load local users.");
      });

    axios.get("http://localhost:4000/api/domainusers")
      .then(response => {
        setDomainUsers(response.data);
      })
      .catch(() => {
        setDomainUsers([]);
      });

    setLoading(false);
  };

  const handleUserAdded = () => {
    fetchUsers();
  };

  const handleCheckboxChange = (userId) => {
    setSelectedLocalUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleDeleteUsers = () => {
    if (selectedLocalUsers.length === 0) return;

    axios.post("http://localhost:4000/api/localusers/delete", { userIds: selectedLocalUsers })
      .then(() => {
        fetchUsers();
        setSelectedLocalUsers([]);
      })
      .catch(() => {
        setError("Failed to delete users.");
      });
  };

  return (
    <div className="user-management-container">
      <div className="user-management-header">
        <button className="add-user-btn" onClick={() => setIsAddUserOpen(true)}>+ Add Local User</button>
        <button className="sync-user-btn" onClick={() => setIsDomainUserOpen(true)}>Sync Users From Domain</button>
      </div>

      {selectedLocalUsers.length > 0 && (
        <div className="delete-btn-container">
          <button className="delete-btn" onClick={handleDeleteUsers}>
            Delete Selected Local Users ({selectedLocalUsers.length})
          </button>
        </div>
      )}

      <AddLocalUser isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} onUserAdded={handleUserAdded} />
      <DomainUser isOpen={isDomainUserOpen} onClose={() => setIsDomainUserOpen(false)} />

      {error && error !== "Failed to load local users." && <p className="error-message">{error}</p>}

      {loading ? (
        <p className="loading-message">Loading users...</p>
      ) : (
        <div className="table-container">
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
                    <td>{user.group_name || "No Group"}</td>
                    <td>{new Date(user.created_date).toLocaleDateString()}</td>
                    <td className={`status ${user.status.toLowerCase()}`}>{user.status}</td>
                    <td>{user.email_address}</td>
                    <td>{user.phone_number}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="no-users">No local users found.</td>
                </tr>
              )}
            </tbody>
          </table>

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
                  let createdDate = "N/A";
                  if (user.whencreated) {
                    try {
                      createdDate = new Date(user.whencreated).toLocaleDateString();
                    } catch (error) {
                      createdDate = "Invalid Date";
                    }
                  }

                  // Determine Status from `useraccountcontrol`
                  let status = "Inactive";
                  if (user.useraccountcontrol) {
                    const userControl = parseInt(user.useraccountcontrol, 10);
                    status = (userControl & 0x2) === 0 ? "Active" : "Inactive";
                  }

                  return (
                    <tr key={`domain-${user.samaccountname || user.id}`}>
                      <td>{user.samaccountname}</td>
                      <td>{user.displayname}</td>
                      <td>{user.group_name || "No Group"}</td>
                      <td>{createdDate}</td>
                      <td className={`status ${status.toLowerCase()}`}>{status}</td>
                      <td>{user.mail || "N/A"}</td>
                      <td>{user.mobile || "N/A"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="no-users">No domain users found.</td>
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

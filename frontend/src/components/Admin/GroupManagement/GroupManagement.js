import React, { useState, useEffect } from "react";
import axios from "axios";
import AddGroup from "./AddGroup";
import "./GroupManagement.css";

const GroupManagement = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = () => {
    axios.get("http://localhost:4000/api/groups")
      .then(response => {
        setGroups(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error fetching groups:", error);
        setError("Failed to load groups.");
        setLoading(false);
      });
  };

  const handleGroupAdded = () => {
    fetchGroups();
  };

  const handleCheckboxChange = (groupId) => {
    setSelectedGroups((prevSelected) =>
      prevSelected.includes(groupId)
        ? prevSelected.filter((id) => id !== groupId)
        : [...prevSelected, groupId]
    );
  };

  const handleDeleteGroups = () => {
    if (selectedGroups.length === 0) return;

    axios.post("http://localhost:4000/api/groups/delete", { groupIds: selectedGroups })
      .then(() => {
        fetchGroups();
        setSelectedGroups([]);
      })
      .catch(error => {
        console.error("Error deleting groups:", error);
        setError("Failed to delete groups.");
      });
  };

  return (
    <div className="group-management-container">
      <div className="group-management-header">
        <button className="add-group-btn" onClick={() => setIsAddGroupOpen(true)}>+ Add Group</button>
      </div>

      {selectedGroups.length > 0 && (
        <div className="delete-btn-container">
          <button className="delete-btn" onClick={handleDeleteGroups}>
            Delete Selected ({selectedGroups.length})
          </button>
        </div>
      )}

      <AddGroup isOpen={isAddGroupOpen} onClose={() => setIsAddGroupOpen(false)} onGroupAdded={handleGroupAdded} />

      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <p className="loading-message">Loading groups...</p>
      ) : (
        <div className="table-container">
          <table className="group-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Group Name</th>
                <th>Role</th>
                <th>Created Date</th>
              </tr>
            </thead>
            <tbody>
              {groups.length > 0 ? (
                groups.map((group) => (
                  <tr key={group.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedGroups.includes(group.id)}
                        onChange={() => handleCheckboxChange(group.id)}
                      />
                    </td>
                    <td>{group.name}</td>
                    <td>{group.role}</td>
                    <td>{new Date(group.created_date).toLocaleDateString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="no-groups">No groups found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default GroupManagement;

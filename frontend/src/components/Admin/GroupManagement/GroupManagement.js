// GroupManagement.js
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import AddGroup from "./AddGroup";
import ManageGroup from "./ManageGroup";
import "./GroupManagement.css";

const GroupManagement = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isManageGroupOpen, setIsManageGroupOpen] = useState(false);

  // Memoized function to fetch updated group data (Ensures reactivity)
  const fetchGroups = useCallback(async () => {
    try {
      const groupsResponse = await axios.get("http://localhost:4000/api/groups");
      const groupsData = groupsResponse.data;

      // Fetch roles for each group using Promise.all
      const rolePromises = groupsData.map(async (group) => {
        try {
          const rolesResponse = await axios.get(`http://localhost:4000/api/groups/${group.id}/roles`);
          const role = rolesResponse.data.role_name || "N/A";
          return { ...group, role };
        } catch (error) {
          console.error(`❌ Error fetching roles for group ${group.id}:`, error);
          return { ...group, role: "N/A" };
        }
      });

      const updatedGroups = await Promise.all(rolePromises);
      setGroups(updatedGroups);
      setLoading(false);
    } catch (error) {
      console.error("❌ Error fetching groups:", error);
      setError("Failed to load groups.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Refresh groups after adding a new group.
  const handleGroupAdded = () => {
    fetchGroups();
  };

  // efresh groups when role is updated
  const handleRoleUpdated = () => {
    fetchGroups();
  };

  const handleCheckboxChange = (groupId) => {
    setSelectedGroup(prevSelected => (prevSelected === groupId ? null : groupId));
  };

  /**
   * Remove the deleted group from the state.
   * @param {number} deletedGroupId - The ID of the deleted group.
   */
  const handleGroupDeleted = (deletedGroupId) => {
    setGroups(prevGroups => prevGroups.filter(group => group.id !== deletedGroupId));
    setSelectedGroup(null);
    setIsManageGroupOpen(false);
  };

  return (
    <div className={`group-management-container ${isManageGroupOpen ? "blur-background" : ""}`}>
      <div className="group-management-header">
        <button className="add-group-btn" onClick={() => setIsAddGroupOpen(true)}>+ Add Group</button>
      </div>

      {selectedGroup && (
        <div className="manage-btn-container">
          <button className="manage-btn" onClick={() => setIsManageGroupOpen(true)}>
            Manage Group
          </button>
        </div>
      )}

      {/* Add Group Modal */}
      <AddGroup 
        isOpen={isAddGroupOpen} 
        onClose={() => setIsAddGroupOpen(false)} 
        onGroupAdded={handleGroupAdded} 
      />

      {/* Manage Group Modal */}
      {isManageGroupOpen && selectedGroup && (
        <>
          <div className="popup-overlay"></div>
          <div className="popup">
            <div className="popup-content">
              <ManageGroup 
                groupId={selectedGroup} 
                onClose={() => setIsManageGroupOpen(false)} 
                onGroupDeleted={handleGroupDeleted}
                onRoleUpdated={handleRoleUpdated}
              />
            </div>
          </div>
        </>
      )}

      {/* Display Error Message */}
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
                        checked={selectedGroup === group.id}
                        onChange={() => handleCheckboxChange(group.id)}
                      />
                    </td>
                    <td>{group.name}</td>
                    <td>{group.role || "N/A"}</td>
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

import React, { useState } from "react";
import axios from "axios";
import "./AddGroup.css";

const AddGroup = ({ isOpen, onClose, onGroupAdded }) => {
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError("Group name is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.post("http://localhost:4000/api/groups", { name: groupName });
      onGroupAdded(response.data);
      setGroupName("");
      onClose();
    } catch (err) {
      setError("Failed to add group. Please try again.");
    }

    setLoading(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <h2>Add Group</h2>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Enter group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            required
          />
          <div className="modal-buttons">
            <button type="submit" disabled={loading}>{loading ? "Saving..." : "Save"}</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddGroup;

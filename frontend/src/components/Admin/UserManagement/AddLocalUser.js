import React, { useState, useEffect } from "react";
import axios from "axios";
import "./AddLocalUser.css";

const AddLocalUser = ({ isOpen, onClose, onUserAdded }) => {
  const [formData, setFormData] = useState({
    username: "",
    first_name: "",
    last_name: "",
    email_address: "",
    phone_number: "",
    password: "",
    group_id: "", // Added Group ID
  });

  const [groups, setGroups] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Only fetch groups when modal opens
  useEffect(() => {
    if (isOpen) {
      axios
        .get("http://localhost:4000/api/groups")
        .then((response) => {
          setGroups(response.data);
        })
        .catch((error) => {
          console.error("Error fetching groups:", error);
          setError("Failed to load groups.");
        });
    }
  }, [isOpen]);

  // Handle form input changes
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Submit Form (Save User to DB)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
        await axios.post("http://localhost:4000/api/localusers", formData);
        onUserAdded();
        onClose();
    } catch (err) {
        setError("Failed to add user. Please try again.");
    }

    setLoading(false);
};

  if (!isOpen) return null; // ✅ Keeps Hooks running correctly

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <h2>Add Local User</h2>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input type="text" name="username" placeholder="Username" required onChange={handleChange} />
          <input type="text" name="first_name" placeholder="First Name" required onChange={handleChange} />
          <input type="text" name="last_name" placeholder="Last Name" required onChange={handleChange} />
          <input type="email" name="email_address" placeholder="Email Address" required onChange={handleChange} />
          <input type="tel" name="phone_number" placeholder="Phone Number" required onChange={handleChange} />
          <input type="password" name="password" placeholder="Password" required onChange={handleChange} />

          {/* Group Dropdown */}
          <select name="group_id" required onChange={handleChange} value={formData.group_id}>
            <option value="">Select Group</option>
            {groups.length > 0 ? (
              groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))
            ) : (
              <option disabled>No groups available</option>
            )}
          </select>

          <div className="modal-buttons">
            <button type="submit" disabled={loading}>{loading ? "Saving..." : "Save"}</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddLocalUser;

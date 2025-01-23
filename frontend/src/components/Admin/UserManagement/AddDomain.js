import React, { useState, useEffect } from "react";
import axios from "axios";
import "./AddDomain.css";

const AddDomain = ({ isOpen, onClose, onDomainAdded, domainData }) => {
  const [formData, setFormData] = useState({
    domain_name: "",
    domain_controller: "",
    read_only_user: "",
    read_only_user_password: "",
    base_dn: "",
    ssl_enabled: "No",
    port: "389",
  });

  const [storedPassword, setStoredPassword] = useState("");
  const [testSuccess, setTestSuccess] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [passwordPlaceholder, setPasswordPlaceholder] = useState("Enter Password");

  // **Populate form data only when editing**
  useEffect(() => {
    if (isOpen && domainData) {
      setFormData({
        domain_name: domainData.domain_name || "",
        domain_controller: domainData.domain_controller || "",
        read_only_user: domainData.read_only_user || "",
        read_only_user_password: "",
        base_dn: domainData.base_dn || "",
        ssl_enabled: domainData.ssl_enabled || "No",
        port: domainData.port ? domainData.port.toString() : "389",
      });

      setPasswordPlaceholder("Password Unchanged");
      setTestSuccess(false);

      // Fetch the stored password separately
      fetchStoredPassword(domainData.id);
    } else if (isOpen && !domainData) {
      setFormData({
        domain_name: "",
        domain_controller: "",
        read_only_user: "",
        read_only_user_password: "",
        base_dn: "",
        ssl_enabled: "No",
        port: "389",
      });

      setPasswordPlaceholder("Enter Password");
      setTestSuccess(false);
    }
  }, [isOpen, domainData]);

  // Fetch stored password
  const fetchStoredPassword = async (id) => {
    try {
      const response = await axios.get(`http://localhost:4000/api/domains/${id}/password`);
      if (response.data?.password) {
        setStoredPassword(response.data.password);
      }
    } catch (error) {
      console.error("Error fetching stored password:", error);
    }
  };

  if (!isOpen) return null;

  // **Handle Input Changes**
  const handleChange = (e) => {
    const { name, value } = e.target;
    let updatedForm = { ...formData, [name]: value };

    // **Automatically update port based on SSL selection**
    if (name === "ssl_enabled") {
      updatedForm.port = value === "Yes" ? "636" : "389";
    }

    setFormData(updatedForm);
    setTestSuccess(false); // Reset test success when changing values
  };

  // **Handle Test Connection**
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestSuccess(false);
    setTestMessage("");
    setError("");

    let testPayload = { ...formData };

    // ✅ If password is empty, use the stored password
    if (!testPayload.read_only_user_password && domainData) {
      testPayload.read_only_user_password = storedPassword;
    }
    try {
      const response = await axios.post("http://localhost:4000/api/test-ad-connection", testPayload);

      if (response.data.success) {
        setTestSuccess(true);
        setTestMessage("✅ Test Successful! Connection established.");
      } else {
        setTestMessage("❌ Connection failed. Please check your credentials.");
      }
    } catch (err) {
      console.error("Debug: API Call Failed -", err);
      setError("❌ Failed to test connection. Please try again.");
    }

    setIsTesting(false);
  };

  // **Handle Save or Update Domain**
  const handleSaveDomain = async () => {
    setIsSaving(true);
    setError("");

    // **Use stored password if user did not enter a new one**
    let payload = {
      ...formData,
      read_only_user_password: formData.read_only_user_password || storedPassword,
    };

    try {
      if (domainData) {
        // **Update Existing Domain**
        await axios.put(`http://localhost:4000/api/domains/${domainData.id}`, payload);
      } else {
        // **Add New Domain**
        await axios.post("http://localhost:4000/api/domains", payload);
      }

      onDomainAdded(); // Refresh the domain list after adding/editing
      onClose();
    } catch (err) {
      setError("❌ Failed to save domain. Please try again.");
    }

    setIsSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <h2>{domainData ? "Edit Domain" : "Add New Domain"}</h2>
        {error && <p className="error-message">{error}</p>}
        <form>
          <input 
            type="text" 
            name="domain_name" 
            placeholder="Domain Name" 
            required 
            value={formData.domain_name} 
            onChange={handleChange} 
            disabled={!!domainData} 
          />
          <input 
            type="text" 
            name="domain_controller" 
            placeholder="Domain Controller IP/Hostname" 
            required 
            value={formData.domain_controller} 
            onChange={handleChange} 
          />
          <input 
            type="text" 
            name="read_only_user" 
            placeholder="Read-Only User" 
            required 
            value={formData.read_only_user} 
            onChange={handleChange} 
          />
          <input 
            type="password" 
            name="read_only_user_password" 
            placeholder={passwordPlaceholder} 
            onChange={handleChange} 
          />
          <input 
            type="text" 
            name="base_dn" 
            placeholder="Base DN (e.g., DC=example,DC=com)" 
            required 
            value={formData.base_dn} 
            onChange={handleChange} 
          />

          {/* SSL Dropdown */}
          <label className="select-label">Authentication Type</label>
          <select name="ssl_enabled" required onChange={handleChange} value={formData.ssl_enabled}>
            <option value="No">No (Port: 389)</option>
            <option value="Yes">Yes (Port: 636)</option>
          </select>

          {/* Display Port (Readonly) */}
          <input type="text" name="port" value={formData.port} readOnly />

          {/* Test Connection Button */}
          <button 
            type="button" 
            className="test-btn" 
            onClick={handleTestConnection} 
            disabled={isTesting}
          >
            {isTesting ? "Testing..." : "Test Connection"}
          </button>

          {/* Display Test Result */}
          {testMessage && <p className={`test-message ${testSuccess ? "success" : "failed"}`}>{testMessage}</p>}

          {/* Show Save/Update Button Only if Test Passed */}
          {testSuccess && (
            <button 
              type="button" 
              className="save-btn" 
              onClick={handleSaveDomain} 
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : domainData ? "Update Domain" : "Save This Domain"}
            </button>
          )}

          {/* Cancel Button */}
          <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
        </form>
      </div>
    </div>
  );
};

export default AddDomain;

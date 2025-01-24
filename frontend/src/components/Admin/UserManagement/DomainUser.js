import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaEdit, FaTrash } from "react-icons/fa";
import AddDomain from "./AddDomain";
import FetchUser from "./FetchUser";
import "./DomainUser.css";

const DomainUser = ({ isOpen, onClose }) => {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState(true); // Warning now appears when component loads
  const [isAddDomainOpen, setIsAddDomainOpen] = useState(false);
  const [isEditDomainOpen, setIsEditDomainOpen] = useState(false);
  const [isFetchUserOpen, setIsFetchUserOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [selectedDomainId, setSelectedDomainId] = useState(null); // Store selected domain ID

  // Fetch available domains when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchDomains();
    }
  }, [isOpen]);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const response = await axios.get("http://localhost:4000/api/domains");
      const domainData = response.data;

      // Fetch status for each domain
      const domainWithStatus = await Promise.all(
        domainData.map(async (domain) => {
          try {
            const statusResponse = await axios.get(`http://localhost:4000/api/domains/${domain.id}/status`);
            return { ...domain, status: statusResponse.data.status || "Unknown" };
          } catch (err) {
            console.error(`Error fetching status for domain ${domain.id}:`, err);
            return { ...domain, status: "Unknown" };
          }
        })
      );

      setDomains(domainWithStatus);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching domains:", error);
      setError("Failed to load domain list.");
      setLoading(false);
    }
  };

  // Handle Checkbox Selection - Only One Checkbox Active at a Time
  const handleCheckboxChange = (id) => {
    if (selectedDomainId === id) {
      setSelectedDomainId(null);
      setWarning(true); // Show warning when checkbox is unchecked
    } else {
      setSelectedDomainId(id);
      setWarning(false); // Hide warning when a domain is selected
    }
  };

  // Open Add Domain Modal
  const handleAddDomain = () => {
    setSelectedDomain(null);
    setIsAddDomainOpen(true);
  };

  // Open Edit Domain Modal
  const handleEditDomain = (domain) => {
    setSelectedDomain(domain);
    setIsEditDomainOpen(true);
  };

  // Handle Delete Domain
  const handleDeleteDomain = async (id) => {
    if (!window.confirm("Are you sure you want to delete this domain?")) return;

    try {
      await axios.delete(`http://localhost:4000/api/domains/${id}`);
      fetchDomains(); // Refresh list after deletion
    } catch (error) {
      console.error("Error deleting domain:", error);
      setError("Failed to delete domain.");
    }
  };

  // Refresh domain list after adding/editing
  const handleDomainUpdated = () => {
    fetchDomains();
    setIsAddDomainOpen(false);
    setIsEditDomainOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <h2>Sync Users from Domain</h2>

        {/* Add New Domain Button */}
        <button className="add-domain-btn" onClick={handleAddDomain}>
          + Add New Domain
        </button>

        {/* Error Message */}
        {error && <p className="error-message">{error}</p>}

        {/* Warning Message (Now Always Shows When Component Loads) */}
        {warning && <p className="warning-message">Please select a domain to fetch users.</p>}

        {/* Domain List */}
        {loading ? (
          <p className="loading-message">Loading domains...</p>
        ) : (
          <div className="table-container">
            <table className="domain-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Domain Name</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {domains.length > 0 ? (
                  domains.map((domain) => (
                    <tr key={domain.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedDomainId === domain.id}
                          onChange={() => handleCheckboxChange(domain.id)}
                        />
                      </td>
                      <td>{domain.domain_name}</td>
                      <td>
                        <span className={`status ${domain.status?.toLowerCase() || "unknown"}`}>
                          {domain.status || "Unknown"}
                        </span>
                      </td>
                      <td className="action-buttons">
                        <button className="edit-btn" onClick={() => handleEditDomain(domain)}>
                          <FaEdit /> Edit
                        </button>
                        <button className="delete-btn" onClick={() => handleDeleteDomain(domain.id)}>
                          <FaTrash /> Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="no-domains">
                      No domains found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal Buttons */}
        <div className="modal-buttons">
          <button
            type="button"
            className={`fetch-user-btn ${selectedDomainId ? "" : "disabled-btn"}`}
            onClick={() => setIsFetchUserOpen(true)}
            disabled={!selectedDomainId}
          >
            Fetch User
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Fetch User Modal */}
      <FetchUser isOpen={isFetchUserOpen} onClose={() => setIsFetchUserOpen(false)} selectedDomainId={selectedDomainId} />

      {/* Add or Edit Domain Modals */}
      <AddDomain
        isOpen={isAddDomainOpen || isEditDomainOpen}
        onClose={() => {
          setIsAddDomainOpen(false);
          setIsEditDomainOpen(false);
        }}
        onDomainAdded={handleDomainUpdated}
        domainData={selectedDomain}
      />
    </div>
  );
};

export default DomainUser;

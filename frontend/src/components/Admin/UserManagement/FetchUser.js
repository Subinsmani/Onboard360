import React, { useState, useEffect } from "react";
import axios from "axios";
import CheckboxTree from "react-checkbox-tree";
import "react-checkbox-tree/lib/react-checkbox-tree.css";
import "./FetchUser.css";

const FetchUser = ({ isOpen, onClose, selectedDomainId }) => {
    const [ouTree, setOuTree] = useState([]);
    const [checked, setChecked] = useState([]);
    const [expanded, setExpanded] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [fetchingUsers, setFetchingUsers] = useState(false);

    useEffect(() => {
        if (isOpen && selectedDomainId) {
            fetchOrganizationalUnits(selectedDomainId);
        }
    }, [isOpen, selectedDomainId]);

    const fetchOrganizationalUnits = async (domainId) => {
        setLoading(true);
        try {
            const response = await axios.get(`http://localhost:4000/api/ou?domain_id=${domainId}`);
            setOuTree(formatTree(response.data));
            setError("");
        } catch (err) {
            setError("Failed to fetch OUs.");
        }
        setLoading(false);
    };

    const fetchUsers = async () => {
        if (checked.length === 0) {
            return;
        }

        setFetchingUsers(true);

        try {
            await axios.get("http://localhost:4000/api/ldapusers", {
                params: { domain_id: selectedDomainId, ous: checked }
            });
        } catch (err) {
            setError("Error fetching users from LDAP.");
        }

        setFetchingUsers(false);
    };

    // Convert flat OU list to hierarchical tree format
    const formatTree = (ouList) => {
        const treeMap = {};
        const tree = [];

        ouList.forEach((ou) => {
            treeMap[ou.id] = { label: ou.name, value: ou.id, children: [] };
        });

        ouList.forEach((ou) => {
            const parts = ou.id.split(",");
            parts.shift();

            const parentDN = parts.join(",");
            if (treeMap[parentDN]) {
                treeMap[parentDN].children.push(treeMap[ou.id]);
            } else {
                tree.push(treeMap[ou.id]);
            }
        });

        return tree;
    };

    if (!isOpen) return null;

    return (
        <div className="fetch-user-overlay">
            <div className="fetch-user-container">
                <h3>Select Organizational Units</h3>
                <p>OUs for Domain: {selectedDomainId || "None"}</p>

                {loading ? (
                    <p className="loading-message">Loading OUs...</p>
                ) : error ? (
                    <p className="error-message">{error}</p>
                ) : (
                    <div className="ou-tree-container">
                        {ouTree.length > 0 ? (
                            <CheckboxTree
                                nodes={ouTree}
                                checked={checked}
                                expanded={expanded}
                                onCheck={setChecked}
                                onExpand={setExpanded}
                                icons={{
                                    check: <span>✅</span>,
                                    uncheck: <span>⬜</span>,
                                    halfCheck: <span>🔲</span>,
                                    expandClose: <span>▶</span>,
                                    expandOpen: <span>▼</span>,
                                    parentClose: <span>📁</span>,
                                    parentOpen: <span>📂</span>,
                                    leaf: <span>📄</span>,
                                }}
                            />
                        ) : (
                            <p>No OUs found.</p>
                        )}
                    </div>
                )}

                {/* Buttons Section */}
                <div className="fetch-user-buttons">
                    {checked.length > 0 && (
                        <button
                            className={`fetch-user-fetch-btn ${checked.length > 0 ? "active" : ""}`}
                            onClick={fetchUsers}
                            disabled={fetchingUsers}
                        >
                            {fetchingUsers ? "Fetching..." : "Fetch Users"}
                        </button>
                    )}
                    <button className="fetch-user-close-btn" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FetchUser;

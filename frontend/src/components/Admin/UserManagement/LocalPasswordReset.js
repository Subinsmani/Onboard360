import React, { useState } from "react";
import axios from "axios";
import "./LocalPasswordReset.css";

const LocalPasswordReset = ({ isOpen, onClose, userId, onPasswordReset }) => {
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!isOpen) return null;

  const validatePassword = (password) => {
    const minLength = /.{8,}/;
    const uppercase = /[A-Z]/;
    const lowercase = /[a-z]/;
    const symbol = /[!@#$%^&*(),.?":{}|<>]/;
    return (
      minLength.test(password) &&
      uppercase.test(password) &&
      lowercase.test(password) &&
      symbol.test(password)
    );
  };

  const handleReset = async () => {
    setError("");
    setSuccess("");

    if (!validatePassword(newPassword)) {
      setError(
        "Password must be at least 8 characters long, include uppercase and lowercase letters, and contain at least one symbol."
      );
      return;
    }

    try {
      await axios.post("http://localhost:4000/api/localusers/resetpassword", {
        userId,
        newPassword,
      });
      setSuccess("Password reset successfully.");
      onPasswordReset();
    } catch (err) {
      console.error("❌ Password reset error:", err);
      setError("Failed to reset password.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Reset Password</h2>
        <input
          type="password"
          placeholder="Enter new password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">{success}</p>}
        <div className="modal-buttons">
          <button onClick={handleReset}>Reset</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default LocalPasswordReset;

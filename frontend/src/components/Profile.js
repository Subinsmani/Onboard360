import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserCircle, FaSignOutAlt } from "react-icons/fa";
import "./Profile.css";

const Profile = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [username, setUsername] = useState("User");
  const navigate = useNavigate();
  const profileRef = useRef(null);

  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) setUsername(storedUsername);
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    if (isOpen) {
      closeDropdown();
    } else {
      setIsOpen(true);
    }
  };

  const closeDropdown = () => {
    setClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setClosing(false);
    }, 600);
  };

  const profileImage = `/ProfileImage/${username}.png`;
  const defaultProfile = "/ProfileImage/Default_Profile.png";

  const checkImageExists = (url, callback) => {
    const img = new Image();
    img.src = url;
    img.onload = () => callback(true);
    img.onerror = () => callback(false);
  };

  const [finalImage, setFinalImage] = useState(defaultProfile);

  useEffect(() => {
    checkImageExists(profileImage, (exists) => {
      setFinalImage(exists ? profileImage : defaultProfile);
    });
  }, [username]);

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("username");
    navigate("/login");
    window.history.pushState(null, null, window.location.href);
    window.onpopstate = function () {
      window.history.go(1);
    };
  };

  return (
    <div className="profile-container" ref={profileRef}>
      <FaUserCircle className="profile-icon" onClick={toggleDropdown} />

      {isOpen && (
        <div className={`profile-popup ${closing ? "hide" : ""}`}>
          <div className="profile-header">
            <img src={finalImage} alt="Profile" className="profile-image" />
            <p className="profile-name">{username}</p>
          </div>
          <div className="profile-menu">
            <div className="menu-item logout" onClick={handleLogout}>
              <FaSignOutAlt className="menu-icon" /> Sign Out
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;

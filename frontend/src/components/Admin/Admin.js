import React from "react";

const Admin = () => {
  const containerStyle = {
    padding: "2em",
    fontFamily: "Arial, sans-serif",
  };

  const titleStyle = {
    fontSize: "2em",
    fontWeight: "bold",
    marginBottom: "1em",
  };

  const textStyle = {
    fontSize: "1.2em",
    lineHeight: "1.5",
  };

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Admin Panel</h1>
      <p style={textStyle}>
        Welcome to the Admin panel. Manage users, roles, and settings here.
      </p>
    </div>
  );
};

export default Admin;

import React from "react";

const Dashboard = () => {
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
      <h1 style={titleStyle}>Dashboard</h1>
      <p style={textStyle}>
        Welcome to the Dashboard page. Here you can view overall statistics and
        reports.
      </p>
    </div>
  );
};

export default Dashboard;

import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import Dashboard from "./components/Dashboard/Dashboard";
import Admin from "./components/Admin/Admin";
import Login from "./components/Login/Login";
import PrivateRoute from "./components/PrivateRoute"; // Import PrivateRoute

const App = () => {
  const isAuthenticated = localStorage.getItem("isAuthenticated"); // Check if user is logged in

  return (
    <Router>
      <Routes>
        {/* Always open Login first */}
        <Route path="/login" element={<Login />} />

        {/* Protect Dashboard and Admin with PrivateRoute */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <>
                <Header />
                <Dashboard />
              </>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <>
                <Header />
                <Admin />
              </>
            </PrivateRoute>
          }
        />

        {/* Redirect non-authenticated users to login */}
        <Route
          path="/"
          element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/login" />
          }
        />
      </Routes>
    </Router>
  );
};

export default App;

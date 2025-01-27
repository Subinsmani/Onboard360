const express = require("express");
const router = express.Router();
const db = require("../../db");

// Get all roles
router.get("/roles", async (req, res) => {
  try {
    const [roles] = await db.query("SELECT * FROM roles");
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

// Add a new role (Super Admin not allowed)
router.post("/roles", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Role name is required." });
    }

    if (name.toLowerCase() === "super admin") {
      return res.status(403).json({ error: "Super Admin role cannot be modified." });
    }

    await db.query("INSERT INTO roles (roles_name) VALUES (?)", [name]);

    res.json({ message: "Role created successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to add role" });
  }
});

// Delete a role (Super Admin not allowed)
router.delete("/roles/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === 1) {
      return res.status(403).json({ error: "Super Admin role cannot be deleted." });
    }

    await db.query("DELETE FROM roles WHERE id = ?", [id]);
    res.json({ message: "Role deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete role" });
  }
});

// Create a role and assign permissions
router.post("/roles_create", async (req, res) => {
  try {
    const { name, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Role name is required." });
    }

    if (name.toLowerCase() === "super admin") {
      return res.status(403).json({ error: "Super Admin role cannot be modified." });
    }

    // Step 1: Insert new role
    const [roleResult] = await db.query("INSERT INTO roles (roles_name) VALUES (?)", [name]);
    const roleId = roleResult.insertId;

    // Step 2: Insert permissions if provided
    if (Array.isArray(permissions) && permissions.length > 0) {
      const rolePermissions = permissions.map((permissionId) => [roleId, permissionId]);
      await db.query("INSERT INTO role_permissions (role_id, permission_id) VALUES ?", [rolePermissions]);
    }

    res.json({ message: "Role created successfully", roleId });
  } catch (err) {
    console.error("❌ Failed to create role:", err);
    res.status(500).json({ error: "Failed to create role", details: err.message });
  }
});

// API to fetch a specific role by ID
router.get("/roles/:role_id", async (req, res) => {
  try {
      const { role_id } = req.params;

      const [role] = await db.query("SELECT id, roles_name FROM roles WHERE id = ?", [role_id]);

      if (role.length === 0) {
          return res.status(404).json({ error: "Role not found" });
      }

      res.json(role[0]);
  } catch (error) {
      res.status(500).json({ error: "Failed to fetch role", details: error.message });
  }
});

module.exports = { router };

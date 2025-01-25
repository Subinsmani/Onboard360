const express = require("express");
const router = express.Router();
const db = require("../../db");
const { setupPermissionsTable } = require("./Permissions");

// Ensure `roles` table is created after `permissions`
async function setupRolesTable() {
  try {
    await setupPermissionsTable();

    await db.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        roles_name VARCHAR(255) NOT NULL UNIQUE,
        permission_id INT UNSIGNED NOT NULL,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
    `);

    // Check if Super Admin already exists
    const [[superAdminExists]] = await db.query("SELECT COUNT(*) AS count FROM roles WHERE id = 1");

    if (superAdminExists.count === 0) {
      const [[permission]] = await db.query("SELECT id FROM permissions WHERE name = 'Onboard360_Admin'");

      if (permission) {
        const permissionId = permission.id;

        await db.query(
          "INSERT INTO roles (id, roles_name, permission_id) VALUES (1, 'Super Admin', ?) ON DUPLICATE KEY UPDATE roles_name = 'Super Admin'",
          [permissionId]
        );
      }
    }
    
    console.log("✅ Roles table is ready.");
  } catch (error) {
    console.error("❌ Error setting up roles:", error);
  }
}

// Get all roles
router.get("/roles", async (req, res) => {
  try {
    const [roles] = await db.query("SELECT * FROM roles");
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

// Add a new role (except Super Admin)
router.post("/roles", async (req, res) => {
  try {
    const { name, permission_id } = req.body;

    if (!name || !permission_id) {
      return res.status(400).json({ error: "Role name and permission_id are required." });
    }

    if (name.toLowerCase() === "super admin") {
      return res.status(403).json({ error: "Super Admin role cannot be modified." });
    }

    await db.query("INSERT INTO roles (roles_name, permission_id) VALUES (?, ?)", [name, permission_id]);

    res.json({ message: "Role created successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to add role" });
  }
});

// Delete a role (except Super Admin)
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

// Ensure correct table creation order
async function setupTables() {
  await setupPermissionsTable();
  await setupRolesTable();
}

setupTables();

module.exports = { setupRolesTable, router };

const express = require("express");
const router = express.Router();
const db = require("../../db");
const { setupPermissionsTable } = require("./Permissions");
const { setupRolesTable } = require("./Roles");
const { setupGroupsTable } = require("../../Groups");

// Sets up the role_permissions table
async function setupRolePermissionsTable() {
    try {
        console.log("🚀 Ensuring role_permissions table exists...");

        await db.query(`
            CREATE TABLE IF NOT EXISTS role_permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                role_id INT UNSIGNED NOT NULL,
                permission_id INT UNSIGNED NOT NULL,
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            )
        `);

        console.log("✅ role_permissions table is ready.");

        // Ensure the first row is always present
        await ensureFirstRow();
    } catch (error) {
        console.error("❌ Error ensuring role_permissions table exists:", error);
    }
}

// Ensures at least one role-permission entry exists
async function ensureFirstRow() {
    try {
        // Ensure Super Admin role exists
        await db.query(`INSERT IGNORE INTO roles (id, roles_name, permission_id) VALUES (1, 'Super Admin', 1);`);

        // Ensure first row in `role_permissions` (ID=1, Non-editable)
        await db.query(`
            INSERT IGNORE INTO role_permissions (id, role_id, permission_id) VALUES (1, 1, 1);
        `);
    } catch (error) {
        console.error("❌ Error ensuring first row in role_permissions:", error);
        throw error;
    }
}

// API to get role-permission-group mappings with actual names
router.get("/role_permissions", async (req, res) => {
    try {
        const [rolePermissions] = await db.query(`
            SELECT 
                rp.id,
                rp.role_id, 
                r.roles_name AS role_name, 
                rp.permission_id, 
                p.name AS permission_name
            FROM role_permissions rp
            LEFT JOIN roles r ON rp.role_id = r.id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            ORDER BY rp.id;
        `);

        res.json(rolePermissions);
    } catch (error) {
        console.error("❌ Error fetching role permissions:", error);
        res.status(500).json({ error: "Failed to fetch role permissions", details: error.message });
    }
});

// Initialize table setup (after roles and permissions are fully set up)
setupPermissionsTable();
setupRolesTable();
setupGroupsTable();
setupRolePermissionsTable();

module.exports = { setupRolePermissionsTable, router };

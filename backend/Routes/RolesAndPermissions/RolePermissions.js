const express = require("express");
const router = express.Router();
const db = require("../../db");

// API to fetch role-permission mappings
router.get("/role_permissions", async (req, res) => {
    try {
        const [rolePermissions] = await db.query(`
            SELECT 
                rp.id AS role_permission_id, 
                r.id AS role_id,
                r.roles_name AS role_name,
                IFNULL(GROUP_CONCAT(p.name ORDER BY p.name ASC SEPARATOR ', '), '') AS permissions
            FROM role_permissions rp
            LEFT JOIN roles r ON rp.role_id = r.id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            GROUP BY r.id, r.roles_name
            ORDER BY rp.id;
        `);

        res.json(rolePermissions);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch role permissions", details: error.message });
    }
});

// API to assign permissions to roles
router.post("/role_permissions", async (req, res) => {
    try {
        const { role_id, permission_ids } = req.body;

        if (!role_id || !Array.isArray(permission_ids) || permission_ids.length === 0) {
            return res.status(400).json({ error: "Role ID and permission IDs are required." });
        }

        // Insert new role-permission mappings
        const rolePermissions = permission_ids.map((permissionId) => [role_id, permissionId]);
        await db.query("INSERT INTO role_permissions (role_id, permission_id) VALUES ?", [rolePermissions]);

        res.json({ message: "Permissions assigned to role successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to assign permissions", details: error.message });
    }
});

// API to remove a permission from a role
router.delete("/role_permissions", async (req, res) => {
    try {
        const { role_id, permission_id } = req.body;

        if (!role_id || !permission_id) {
            return res.status(400).json({ error: "Role ID and permission ID are required." });
        }

        await db.query("DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?", [role_id, permission_id]);

        res.json({ message: "Permission removed from role successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to remove permission", details: error.message });
    }
});

// API to fetch permissions for a single role
router.get("/role_permissions/:role_id", async (req, res) => {
    try {
        const { role_id } = req.params;
        const [rolePermissions] = await db.query(`
            SELECT 
                r.id AS role_id,
                r.roles_name AS role_name,
                IFNULL(GROUP_CONCAT(p.name ORDER BY p.name ASC SEPARATOR ', '), '') AS permissions
            FROM roles r
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            WHERE r.id = ?
            GROUP BY r.id, r.roles_name;
        `, [role_id]);

        if (rolePermissions.length === 0) {
            return res.status(404).json({ error: "Role not found or no permissions assigned." });
        }

        res.json(rolePermissions[0]);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch role details", details: error.message });
    }
});

// DELETE all permissions for a specific role
router.delete("/role_permissions/:role_id", async (req, res) => {
    try {
        const { role_id } = req.params;

        if (!role_id) {
            return res.status(400).json({ error: "Role ID is required." });
        }

        const [result] = await db.query("DELETE FROM role_permissions WHERE role_id = ?", [role_id]);

        // Fix: If no rows were deleted, still return success
        if (result.affectedRows === 0) {
            return res.status(200).json({ message: "No existing permissions to delete, proceeding with update." });
        }

        res.json({ message: "Permissions deleted successfully." });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete permissions", details: error.message });
    }
});

module.exports = { router };

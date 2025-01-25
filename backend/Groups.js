const express = require('express');
const router = express.Router();
const db = require('./db');

// Ensure `groups` Table Exists
async function setupGroupsTable() {
    try {
        console.log("🚀 Ensuring groups table exists...");

        await db.query(`
            CREATE TABLE IF NOT EXISTS groups (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                local_user_ids TEXT DEFAULT NULL,
                ldap_user_ids TEXT DEFAULT NULL,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                role_id INT UNSIGNED DEFAULT NULL,
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
            )
        `);

        console.log("✅ Groups table is ready.");
    } catch (error) {
        console.error("❌ Error ensuring groups table exists:", error);
    }
}

// Fetch all groups
router.get('/groups', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM groups');
        res.json(results);
    } catch (err) {
        console.error('❌ Error fetching groups:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Fetch a specific group by ID
router.get('/groups/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [results] = await db.query('SELECT * FROM groups WHERE id = ?', [id]);

        if (results.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }

        res.json(results[0]);
    } catch (err) {
        console.error('❌ Error fetching group:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Create a new group with IDs from `localuser` & `ldap_users`
router.post('/groups', async (req, res) => {
    const { name, local_usernames = [], ldap_usernames = [] } = req.body;

    if (!name) return res.status(400).json({ error: 'Group name is required' });

    try {
        let localUserIds = null;
        if (local_usernames.length > 0) {
            const [localUsers] = await db.query(`SELECT id FROM localuser WHERE username IN (?)`, [local_usernames]);
            localUserIds = localUsers.map(row => row.id).join(',');
        }
        let ldapUserIds = null;
        if (ldap_usernames.length > 0) {
            const [ldapUsers] = await db.query(`SELECT ldap_user_id FROM ldap_users WHERE samaccountname IN (?)`, [ldap_usernames]);
            ldapUserIds = ldapUsers.map(row => row.ldap_user_id).join(',');
        }
        const [result] = await db.query(
            `INSERT INTO groups (name, local_user_ids, ldap_user_ids) VALUES (?, ?, ?)`,
            [name, localUserIds, ldapUserIds]
        );

        res.status(201).json({ message: 'Group created', groupId: result.insertId });
    } catch (err) {
        console.error('❌ Error creating group:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Update group details (including user IDs)
router.put('/groups/:id', async (req, res) => {
    const { id } = req.params;
    const { name, local_usernames = [], ldap_usernames = [] } = req.body;

    try {
        let localUserIds = null;
        if (local_usernames.length > 0) {
            const [localUsers] = await db.query(`SELECT id FROM localuser WHERE username IN (?)`, [local_usernames]);
            localUserIds = localUsers.map(row => row.id).join(',');
        }
        let ldapUserIds = null;
        if (ldap_usernames.length > 0) {
            const [ldapUsers] = await db.query(`SELECT ldap_user_id FROM ldap_users WHERE samaccountname IN (?)`, [ldap_usernames]);
            ldapUserIds = ldapUsers.map(row => row.ldap_user_id).join(',');
        }
        const [result] = await db.query(
            `UPDATE groups SET name = ?, local_user_ids = ?, ldap_user_ids = ? WHERE id = ?`,
            [name, localUserIds, ldapUserIds, id]
        );

        if (result.affectedRows === 0) return res.status(404).json({ error: 'Group not found' });

        res.json({ message: 'Group updated' });
    } catch (err) {
        console.error('❌ Error updating group:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete a group
router.delete('/groups/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.query('DELETE FROM groups WHERE id = ?', [id]);

        if (result.affectedRows === 0) return res.status(404).json({ error: 'Group not found' });

        res.json({ message: 'Group deleted' });
    } catch (err) {
        console.error('❌ Error deleting group:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Fetch members of a specific group
router.get('/groups/:id/members', async (req, res) => {
    const { id } = req.params;

    try {
        const [results] = await db.query(`SELECT local_user_ids, ldap_user_ids FROM groups WHERE id = ?`, [id]);

        if (results.length === 0) {
            return res.status(404).json({ error: "Group not found" });
        }

        const { local_user_ids, ldap_user_ids } = results[0];

        const localUserIds = local_user_ids ? local_user_ids.split(',').map(id => id.trim()).filter(Boolean) : [];
        const ldapUserIds = ldap_user_ids ? ldap_user_ids.split(',').map(id => id.trim()).filter(Boolean) : [];

        const queries = [];

        if (localUserIds.length > 0) {
            queries.push(db.query(`SELECT id, username AS name, 'local' AS type FROM localuser WHERE id IN (?)`, [localUserIds]));
        }

        if (ldapUserIds.length > 0) {
            queries.push(db.query(`SELECT ldap_user_id AS id, samaccountname AS name, 'ldap' AS type FROM ldap_users WHERE ldap_user_id IN (?)`, [ldapUserIds]));
        }

        const queryResults = await Promise.all(queries);

        const localUsers = queryResults[0] ? queryResults[0][0] : [];
        const ldapUsers = queryResults[1] ? queryResults[1][0] : [];

        res.json([...localUsers, ...ldapUsers]);
    } catch (error) {
        console.error("❌ Error fetching group members:", error);
        res.status(500).json({ error: "Database error" });
    }
});

// Remove Users from a Group
router.post("/groups/:id/remove", async (req, res) => {
    const { id } = req.params;
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ error: "No users selected for removal" });
    }

    try {
        const [group] = await db.query("SELECT local_user_ids, ldap_user_ids FROM groups WHERE id = ?", [id]);
        if (group.length === 0) return res.status(404).json({ error: "Group not found" });
        let currentLocalUsers = group[0].local_user_ids ? group[0].local_user_ids.split(",").map(Number) : [];
        let currentLdapUsers = group[0].ldap_user_ids ? group[0].ldap_user_ids.split(",").map(Number) : [];
        const localUsersToRemove = users.filter(user => user?.type?.toLowerCase() === "local").map(user => user.id);
        const ldapUsersToRemove = users.filter(user => user?.type?.toLowerCase() === "ldap").map(user => user.id);
        const updatedLocalUsers = currentLocalUsers.filter(userId => !localUsersToRemove.includes(userId));
        const updatedLdapUsers = currentLdapUsers.filter(userId => !ldapUsersToRemove.includes(userId));
        await db.query(
            "UPDATE groups SET local_user_ids = ?, ldap_user_ids = ? WHERE id = ?", 
            [
                updatedLocalUsers.length > 0 ? updatedLocalUsers.join(",") : null,
                updatedLdapUsers.length > 0 ? updatedLdapUsers.join(",") : null,
                id
            ]
        );

        res.json({ message: "Users removed from group successfully" });
    } catch (err) {
        console.error("❌ Error removing users from group:", err);
        res.status(500).json({ error: "Database error" });
    }
});

// Add Users to a Group
router.post("/groups/:id/add", async (req, res) => {
    const { id } = req.params;
    const { users } = req.body;

    if (!users || users.length === 0) {
        return res.status(400).json({ error: "No users selected for addition" });
    }

    try {
        const [group] = await db.query("SELECT local_user_ids, ldap_user_ids FROM groups WHERE id = ?", [id]);

        if (group.length === 0) return res.status(404).json({ error: "Group not found" });

        let currentLocalUsers = group[0].local_user_ids ? group[0].local_user_ids.split(",").map(Number) : [];
        let currentLdapUsers = group[0].ldap_user_ids ? group[0].ldap_user_ids.split(",").map(Number) : [];
        const localUsers = users.filter(user => user.type.toLowerCase() === "local").map(user => user.id);
        const ldapUsers = users.filter(user => user.type.toLowerCase() === "ldap").map(user => user.id);
        const updatedLocalUsers = [...new Set([...currentLocalUsers, ...localUsers])];
        const updatedLdapUsers = [...new Set([...currentLdapUsers, ...ldapUsers])];
        await db.query(
            "UPDATE groups SET local_user_ids = ?, ldap_user_ids = ? WHERE id = ?", 
            [
                updatedLocalUsers.length > 0 ? updatedLocalUsers.join(",") : null,
                updatedLdapUsers.length > 0 ? updatedLdapUsers.join(",") : null,
                id
            ]
        );

        res.json({ message: "Users added to group successfully" });
    } catch (err) {
        console.error("❌ Error adding users to group:", err);
        res.status(500).json({ error: "Database error" });
    }
});

router.get("/groups/:id/roles", async (req, res) => {
    try {
        const groupId = parseInt(req.params.id, 10);

        if (isNaN(groupId)) {
            return res.status(400).json({ error: "Invalid group ID." });
        }

        // Fetch the role_id for the given group
        const [groupResult] = await db.query(
            "SELECT role_id FROM groups WHERE id = ?",
            [groupId]
        );

        if (groupResult.length === 0) {
            return res.status(404).json({ error: `Group with ID ${groupId} does not exist.` });
        }

        const roleId = groupResult[0].role_id;

        // If no role_id is assigned, return an empty role
        if (!roleId) {
            return res.json({ role_id: null, role_name: "No Role Assigned" });
        }

        // Fetch the role name from the roles table
        const [roleResult] = await db.query(
            "SELECT roles_name FROM roles WHERE id = ?",
            [roleId]
        );

        if (roleResult.length === 0) {
            return res.json({ role_id: null, role_name: "Role Not Found" });
        }

        res.json({ role_id: roleId, role_name: roleResult[0].roles_name });
    } catch (error) {
        console.error("❌ Error fetching roles for group:", error);
        res.status(500).json({ error: "Failed to fetch roles for the group." });
    }
});

router.put("/groups/:id/update_role", async (req, res) => {
    try {
        const groupId = req.params.id;
        const { role_id } = req.body;

        if (!role_id) {
            return res.status(400).json({ error: "role_id is required." });
        }

        // Update group table with the new role_id
        const [updateResult] = await db.query("UPDATE groups SET role_id = ? WHERE id = ?", [role_id, groupId]);

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ error: `Group with ID ${groupId} not found.` });
        }

        res.json({ message: `Updated role for group ${groupId} to role ID ${role_id}` });
    } catch (error) {
        console.error("❌ Error updating role_id in groups:", error);
        res.status(500).json({ error: "Failed to update role in groups." });
    }
});

router.put("/groups/:id/remove_role", async (req, res) => {
    try {
        const groupId = parseInt(req.params.id, 10);
        const { role_id } = req.body;

        if (isNaN(groupId) || !role_id) {
            return res.status(400).json({ error: "Invalid group ID or role ID." });
        }

        // Check if the group exists
        const [groupCheck] = await db.query("SELECT * FROM groups WHERE id = ?", [groupId]);
        if (groupCheck.length === 0) {
            return res.status(404).json({ error: `Group with ID ${groupId} does not exist.` });
        }

        // Ensure the group actually has the role assigned before trying to remove it
        const [groupRoleCheck] = await db.query(
            "SELECT role_id FROM groups WHERE id = ? AND role_id = ?",
            [groupId, role_id]
        );

        if (groupRoleCheck.length === 0) {
            return res.status(404).json({ error: `Role ID ${role_id} is not assigned to group ${groupId}.` });
        }

        // Remove the role by setting it to NULL
        await db.query("UPDATE groups SET role_id = NULL WHERE id = ?", [groupId]);

        res.json({ message: `✅ Role ${role_id} removed from group ${groupId}.` });
    } catch (error) {
        console.error("❌ Error removing role from group:", error);
        res.status(500).json({ error: "Failed to remove role from group." });
    }
});

// Call function to set up the table
setupGroupsTable();

module.exports = { router, setupGroupsTable };

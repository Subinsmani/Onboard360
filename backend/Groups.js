const express = require('express');
const router = express.Router();
const db = require('./db');

// Ensure `groups` Table Exists
const createGroupsTableQuery = `
    CREATE TABLE IF NOT EXISTS groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        local_user_ids TEXT DEFAULT NULL,
        ldap_user_ids TEXT DEFAULT NULL,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`;

db.query(createGroupsTableQuery, (err) => {
    if (err) {
        console.error("❌ Error ensuring groups table exists:", err);
    }
});

// Fetch all groups
router.get('/groups', (req, res) => {
    db.query('SELECT * FROM groups', (err, results) => {
        if (err) {
            console.error('❌ Error fetching groups:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Fetch a specific group by ID
router.get('/groups/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM groups WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error('❌ Error fetching group:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (results.length === 0) return res.status(404).json({ error: 'Group not found' });
        res.json(results[0]);
    });
});

// Create a new group with IDs from `localuser` & `ldap_users`
router.post('/groups', (req, res) => {
    const { name, local_usernames = [], ldap_usernames = [] } = req.body;

    if (!name) return res.status(400).json({ error: 'Group name is required' });

    // Fetch local user IDs based on usernames
    const fetchLocalUserIds = new Promise((resolve, reject) => {
        if (local_usernames.length === 0) return resolve(null);
        db.query(
            `SELECT id FROM localuser WHERE username IN (?)`, 
            [local_usernames], 
            (err, results) => {
                if (err) return reject(err);
                resolve(results.map(row => row.id).join(','));
            }
        );
    });

    // Fetch LDAP user IDs based on usernames
    const fetchLdapUserIds = new Promise((resolve, reject) => {
        if (ldap_usernames.length === 0) return resolve(null);
        db.query(
            `SELECT ldap_user_id FROM ldap_users WHERE samaccountname IN (?)`, 
            [ldap_usernames], 
            (err, results) => {
                if (err) return reject(err);
                resolve(results.map(row => row.ldap_user_id).join(','));
            }
        );
    });

    // Execute both queries and insert into the groups table
    Promise.all([fetchLocalUserIds, fetchLdapUserIds])
        .then(([localUserIds, ldapUserIds]) => {
            db.query(
                `INSERT INTO groups (name, local_user_ids, ldap_user_ids) VALUES (?, ?, ?)`, 
                [name, localUserIds, ldapUserIds], 
                (err, result) => {
                    if (err) {
                        console.error('❌ Error creating group:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    res.status(201).json({ message: 'Group created', groupId: result.insertId });
                }
            );
        })
        .catch(err => {
            console.error('❌ Error fetching user IDs:', err);
            res.status(500).json({ error: 'Error fetching user IDs' });
        });
});

// Update group details (including user IDs)
router.put('/groups/:id', (req, res) => {
    const { id } = req.params;
    const { name, local_usernames = [], ldap_usernames = [] } = req.body;

    // Fetch updated local user IDs
    const fetchLocalUserIds = new Promise((resolve, reject) => {
        if (local_usernames.length === 0) return resolve(null);
        db.query(
            `SELECT id FROM localuser WHERE username IN (?)`, 
            [local_usernames], 
            (err, results) => {
                if (err) return reject(err);
                resolve(results.map(row => row.id).join(','));
            }
        );
    });

    // Fetch updated LDAP user IDs
    const fetchLdapUserIds = new Promise((resolve, reject) => {
        if (ldap_usernames.length === 0) return resolve(null);
        db.query(
            `SELECT ldap_user_id FROM ldap_users WHERE samaccountname IN (?)`, 
            [ldap_usernames], 
            (err, results) => {
                if (err) return reject(err);
                resolve(results.map(row => row.ldap_user_id).join(','));
            }
        );
    });

    // Execute both queries and update the groups table
    Promise.all([fetchLocalUserIds, fetchLdapUserIds])
        .then(([localUserIds, ldapUserIds]) => {
            db.query(
                `UPDATE groups SET name = ?, local_user_ids = ?, ldap_user_ids = ? WHERE id = ?`, 
                [name, localUserIds, ldapUserIds, id], 
                (err, result) => {
                    if (err) {
                        console.error('❌ Error updating group:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    if (result.affectedRows === 0) return res.status(404).json({ error: 'Group not found' });
                    res.json({ message: 'Group updated' });
                }
            );
        })
        .catch(err => {
            console.error('❌ Error fetching user IDs:', err);
            res.status(500).json({ error: 'Error fetching user IDs' });
        });
});

// Delete a group
router.delete('/groups/:id', (req, res) => {
    const { id } = req.params;

    db.query('DELETE FROM groups WHERE id = ?', [id], (err, result) => {
        if (err) {
            console.error('❌ Error deleting group:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Group not found' });
        res.json({ message: 'Group deleted' });
    });
});

// Fetch members of a specific group
router.get('/groups/:id/members', (req, res) => {
    const { id } = req.params;

    db.query(`SELECT local_user_ids, ldap_user_ids FROM groups WHERE id = ?`, [id], (err, results) => {
        if (err) {
            console.error("❌ Error fetching group members:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "Group not found" });
        }

        const { local_user_ids, ldap_user_ids } = results[0];

        // Convert to arrays ensuring no empty or invalid values
        const localUserIds = local_user_ids ? local_user_ids.split(',').map(id => id.trim()).filter(Boolean) : [];
        const ldapUserIds = ldap_user_ids ? ldap_user_ids.split(',').map(id => id.trim()).filter(Boolean) : [];

        const queries = [];

        if (localUserIds.length > 0) {
            queries.push(db.promise().query(
                `SELECT id, username AS name, 'local' AS type FROM localuser WHERE id IN (?)`, 
                [localUserIds]
            ));
        }

        if (ldapUserIds.length > 0) {
            queries.push(db.promise().query(
                `SELECT ldap_user_id AS id, samaccountname AS name, 'ldap' AS type FROM ldap_users WHERE ldap_user_id IN (?)`, 
                [ldapUserIds]
            ));
        }

        Promise.all(queries)
            .then((results) => {
                const localUsers = results[0] ? results[0][0] : [];
                const ldapUsers = results[1] ? results[1][0] : [];

                res.json([...localUsers, ...ldapUsers]);
            })
            .catch((error) => {
                console.error("❌ Error fetching group members:", error);
                res.status(500).json({ error: "Database error" });
            });
    });
});

// ✅ Remove Users from a Group
router.post("/groups/:id/remove", (req, res) => {
    const { id } = req.params;
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ error: "No users selected for removal" });
    }

    // Fetch existing group users
    db.query("SELECT local_user_ids, ldap_user_ids FROM groups WHERE id = ?", [id], (err, results) => {
        if (err) {
            console.error("❌ Error fetching group:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length === 0) return res.status(404).json({ error: "Group not found" });

        let currentLocalUsers = results[0].local_user_ids ? results[0].local_user_ids.split(",").map(Number) : [];
        let currentLdapUsers = results[0].ldap_user_ids ? results[0].ldap_user_ids.split(",").map(Number) : [];

        const localUsersToRemove = (users || []).filter(user => user?.type?.toLowerCase() === "local").map(user => user.id);
        const ldapUsersToRemove = (users || []).filter(user => user?.type?.toLowerCase() === "ldap").map(user => user.id);
        const updatedLocalUsers = currentLocalUsers.filter(userId => !localUsersToRemove.includes(userId));
        const updatedLdapUsers = currentLdapUsers.filter(userId => !ldapUsersToRemove.includes(userId));

        db.query(
            "UPDATE groups SET local_user_ids = ?, ldap_user_ids = ? WHERE id = ?", 
            [
                updatedLocalUsers.length > 0 ? updatedLocalUsers.join(",") : null,
                updatedLdapUsers.length > 0 ? updatedLdapUsers.join(",") : null,
                id
            ],
            (err, result) => {
                if (err) {
                    console.error("❌ Error removing users from group:", err);
                    return res.status(500).json({ error: "Database error" });
                }
                res.json({ message: "Users removed from group successfully" });
            }
        );
    });
});

// ✅ Add Users to a Group
router.post("/groups/:id/add", (req, res) => {
    const { id } = req.params;
    const { users } = req.body; // `users` should be an array of user objects

    if (!users || users.length === 0) {
        return res.status(400).json({ error: "No users selected for addition" });
    }

    // Fetch existing user IDs from the database
    db.query("SELECT local_user_ids, ldap_user_ids FROM groups WHERE id = ?", [id], (err, results) => {
        if (err) {
            console.error("❌ Error fetching group:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length === 0) return res.status(404).json({ error: "Group not found" });

        let currentLocalUsers = results[0].local_user_ids ? results[0].local_user_ids.split(",").map(Number) : [];
        let currentLdapUsers = results[0].ldap_user_ids ? results[0].ldap_user_ids.split(",").map(Number) : [];

        // ✅ Fix: Normalize user type to lowercase
        const localUsers = users.filter(user => user.type.toLowerCase() === "local").map(user => user.id);
        const ldapUsers = users.filter(user => user.type.toLowerCase() === "ldap").map(user => user.id);

        // Merge existing and new user IDs
        const updatedLocalUsers = [...new Set([...currentLocalUsers, ...localUsers])];
        const updatedLdapUsers = [...new Set([...currentLdapUsers, ...ldapUsers])];

        // Update the database with separate Local & LDAP users
        db.query(
            "UPDATE groups SET local_user_ids = ?, ldap_user_ids = ? WHERE id = ?", 
            [
                updatedLocalUsers.length > 0 ? updatedLocalUsers.join(",") : null,
                updatedLdapUsers.length > 0 ? updatedLdapUsers.join(",") : null,
                id
            ],
            (err, result) => {
                if (err) {
                    console.error("❌ Error adding users to group:", err);
                    return res.status(500).json({ error: "Database error" });
                }
                res.json({ message: "Users added to group successfully" });
            }
        );
    });
});

module.exports = router;

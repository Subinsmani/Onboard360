const express = require('express');
const router = express.Router();
const db = require('./db');

// Fetch all users (local & LDAP)
router.get('/users', async (req, res) => {
    try {
        const [localUsers] = await db.query(`
            SELECT id, username AS name, 'local' AS type FROM localuser
        `);

        const [ldapUsers] = await db.query(`
            SELECT ldap_user_id AS id, samaccountname AS name, 'ldap' AS type FROM ldap_users
        `);

        // Combine Local and LDAP users in one response
        res.json([...localUsers, ...ldapUsers]);

    } catch (error) {
        console.error("❌ Error fetching users:", error);
        res.status(500).json({ error: "Database error" });
    }
});

module.exports = router;

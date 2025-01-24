const express = require('express');
const router = express.Router();
const db = require('./db');

// Fetch all users (local & LDAP)
router.get('/users', (req, res) => {
    const localUsersQuery = `
        SELECT id, username AS name, 'local' AS type FROM localuser
    `;

    const ldapUsersQuery = `
        SELECT ldap_user_id AS id, samaccountname AS name, 'ldap' AS type FROM ldap_users
    `;

    db.query(localUsersQuery, (err, localUsers) => {
        if (err) {
            console.error("❌ Error fetching local users:", err);
            return res.status(500).json({ error: "Database error" });
        }

        db.query(ldapUsersQuery, (err, ldapUsers) => {
            if (err) {
                console.error("❌ Error fetching LDAP users:", err);
                return res.status(500).json({ error: "Database error" });
            }

            // Combine Local and LDAP users in one response
            res.json([...localUsers, ...ldapUsers]);
        });
    });
});

module.exports = router;

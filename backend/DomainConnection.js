const express = require('express');
const mysql = require('mysql2');
const ldap = require('ldapjs');
require('dotenv').config();
const { encryptPassword, decryptPassword } = require('./utils/encryption');

const router = express.Router();

// ✅ **Database Connection Using `createPool`**
const db = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// ✅ **Ensure Domains Table Exists**
db.getConnection((err, connection) => {
    if (err) {
        console.error("❌ Database Connection Failed:", err);
        return;
    }
    console.log("✅ Connected to MariaDB Database Onboard360");

    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS Domains (
            id INT AUTO_INCREMENT PRIMARY KEY,
            domain_name VARCHAR(255) NOT NULL UNIQUE,
            domain_controller VARCHAR(255) NOT NULL,
            read_only_user VARCHAR(255) NOT NULL,
            read_only_user_password TEXT NOT NULL,
            base_dn VARCHAR(255) NOT NULL,
            ssl_enabled ENUM('Yes', 'No') NOT NULL DEFAULT 'No',
            port INT NOT NULL,
            created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

    connection.query(createTableQuery, (err) => {
        if (err) console.error("❌ Error ensuring Domains table exists:", err);
        else console.log("✅ Domains table is ready.");
        connection.release();
    });
});

// **Get All Domains**
router.get('/domains', (req, res) => {
    const sql = `SELECT id, domain_name, domain_controller, read_only_user, base_dn, ssl_enabled, port, created_date FROM Domains`;

    db.query(sql, (err, results) => {
        if (err) {
            console.error(" Database error while fetching domains:", err);
            return res.status(500).json({ error: " Database error." });
        }
        res.json(results);
    });
});

// **Get Stored Password for a Domain**
router.get('/domains/:id/password', (req, res) => {
    const { id } = req.params;
    const sql = `SELECT read_only_user_password FROM Domains WHERE id = ?`;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error(" Error fetching stored password:", err);
            return res.status(500).json({ error: " Database error." });
        }
        if (result.length === 0) {
            return res.status(404).json({ error: " Domain not found." });
        }

        // Decrypt the password before sending it back
        const decryptedPassword = decryptPassword(result[0].read_only_user_password);
        res.json({ password: decryptedPassword });
    });
});

// **Add a New Domain with Encrypted Password**
router.post('/domains', async (req, res) => {
    const { domain_name, domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port } = req.body;

    if (!domain_name || !domain_controller || !read_only_user || !read_only_user_password || !base_dn || !ssl_enabled || !port) {
        return res.status(400).json({ error: " All fields are required." });
    }

    try {
        //**Encrypt Password Before Storing**
        const encryptedPassword = encryptPassword(read_only_user_password);

        const insertSql = `INSERT INTO Domains (domain_name, domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port) 
                           VALUES (?, ?, ?, ?, ?, ?, ?)`;

        db.query(insertSql, [domain_name, domain_controller, read_only_user, encryptedPassword, base_dn, ssl_enabled, port], (err, result) => {
            if (err) {
                console.error(" Error inserting domain:", err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: "Domain added successfully!", domainId: result.insertId });
        });

    } catch (error) {
        console.error("Error encrypting password:", error);
        res.status(500).json({ error: "Error encrypting password." });
    }
});

// **Update Domain (Keep Old Password If Not Provided)**
router.put('/domains/:id', async (req, res) => {
    const { id } = req.params;
    const { domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port } = req.body;

    if (!domain_controller || !read_only_user || !base_dn || !ssl_enabled || !port) {
        return res.status(400).json({ error: "All fields are required for updating." });
    }

    try {
        let sql, params;

        if (read_only_user_password) {
            //Encrypt new password if provided
            const encryptedPassword = encryptPassword(read_only_user_password);
            sql = `UPDATE Domains SET domain_controller=?, read_only_user=?, read_only_user_password=?, base_dn=?, ssl_enabled=?, port=? WHERE id=?`;
            params = [domain_controller, read_only_user, encryptedPassword, base_dn, ssl_enabled, port, id];
        } else {
            sql = `UPDATE Domains SET domain_controller=?, read_only_user=?, base_dn=?, ssl_enabled=?, port=? WHERE id=?`;
            params = [domain_controller, read_only_user, base_dn, ssl_enabled, port, id];
        }

        db.query(sql, params, (err) => {
            if (err) return res.status(500).json({ error: "Error updating domain." });
            res.json({ message: "Domain updated successfully!" });
        });

    } catch (error) {
        res.status(500).json({ error: " Error updating domain." });
    }
});

// **Test Active Directory Connection (LDAP Authentication)**
router.post('/test-ad-connection', async (req, res) => {
    let { domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port } = req.body;

    if (!domain_controller || !read_only_user || !base_dn || !ssl_enabled || !port) {
        return res.status(400).json({ success: false, message: "All fields are required for testing." });
    }

    try {
        //**Fetch stored password if not entered**
        if (!read_only_user_password) {
            const [rows] = await db.promise().query("SELECT read_only_user_password FROM Domains WHERE read_only_user = ?", [read_only_user]);

            if (rows.length > 0) {
                read_only_user_password = decryptPassword(rows[0].read_only_user_password);
            } else {
                console.error("No stored password found.");
                return res.status(401).json({ success: false, message: "No stored password found." });
            }
        }

        //**Try to Bind (Authenticate)**
        const ldapUrl = `${ssl_enabled === "Yes" ? "ldaps" : "ldap"}://${domain_controller}:${port}`;
        const client = ldap.createClient({ url: ldapUrl });

        client.bind(read_only_user, read_only_user_password, (err) => {
            if (err) {
                return res.status(401).json({ success: false, message: "Invalid credentials or domain controller unreachable." });
            }

            res.json({ success: true, message: "✅ Connection successful!" });
            client.unbind();
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "Error testing LDAP connection." });
    }
});

// **Get Domain Status**
router.get('/domains/:id/status', async (req, res) => {
    const { id } = req.params;

    // Fetch domain details from DB
    const sql = `SELECT domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port FROM Domains WHERE id = ?`;
    db.query(sql, [id], async (err, result) => {
        if (err) {
            console.error("Error fetching domain details:", err);
            return res.status(500).json({ error: "Database error." });
        }
        if (result.length === 0) {
            return res.status(404).json({ error: "Domain not found." });
        }

        const { domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port } = result[0];

        // Decrypt the stored password
        const decryptedPassword = decryptPassword(read_only_user_password);

        try {
            // Construct LDAP URL
            const ldapUrl = `${ssl_enabled === "Yes" ? "ldaps" : "ldap"}://${domain_controller}:${port}`;
            const client = ldap.createClient({ url: ldapUrl });

            // Attempt to bind (authenticate)
            client.bind(read_only_user, decryptedPassword, (err) => {
                if (err) {
                    console.error(`Domain ${id} unreachable:`, err);
                    return res.json({ status: "Inactive" }); // Failed connection
                }

                // If bind is successful
                res.json({ status: "Active" });

                // Unbind after the check
                client.unbind();
            });
        } catch (error) {
            console.error("LDAP Connection Error:", error);
            res.json({ status: "Inactive" });
        }
    });
});

module.exports = router;

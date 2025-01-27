const express = require('express');
const bcrypt = require('bcrypt');
require('dotenv').config();

const router = express.Router();
const db = require('./db');

async function setupLocalUserTable() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS LocalUser (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                status ENUM('Active', 'Inactive', 'Suspended') NOT NULL DEFAULT 'Active',
                disabled_date TIMESTAMP NULL DEFAULT NULL,
                email_address VARCHAR(255) UNIQUE NOT NULL,
                phone_number VARCHAR(20) NOT NULL
            )
        `);
    } catch (error) {
        console.error("❌ Error ensuring LocalUser table exists:", error);
    }
}

// Add a New Local User
router.post('/localusers', async (req, res) => {
    const { username, first_name, last_name, password, email_address, phone_number, status = "Active", group_id } = req.body;

    if (!username || !first_name || !last_name || !password || !email_address || !phone_number) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [existingUsers] = await db.query(`SELECT * FROM LocalUser WHERE username = ? OR email_address = ?`, [username, email_address]);

        if (existingUsers.length > 0) {
            return res.status(409).json({ error: "Username or Email already exists" });
        }

        const [insertResult] = await db.query(
            `INSERT INTO LocalUser (username, first_name, last_name, password, created_date, status, email_address, phone_number) 
             VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)`,
            [username, first_name, last_name, hashedPassword, status, email_address, phone_number]
        );

        const newUserId = insertResult.insertId;
        if (group_id) {
            await db.query(
                `UPDATE groups 
                 SET local_user_ids = 
                     CASE 
                         WHEN local_user_ids IS NULL OR local_user_ids = '' 
                         THEN ? 
                         ELSE CONCAT(local_user_ids, ',', ?) 
                     END
                 WHERE id = ?`,
                [newUserId, newUserId, group_id]
            );
        }

        res.json({ message: "User added successfully", userId: newUserId });

    } catch (error) {
        res.status(500).json({ error: "Database error" });
    }
});

// Get All Local Users
router.get('/localusers', async (req, res) => {
    try {
        const [results] = await db.query(`SELECT id, username, first_name, last_name, created_date, status, email_address, phone_number FROM LocalUser`);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: "Database error" });
    }
});

// Delete Selected Local Users
router.post('/localusers/delete', async (req, res) => {
    const { userIds } = req.body;

    if (!userIds || userIds.length === 0) {
        return res.status(400).json({ error: "No local users selected for deletion" });
    }

    try {
        const [result] = await db.query(`DELETE FROM LocalUser WHERE id IN (?)`, [userIds]);
        res.json({ message: `${result.affectedRows} local users deleted successfully` });
    } catch (error) {
        res.status(500).json({ error: "Database error while deleting local users" });
    }
});

// Authenticate User (Login)
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and Password are required" });
    }

    try {
        const [users] = await db.query("SELECT * FROM LocalUser WHERE username = ?", [username]);

        if (users.length === 0) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        res.json({ message: "Login successful", userId: user.id, username: user.username });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Database error" });
    }
});

// Ensure LocalUser table exists before starting
setupLocalUserTable();

module.exports = router;

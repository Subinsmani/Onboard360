const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
require('dotenv').config();

const router = express.Router();
const db = require('./db');

// ✅ Ensure `LocalUser` Table Exists
const createLocalUserTableQuery = `
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
`;

db.query(createLocalUserTableQuery, (err) => {
    if (err) {
        console.error("❌ Error ensuring LocalUser table exists:", err);
    } else {
        console.log("✅ LocalUser table is ready.");
    }
});

// ✅ Add a New Local User
router.post('/localusers', async (req, res) => {
  const { username, first_name, last_name, password, email_address, phone_number, status = "Active", group_id } = req.body;

  if (!username || !first_name || !last_name || !password || !email_address || !phone_number) {
      return res.status(400).json({ error: "All fields are required" });
  }

  try {
      const hashedPassword = await bcrypt.hash(password, 10);

      // Check if the username or email already exists
      const checkSql = `SELECT * FROM LocalUser WHERE username = ? OR email_address = ?`;
      db.query(checkSql, [username, email_address], (err, results) => {
          if (err) return res.status(500).json({ error: "Database error" });

          if (results.length > 0) {
              return res.status(409).json({ error: "Username or Email already exists" });
          }

          const insertSql = `INSERT INTO LocalUser (username, first_name, last_name, password, created_date, status, email_address, phone_number) 
                             VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)`;

          db.query(insertSql, [username, first_name, last_name, hashedPassword, status, email_address, phone_number], (err, result) => {
              if (err) {
                  return res.status(500).json({ error: err.message });
              }

              const newUserId = result.insertId;

              // ✅ Add User to Selected Group's `local_user_ids`
              if (group_id) {
                  const updateGroupSql = `
                      UPDATE groups 
                      SET local_user_ids = 
                          CASE 
                              WHEN local_user_ids IS NULL OR local_user_ids = '' 
                              THEN ? 
                              ELSE CONCAT(local_user_ids, ',', ?) 
                          END
                      WHERE id = ?
                  `;
                  
                  db.query(updateGroupSql, [newUserId, newUserId, group_id], (err) => {
                      if (err) {
                          console.error("❌ Error updating group:", err);
                          return res.status(500).json({ error: "Error adding user to group" });
                      }
                      res.json({ message: "User added successfully", userId: newUserId });
                  });
              } else {
                  res.json({ message: "User added successfully", userId: newUserId });
              }
          });
      });

  } catch (error) {
      res.status(500).json({ error: "Error hashing password" });
  }
});

// ✅ Get All Local Users
router.get('/localusers', (req, res) => {
    const sql = `SELECT id, username, first_name, last_name, created_date, status, email_address, phone_number FROM LocalUser`;

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// ✅ Delete Selected Local Users
router.post('/localusers/delete', (req, res) => {
    const { userIds } = req.body;

    if (!userIds || userIds.length === 0) {
        return res.status(400).json({ error: "No local users selected for deletion" });
    }

    const sql = `DELETE FROM LocalUser WHERE id IN (?)`;
    db.query(sql, [userIds], (err, result) => {
        if (err) {
            return res.status(500).json({ error: "Database error while deleting local users" });
        }
        res.json({ message: `${result.affectedRows} local users deleted successfully` });
    });
});

// ✅ Authenticate User (Login)
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and Password are required" });
    }

    const sql = "SELECT * FROM LocalUser WHERE username = ?";
    db.query(sql, [username], async (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });

        if (results.length === 0) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        res.json({ message: "Login successful", userId: user.id, username: user.username });
    });
});

module.exports = router;

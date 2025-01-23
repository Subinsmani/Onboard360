const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
require('dotenv').config();

const router = express.Router();

// **Improved Database Connection Using `createPool`**
const db = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// **Ensure LocalUser Table Exists**
db.getConnection((err, connection) => {
  if (err) {
    console.error("Database Connection Failed:", err);
    return;
  }
  console.log("✅ Connected to MariaDB Database Onboard360");

  const createTableQuery = `
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
      phone_number VARCHAR(20) NOT NULL,
      group_id INT DEFAULT NULL,
      FOREIGN KEY (group_id) REFERENCES Groups(id) ON DELETE SET NULL
    )`;

  connection.query(createTableQuery, (err) => {
    if (err) console.error("Error ensuring LocalUser table exists:", err);
    else console.log("✅ LocalUser table is ready.");
    connection.release();
  });
});

// ** Add a New Local User with Group Selection**
router.post('/users', async (req, res) => {
  const { username, first_name, last_name, password, email_address, phone_number, group_id, status = "Active" } = req.body;

  if (!username || !first_name || !last_name || !password || !email_address || !phone_number || !group_id) {
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

      const insertSql = `INSERT INTO LocalUser (username, first_name, last_name, password, created_date, status, email_address, phone_number, group_id) 
                         VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?)`;

      db.query(insertSql, [username, first_name, last_name, hashedPassword, status, email_address, phone_number, group_id], (err, result) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: "User added successfully", userId: result.insertId });
      });
    });

  } catch (error) {
    res.status(500).json({ error: "Error hashing password" });
  }
});

// ** Get All Local Users with Group Name**
router.get('/users', (req, res) => {
  const sql = `
    SELECT 
      LocalUser.id, 
      LocalUser.username, 
      LocalUser.first_name, 
      LocalUser.last_name, 
      LocalUser.created_date, 
      LocalUser.status, 
      LocalUser.email_address, 
      LocalUser.phone_number, 
      Groups.name AS group_name
    FROM LocalUser
    LEFT JOIN Groups ON LocalUser.group_id = Groups.id
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// ** Delete Selected Users**
router.post('/users/delete', (req, res) => {
  const { userIds } = req.body;

  if (!userIds || userIds.length === 0) {
    return res.status(400).json({ error: "No users selected for deletion" });
  }

  const sql = `DELETE FROM LocalUser WHERE id IN (?)`;
  db.query(sql, [userIds], (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Database error while deleting users" });
    }
    res.json({ message: `${result.affectedRows} users deleted successfully` });
  });
});

// ** Authenticate User (Login)**
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

// ** Fetch Available Groups for Dropdown**
router.get('/groups', (req, res) => {
  const sql = `SELECT id, name FROM Groups`;
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

module.exports = router;

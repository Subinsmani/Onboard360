const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// ✅ Ensure the database connection works
db.getConnection((err, connection) => {
    if (err) {
        console.error("❌ Database Connection Failed:", err);
        process.exit(1); // Exit if DB connection fails
    } else {
        console.log(`✅ Connected to Database: ${process.env.DB_NAME}`);
        connection.release(); // Release connection back to the pool
    }
});

module.exports = db;

const mysql = require("mysql2/promise");
require("dotenv").config();

const db = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    queueLimit: 0
});

// Ensure the database connection works
async function testDatabaseConnection() {
    try {
        const connection = await db.getConnection();
        console.log(`✅ Connected to Database: ${process.env.DB_NAME}`);
        connection.release(); // Release connection back to the pool
    } catch (err) {
        console.error("❌ Database Connection Failed:", err);
        process.exit(1); // Exit if DB connection fails
    }
}

testDatabaseConnection();

module.exports = db;

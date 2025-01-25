const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const db = require("../../db");

const PERMISSIONS_FILE = path.join(__dirname, "./permissions.text");

// Ensure `permissions` table exists before use
async function setupPermissionsTable() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS permissions (
                id INT UNSIGNED NOT NULL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
        `);

        console.log("✅ Permissions table is ready.");
        await updatePermissionsFromFile();
    } catch (error) {
        console.error("❌ Error setting up permissions table:", error);
    }
}

// Read permissions from file and update the database
async function updatePermissionsFromFile() {
    try {
        if (!fs.existsSync(PERMISSIONS_FILE)) {
            console.error("❌ Permissions file not found:", PERMISSIONS_FILE);
            return;
        }

        const fileContent = fs.readFileSync(PERMISSIONS_FILE, "utf8");
        const lines = fileContent.split("\n").map(line => line.trim()).filter(line => line);

        if (lines.length === 0) {
            console.warn("⚠️ Permissions file is empty. No updates applied.");
            return;
        }

        await db.query("DELETE FROM permissions");

        for (const line of lines) {
            const [id, ...nameParts] = line.split(" ");
            const name = nameParts.join(" ").trim();

            if (!id || !name) {
                console.warn(`⚠️ Invalid entry in permissions file: "${line}"`);
                continue;
            }

            await db.query(
                "INSERT INTO permissions (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = name;",
                [id, name]
            );
        }
    } catch (error) {
        console.error("❌ Error updating permissions from file:", error);
    }
}

// Get all permissions
router.get("/permissions", async (req, res) => {
    try {
        const [permissions] = await db.query("SELECT id, name FROM permissions");
        res.json(permissions);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch permissions" });
    }
});

// Ensure the table is set up before use
setupPermissionsTable();

module.exports = { setupPermissionsTable, router };

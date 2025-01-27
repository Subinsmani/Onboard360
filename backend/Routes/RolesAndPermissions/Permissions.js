const express = require("express");
const router = express.Router();
const db = require("../../db");

// API to get all permissions
router.get("/permissions", async (req, res) => {
    try {
        const [permissions] = await db.query("SELECT id, name FROM permissions");
        res.json(permissions);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch permissions" });
    }
});

module.exports = { router };

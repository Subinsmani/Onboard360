const db = require("../db");
const fs = require("fs").promises;
const path = require("path");

// Function to create `permissions` table and synchronize with permissions.text
async function setupPermissionsTable() {
    let connection;

    try {
        // Get a connection from the pool
        connection = await db.getConnection();

        // Create the permissions table if it doesn't exist
        await connection.query(`
            CREATE TABLE IF NOT EXISTS permissions (
                id INT UNSIGNED NOT NULL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
        `);
        console.log("✅ Permissions table is ready.");

        // Path to the permissions.text file
        const permissionsFilePath = path.join(__dirname, "RolesAndPermissions", "permissions.text");

        // Read and parse the permissions.text file
        const fileContent = await fs.readFile(permissionsFilePath, "utf-8");
        const permissionsFromFile = fileContent
            .split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => {
                const [idStr, ...nameParts] = line.split(" ");
                return {
                    id: parseInt(idStr, 10),
                    name: nameParts.join(" ")
                };
            });

        // Fetch current permissions from the database
        const [currentPermissions] = await connection.query("SELECT id, name FROM permissions");
        const currentPermissionsMap = new Map();
        currentPermissions.forEach(permission => {
            currentPermissionsMap.set(permission.id, permission.name);
        });

        // Prepare lists for additions and deletions
        const permissionsToAdd = [];
        const permissionsToRemove = [];

        const filePermissionsMap = new Map();
        permissionsFromFile.forEach(permission => {
            filePermissionsMap.set(permission.id, permission.name);
            if (!currentPermissionsMap.has(permission.id)) {
                permissionsToAdd.push(permission);
            }
        });

        // Identify permissions to remove
        currentPermissions.forEach(permission => {
            if (!filePermissionsMap.has(permission.id)) {
                permissionsToRemove.push(permission.id);
            }
        });

        // If there are no changes, exit the function
        if (permissionsToAdd.length === 0 && permissionsToRemove.length === 0) {
            return;
        }

        // Begin transaction
        await connection.beginTransaction();

        try {
            // Add new permissions
            if (permissionsToAdd.length > 0) {
                const insertValues = permissionsToAdd
                    .map(() => "(?, ?)")
                    .join(", ");
                const insertParams = [];
                permissionsToAdd.forEach(p => {
                    insertParams.push(p.id, p.name);
                });
                await connection.query(`INSERT INTO permissions (id, name) VALUES ${insertValues}`, insertParams);
            }

            // Remove deleted permissions
            if (permissionsToRemove.length > 0) {
                const placeholders = permissionsToRemove.map(() => "?").join(", ");
                await connection.query(`DELETE FROM permissions WHERE id IN (${placeholders})`, permissionsToRemove);
            }

            // Commit transaction
            await connection.commit();
        } catch (transactionError) {
            // Rollback transaction in case of error
            await connection.rollback();
            throw transactionError;
        }

    } catch (error) {
        console.error("Error setting up permissions table:", error);
    } finally {
        if (connection) connection.release();
    }
}

// Function to create `roles` table and ensure the Super Admin role exists
async function setupRolesTable() {
    try {
        await setupPermissionsTable();

        await db.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                roles_name VARCHAR(255) NOT NULL UNIQUE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
        `);
        console.log("✅ Roles table is ready.");

        // Ensure Super Admin role exists
        const [[{ count }]] = await db.query("SELECT COUNT(*) AS count FROM roles WHERE id = 1;");
        if (count === 0) {
            await db.query("INSERT INTO roles (id, roles_name) VALUES (1, 'Super Admin');");
        }
    } catch (error) {
        console.error("Error setting up roles table:", error);
    }
}

// Function to create `role_permissions` table
async function setupRolePermissionsTable() {
    try {
        await setupRolesTable();
        await setupPermissionsTable();

        // Create the role_permissions table if it doesn't exist
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS role_permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                role_id INT UNSIGNED NOT NULL,
                permission_id INT UNSIGNED NOT NULL,
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `;
        
        await db.query(createTableQuery);
        console.log("✅ role_permissions table is ready.");

        // Ensure the default role_permissions (1, 1) exists for the Super Admin role
        const [[{ count }]] = await db.query(`
            SELECT COUNT(*) AS count 
            FROM role_permissions 
            WHERE role_id = 1 AND permission_id = 1;
        `);

        if (count === 0) {
            await db.query(`
                INSERT INTO role_permissions (role_id, permission_id) 
                VALUES (1, 1);
            `);
        }

    } catch (error) {
        console.error("Error setting up role_permissions table:", error);
    }
}

// Initialize tables setup in correct order
async function setupTables() {
    try {
        await setupPermissionsTable();
        await setupRolesTable();
        await setupRolePermissionsTable();
    } catch (error) {
        console.error("Error setting up tables:", error);
    }
}

// Export function to be used in `index.js`
module.exports = { setupTables };

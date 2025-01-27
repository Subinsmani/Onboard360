const db = require("../db");

// Function to create `permissions` table and insert default permission
async function setupPermissionsTable() {
    try {
        const [[{ count }]] = await db.query("SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_name = 'permissions'");

        if (count === 0) {
            // Create the permissions table if it doesn't exist
            await db.query(`
                CREATE TABLE IF NOT EXISTS permissions (
                    id INT UNSIGNED NOT NULL PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
            `);
            console.log("✅ Permissions table is ready.");
        }

        // Insert the default permission "Onboard360_Admin" if the table is empty
        await insertDefaultPermission();
    } catch (error) {
        console.error("Error setting up permissions table:", error);
    }
}

// Insert the default "Onboard360_Admin" permission into the permissions table
async function insertDefaultPermission() {
    try {
        const [[{ count }]] = await db.query("SELECT COUNT(*) AS count FROM permissions WHERE name = 'Onboard360_Admin'");

        if (count === 0) {
            // Insert the default "Onboard360_Admin" permission
            await db.query("INSERT INTO permissions (id, name) VALUES (1, 'Onboard360_Admin')");
        }
    } catch (error) {
        console.error("Error inserting default permission:", error);
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

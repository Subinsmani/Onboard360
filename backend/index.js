const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Import Routes
const localUsersRoutes = require("./LocalUsers");
const domainConnectionRoutes = require("./DomainConnection");
const groupsRoutes = require("./Groups").router;
const usersRoutes = require("./Users");

// Import Role & Permission Routes
const permissionsRoutes = require("./Routes/RolesAndPermissions/Permissions").router;
const rolesRoutes = require("./Routes/RolesAndPermissions/Roles").router;
const rolePermissionsRoutes = require("./Routes/RolesAndPermissions/RolePermissions").router;

// Ensure all database tables are created in the correct order
const { setupPermissionsTable } = require("./Routes/RolesAndPermissions/Permissions");
const { setupRolesTable } = require("./Routes/RolesAndPermissions/Roles");
const { setupRolePermissionsTable } = require("./Routes/RolesAndPermissions/RolePermissions");

// Function to setup database before starting the server
async function setupDatabase() {
  try {
    console.log("🚀 Setting up database tables...");
    await setupPermissionsTable();
    await setupRolesTable();
    await setupRolePermissionsTable();

    // Register API routes (only after database setup)
    app.use("/api", localUsersRoutes);
    app.use("/api", domainConnectionRoutes);
    app.use("/api", groupsRoutes);
    app.use("/api", usersRoutes);
    app.use("/api", permissionsRoutes);
    app.use("/api", rolesRoutes);
    app.use("/api", rolePermissionsRoutes);

    // Start the server only after all tables are set up
    app.listen(PORT, () => {
      console.log(`✅ Server is running on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Error setting up database:", error);
    process.exit(1); // Exit process if database setup fails
  }
}

// Initialize the database and start the server
setupDatabase();

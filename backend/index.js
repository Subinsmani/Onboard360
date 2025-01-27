const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
const { setupTables } = require("./Routes/CreateTables");

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

// Setup database tables before starting the server
setupTables().then(() => {
    // Register API routes after database setup
    app.use("/api", localUsersRoutes);
    app.use("/api", domainConnectionRoutes);
    app.use("/api", groupsRoutes);
    app.use("/api", usersRoutes);
    app.use("/api", permissionsRoutes);
    app.use("/api", rolesRoutes);
    app.use("/api", rolePermissionsRoutes);

    // Start the server
    app.listen(PORT, () => {
        console.log(`✅ Server is running on port ${PORT}`);
    });
}).catch((error) => {
    console.error("❌ Error during database setup:", error);
    process.exit(1);
});

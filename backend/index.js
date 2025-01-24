const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Import Routes
const localUsersRoutes = require('./LocalUsers');
const domainConnectionRoutes = require('./DomainConnection');
const groupsRoutes = require('./Groups');
const usersRoutes = require('./Users');

app.use('/api', localUsersRoutes);
app.use('/api', domainConnectionRoutes);
app.use('/api', groupsRoutes);
app.use('/api', usersRoutes);

// Start the Server
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});

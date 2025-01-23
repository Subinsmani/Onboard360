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

app.use('/api', localUsersRoutes);
app.use('/api', domainConnectionRoutes);

// Start the Server
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});

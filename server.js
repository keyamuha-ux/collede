require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { ClerkExpressWithAuth } = require('@clerk/clerk-sdk-node');

const apiRouter = require('./api/index');
const adminApiRouter = require('./api/admin_api');
const userApiRouter = require('./api/user_api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Authentication Middleware
app.use(ClerkExpressWithAuth());

// Static files
app.use(express.static('public'));
app.use('/admin', express.static('admin'));

// Clean URLs for main pages
app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

app.get('/models', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'models.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Routes
app.use('/v1', apiRouter);
app.use('/api/admin', adminApiRouter);
app.use('/api/user', userApiRouter);

// Fallback for SPA (if needed)
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Collede server running on http://localhost:${PORT}`);
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import routes
const membersRouter = require('./routes/members');
const accountsRouter = require('./routes/accounts');
const transactionsRouter = require('./routes/transactions');
const loansRouter = require('./routes/loans');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Cooperative Savings System',
    version: '1.0.0'
  });
});

// API routes
app.use('/api/members', membersRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/loans', loansRouter);
app.use('/api/reports', reportsRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Cooperative Savings System API',
    version: '1.0.0',
    endpoints: {
      members: '/api/members',
      accounts: '/api/accounts',
      transactions: '/api/transactions',
      loans: '/api/loans',
      reports: '/api/reports',
      health: '/health'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    available_endpoints: [
      '/api/members',
      '/api/accounts',
      '/api/transactions',
      '/api/loans',
      '/api/reports',
      '/health'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: error.message
    });
  }
  
  if (error.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({
      error: 'Duplicate Entry',
      message: 'A record with this value already exists'
    });
  }
  
  if (error.code === '23503') { // PostgreSQL foreign key violation
    return res.status(400).json({
      error: 'Reference Error',
      message: 'Referenced record does not exist'
    });
  }
  
  // Default error response
  res.status(error.status || 500).json({
    error: error.name || 'Internal Server Error',
    message: error.message || 'An unexpected error occurred'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                Cooperative Savings System                     ║
║                      API Server                              ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on port: ${PORT.toString().padEnd(45)} ║
║  Environment: ${process.env.NODE_ENV || 'development'.padEnd(37)} ║
║  Health check: http://localhost:${PORT}/health${' '.repeat(33 - PORT.toString().length)} ║
║  API Documentation: http://localhost:${PORT}/${' '.repeat(35 - PORT.toString().length)} ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;

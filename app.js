const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./src/routes');

const app = express();

// Middleware
app.use(helmet());

// Enhanced CORS configuration for browser extension
app.use(cors({
  origin: [
    'chrome-extension://*',
    'moz-extension://*',
    'safari-extension://*',
    'http://localhost:*',
    'https://localhost:*',
    'https://platform-frontend-gamma-two.vercel.app',
    'https://extensionbackend-production-cf91.up.railway.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-api-key',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['x-api-key']
}));

// Custom request logging middleware for performance tracking
app.use((req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  // Log request details for debugging
  console.log(`[REQUEST_DEBUG] ${req.method} ${req.path}`, {
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    hasBody: !!req.body,
    bodyType: typeof req.body,
    bodyKeys: req.body ? Object.keys(req.body) : 'no body',
    rawBody: req.body
  });
  
  res.send = function(data) {
    const duration = Date.now() - startTime;
    console.log(`[REQUEST] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`, {
      userAgent: req.get('User-Agent')?.substring(0, 50) + '...',
      contentLength: res.get('Content-Length') || 'unknown',
      timestamp: new Date().toISOString()
    });
    
    // Log slow requests (>1 second)
    if (duration > 1000) {
      console.warn(`[SLOW_REQUEST] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms) - This request took longer than 1 second`);
    }
    
    originalSend.call(this, data);
  };
  
  next();
});

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: 'text/plain', limit: '10mb' }));

// Public health check (no auth)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Additional health check for API endpoints
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    api: 'running',
    timestamp: new Date().toISOString(),
    cors: 'enabled'
  });
});

// Routes - CHANGED THIS LINE
app.use('/api', routes);

// File upload & validation error handling
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large (max 5MB)' });
  }

  if (err.message === 'Only PDFs are allowed') {
    return res.status(400).json({ error: 'Invalid file type' });
  }

  next(err);
});

// Centralized error handling
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const requestInfo = {
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    headers: {
      'x-api-key': req.headers['x-api-key'] ? 'present' : 'missing',
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length']
    },
    body: req.body ? {
      hasBody: true,
      bodyType: typeof req.body,
      bodyKeys: Object.keys(req.body || {}),
      bodySize: JSON.stringify(req.body || {}).length
    } : { hasBody: false }
  };

  console.error(`[ERROR] ${timestamp} - ${req.method} ${req.path}:`, {
    message: err.message,
    stack: err.stack,
    code: err.code,
    name: err.name,
    request: requestInfo
  });

  const msg = err.message || 'An unexpected error occurred';

  // Only treat as "Invalid API key" if it's explicitly about an invalid key
  // Don't convert database errors or other system errors to "Invalid API key"
  if (msg.includes('Invalid API key') || msg === 'API key is required') {
    console.log(`[ERROR] API key validation error for ${req.method} ${req.path}`);
    return res.status(401).json({ error: 'Invalid API key', message: msg });
  }
  
  // Check for database connection errors
  if (
    (err.code && (
      err.code.startsWith('P1') || // Prisma connection errors
      err.code === 'ECONNREFUSED' ||
      err.code === 'ETIMEDOUT' ||
      err.code === 'ENOTFOUND'
    )) ||
    err.name === 'PrismaClientKnownRequestError' ||
    err.name === 'PrismaClientInitializationError' ||
    err.name === 'PrismaClientUnknownRequestError'
  ) {
    console.log(`[ERROR] Database connection error for ${req.method} ${req.path}`);
    return res.status(503).json({ 
      error: 'Service temporarily unavailable', 
      errorCode: 'DATABASE_ERROR',
      message: 'Database connection error. Please try again in a moment.' 
    });
  }

  if (msg.includes('quota') || msg.includes('rate limit')) {
    console.log(`[ERROR] Rate limit error for ${req.method} ${req.path}`);
    return res.status(429).json({ error: 'Rate limit exceeded', message: msg });
  }

  if (err.code === 'P2002') {
    console.log(`[ERROR] Database unique constraint violation for ${req.method} ${req.path}`);
    return res.status(409).json({ error: 'Duplicate entry', message: 'A record with this information already exists' });
  }

  if (err.code === 'P2025') {
    console.log(`[ERROR] Database record not found for ${req.method} ${req.path}`);
    return res.status(404).json({ error: 'Record not found', message: 'The requested record could not be found' });
  }

  console.log(`[ERROR] Unhandled error for ${req.method} ${req.path}:`, {
    errorType: 'unhandled',
    message: msg,
    code: err.code
  });

  res.status(500).json({ error: 'Internal server error', message: msg });
});

module.exports = app;
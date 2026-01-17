const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./src/routes');
const { auditLogMiddleware } = require('./src/middleware/auditLog');

const app = express();

// Middleware
// Configure Helmet to work with CORS (especially for Chrome extensions)
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow cross-origin requests
  contentSecurityPolicy: false, // Disable CSP for API endpoints (can be enabled later with proper config)
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
  crossOriginOpenerPolicy: false // Allow cross-origin opener
}));

// Enhanced CORS configuration for browser extension
// Chrome extensions use a unique origin format, so we need to allow all origins
app.use(cors({
  origin: function (origin, callback) {
    // Always allow requests with no origin (Chrome extensions, Postman, curl, etc.)
    if (!origin) {
      console.log('[CORS] Allowing request with no origin header');
      return callback(null, true);
    }
    
    console.log('[CORS] Checking origin:', origin);
    
    // Allow Chrome extensions
    if (origin.startsWith('chrome-extension://')) {
      console.log('[CORS] Allowing Chrome extension origin');
      return callback(null, true);
    }
    
    // Allow Firefox extensions
    if (origin.startsWith('moz-extension://')) {
      console.log('[CORS] Allowing Firefox extension origin');
      return callback(null, true);
    }
    
    // Allow Safari extensions
    if (origin.startsWith('safari-extension://')) {
      console.log('[CORS] Allowing Safari extension origin');
      return callback(null, true);
    }
    
    // Allow localhost (any port)
    if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
      console.log('[CORS] Allowing localhost origin');
      return callback(null, true);
    }
    
    // Allow specific production domains
    const allowedOrigins = [
    'https://platform-frontend-gamma-two.vercel.app',
      'https://extensionbackend-production-cf91.up.railway.app',
      'https://app.mentorquedu.com'
    ];
    
    if (allowedOrigins.includes(origin)) {
      console.log('[CORS] Allowing production origin');
      return callback(null, true);
    }
    
    // Default: allow all (for Chrome extensions which may have varying origins)
    console.log('[CORS] Allowing origin (default)');
    callback(null, true);
  },
  credentials: false, // Changed to false to match frontend (credentials: 'omit')
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-api-key',
    'X-API-Key',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['x-api-key', 'X-API-Key'],
  preflightContinue: false,
  optionsSuccessStatus: 204
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

// Audit logging middleware - captures all requests and responses
// Placed after body parsing but before routes to capture all API calls
app.use(auditLogMiddleware);

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

// Import unified error handling
const { sendErrorResponse, normalizeError, ERROR_CODES } = require('./src/utils/errors');

// File upload & validation error handling
app.use((err, req, res, next) => {
  // Handle multer file size errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return sendErrorResponse(res, err);
  }

  // Handle file type validation errors (from fileUpload middleware)
  if (err.errorCode === 'INVALID_FILE_TYPE' || err.message === 'Only PDFs are allowed') {
    return sendErrorResponse(res, err);
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

  // Normalize and log the error
  const normalizedError = normalizeError(err);
  
  console.error(`[ERROR] ${timestamp} - ${req.method} ${req.path}:`, {
    errorCode: normalizedError.errorCode,
    message: normalizedError.message,
    statusCode: normalizedError.statusCode,
    stack: err.stack,
    originalError: {
      name: err.name,
      code: err.code,
      message: err.message
    },
    request: requestInfo
  });

  // Note: Slack notifications are handled by audit log middleware
  // to avoid duplicate notifications and ensure we have complete data

  // Send standardized error response
  return sendErrorResponse(res, normalizedError);
});

module.exports = app;
// backend/src/utils/errors.js

/**
 * Standardized Error Codes
 */
const ERROR_CODES = {
  // Authentication & Authorization (401, 403)
  INVALID_API_KEY: 'INVALID_API_KEY',
  MISSING_API_KEY: 'MISSING_API_KEY',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_ERROR: 'AUTH_ERROR',
  FORBIDDEN: 'FORBIDDEN',
  API_KEY_INACTIVE: 'API_KEY_INACTIVE',
  USER_DELETED: 'USER_DELETED',
  USER_NOT_VERIFIED: 'USER_NOT_VERIFIED',
  DATA_ERROR: 'DATA_ERROR',
  
  // Validation Errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_FIELD: 'INVALID_FIELD',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_JSON: 'INVALID_JSON',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Not Found (404)
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  
  // Conflict (409)
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Rate Limiting (429)
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Server Errors (500, 503)
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  
  // AI/LLM Errors
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
  AI_INVALID_RESPONSE: 'AI_INVALID_RESPONSE',
  AI_TIMEOUT: 'AI_TIMEOUT',
};

/**
 * HTTP Status Code Mapping
 */
const ERROR_STATUS_MAP = {
  [ERROR_CODES.INVALID_API_KEY]: 401,
  [ERROR_CODES.MISSING_API_KEY]: 401,
  [ERROR_CODES.AUTH_REQUIRED]: 401,
  [ERROR_CODES.AUTH_ERROR]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.API_KEY_INACTIVE]: 403,
  [ERROR_CODES.USER_DELETED]: 403,
  [ERROR_CODES.USER_NOT_VERIFIED]: 403,
  [ERROR_CODES.DATA_ERROR]: 500,
  
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.MISSING_FIELD]: 400,
  [ERROR_CODES.INVALID_FIELD]: 400,
  [ERROR_CODES.INVALID_FILE_TYPE]: 400,
  [ERROR_CODES.FILE_TOO_LARGE]: 413,
  [ERROR_CODES.INVALID_JSON]: 400,
  [ERROR_CODES.INVALID_FORMAT]: 400,
  
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.RESOURCE_NOT_FOUND]: 404,
  [ERROR_CODES.RECORD_NOT_FOUND]: 404,
  
  [ERROR_CODES.DUPLICATE_ENTRY]: 409,
  [ERROR_CODES.ALREADY_EXISTS]: 409,
  
  [ERROR_CODES.QUOTA_EXCEEDED]: 429,
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 429,
  
  [ERROR_CODES.INTERNAL_SERVER_ERROR]: 500,
  [ERROR_CODES.DATABASE_ERROR]: 500,
  [ERROR_CODES.DATABASE_CONNECTION_ERROR]: 503,
  [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 502,
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
  [ERROR_CODES.CONFIGURATION_ERROR]: 500,
  
  [ERROR_CODES.AI_SERVICE_ERROR]: 502,
  [ERROR_CODES.AI_QUOTA_EXCEEDED]: 429,
  [ERROR_CODES.AI_INVALID_RESPONSE]: 502,
  [ERROR_CODES.AI_TIMEOUT]: 504,
};

/**
 * Custom Error Classes
 */
class AppError extends Error {
  constructor(errorCode, message, statusCode = null, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.errorCode = errorCode;
    this.statusCode = statusCode || ERROR_STATUS_MAP[errorCode] || 500;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: this.getErrorName(),
      errorCode: this.errorCode,
      message: this.message,
      ...(this.details && { details: this.details }),
      timestamp: this.timestamp
    };
  }

  getErrorName() {
    // Convert error code to readable name
    return this.errorCode
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(ERROR_CODES.VALIDATION_ERROR, message, null, details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', details = null) {
    super(ERROR_CODES.AUTH_ERROR, message, null, details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(ERROR_CODES.NOT_FOUND, message, null, details);
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database error occurred', details = null) {
    super(ERROR_CODES.DATABASE_ERROR, message, null, details);
  }
}

class QuotaError extends AppError {
  constructor(message = 'Quota exceeded', details = null) {
    super(ERROR_CODES.QUOTA_EXCEEDED, message, null, details);
  }
}

class ExternalServiceError extends AppError {
  constructor(message = 'External service error', details = null) {
    super(ERROR_CODES.EXTERNAL_SERVICE_ERROR, message, null, details);
  }
}

/**
 * Standardized Error Response Format
 */
function createErrorResponse(errorCode, message, statusCode = null, details = null) {
  const status = statusCode || ERROR_STATUS_MAP[errorCode] || 500;
  const errorName = errorCode
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');

  return {
    success: false,
    error: errorName,
    errorCode: errorCode,
    message: message,
    ...(details && { details: details }),
    timestamp: new Date().toISOString()
  };
}

/**
 * Handle and normalize errors from various sources
 */
function normalizeError(error) {
  // If it's already an AppError, return it
  if (error instanceof AppError) {
    return error;
  }

  // Handle Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    return handlePrismaError(error);
  }

  if (error.name === 'PrismaClientInitializationError' || 
      error.name === 'PrismaClientUnknownRequestError') {
    return new DatabaseError(
      'Database connection error. Please try again in a moment.',
      { code: error.code, name: error.name }
    );
  }

  // Handle database connection errors
  if (error.code && (
    error.code.startsWith('P1') || // Prisma connection errors
    error.code === 'ECONNREFUSED' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ENOTFOUND'
  )) {
    return new DatabaseError(
      'Database connection error. Please try again in a moment.',
      { code: error.code }
    );
  }

  // Removed quota error detection - all AI service errors are treated generically

  // Handle JSON parsing errors
  if (error instanceof SyntaxError && error.message.includes('JSON')) {
    return new ValidationError(
      'Invalid JSON format',
      { originalError: error.message }
    );
  }

  // Handle validation errors from express-validator or similar
  if (error.name === 'ValidationError' || error.name === 'ValidatorError') {
    return new ValidationError(
      error.message || 'Validation failed',
      error.details || null
    );
  }

  // Handle multer file upload errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new AppError(
      ERROR_CODES.FILE_TOO_LARGE,
      'File too large. Maximum size is 5MB.',
      413
    );
  }

  // Handle API key errors
  if (error.message && (
    error.message.includes('Invalid API key') || 
    error.message === 'API key is required'
  )) {
    return new AuthenticationError(error.message);
  }

  // Default to internal server error
  return new AppError(
    ERROR_CODES.INTERNAL_SERVER_ERROR,
    error.message || 'An unexpected error occurred',
    500,
    process.env.NODE_ENV === 'development' ? { stack: error.stack } : null
  );
}

/**
 * Handle Prisma-specific errors
 */
function handlePrismaError(error) {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      return new AppError(
        ERROR_CODES.DUPLICATE_ENTRY,
        'A record with this information already exists',
        409,
        { field: error.meta?.target }
      );
    
    case 'P2025':
      // Record not found
      return new NotFoundError(
        'The requested record could not be found',
        { model: error.meta?.model }
      );
    
    case 'P2003':
      // Foreign key constraint failed
      return new ValidationError(
        'Invalid reference. The related record does not exist.',
        { field: error.meta?.field_name }
      );
    
    case 'P2014':
      // Required relation violation
      return new ValidationError(
        'Required relation is missing',
        { relation: error.meta?.relation_name }
      );
    
    default:
      // Other Prisma errors
      return new DatabaseError(
        'Database operation failed',
        { code: error.code, meta: error.meta }
      );
  }
}

/**
 * Send standardized error response
 */
function sendErrorResponse(res, error) {
  const normalizedError = normalizeError(error);
  const statusCode = normalizedError.statusCode || 500;
  const response = normalizedError.toJSON ? normalizedError.toJSON() : normalizedError;

  return res.status(statusCode).json(response);
}

/**
 * Async handler wrapper to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  ERROR_CODES,
  ERROR_STATUS_MAP,
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  DatabaseError,
  QuotaError,
  ExternalServiceError,
  createErrorResponse,
  normalizeError,
  handlePrismaError,
  sendErrorResponse,
  asyncHandler
};


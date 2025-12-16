// src/middleware/auditLog.js
const prisma = require('../utils/prismaClient');

/**
 * Sanitize sensitive data from objects
 */
function sanitizeData(data, maxDepth = 3, currentDepth = 0) {
  if (currentDepth >= maxDepth) {
    return '[Max Depth Reached]';
  }

  if (data === null || data === undefined) {
    return null;
  }

  if (typeof data === 'string') {
    // Truncate very long strings
    if (data.length > 1000) {
      return data.substring(0, 1000) + '... [truncated]';
    }
    return data;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.slice(0, 10).map(item => sanitizeData(item, maxDepth, currentDepth + 1));
  }

  if (typeof data === 'object') {
    const sanitized = {};
    const sensitiveKeys = ['password', 'token', 'apiKey', 'api_key', 'authorization', 'x-api-key', 'secret', 'key'];
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      // Skip sensitive keys
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Limit object size
      if (Object.keys(sanitized).length >= 50) {
        sanitized['...'] = '[Too many keys, truncated]';
        break;
      }

      sanitized[key] = sanitizeData(value, maxDepth, currentDepth + 1);
    }
    
    return sanitized;
  }

  return String(data);
}

/**
 * Extract service name from path
 */
function extractServiceName(path) {
  // Remove /api prefix if present
  let service = path.replace(/^\/api/, '');
  
  // Extract the main service name (first segment after /api)
  const parts = service.split('/').filter(p => p);
  if (parts.length > 0) {
    // Map common endpoints to service names
    const serviceMap = {
      'chat': 'CHAT',
      'coverletter': 'COVER_LETTER',
      'experience': 'EXPERIENCE',
      'keywords': 'KEYWORDS',
      'upload-resume': 'UPLOAD_RESUME',
      'hr-lookup': 'HR_LOOKUP',
      'applied-jobs': 'APPLIED_JOBS',
      'auth': 'AUTH',
      'health': 'HEALTH'
    };
    
    const firstPart = parts[0];
    return serviceMap[firstPart] || firstPart.toUpperCase();
  }
  
  return 'UNKNOWN';
}

/**
 * Create audit log entry asynchronously (non-blocking)
 */
async function createAuditLog(logData) {
  try {
    await prisma.auditLog.create({
      data: logData
    });
  } catch (error) {
    // Don't throw - audit logging should never break the main flow
    console.error('[AUDIT_LOG] Failed to create audit log entry:', {
      error: error.message,
      service: logData.service,
      userId: logData.userId
    });
  }
}

/**
 * Audit logging middleware
 * Captures all requests and responses for comprehensive audit trail
 */
function auditLogMiddleware(req, res, next) {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Store original response methods
  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);
  
  // Capture response data
  let responseBody = null;
  let responseSent = false;

  // Override res.send
  res.send = function(body) {
    if (!responseSent) {
      responseBody = body;
      responseSent = true;
    }
    return originalSend.call(this, body);
  };

  // Override res.json
  res.json = function(body) {
    if (!responseSent) {
      responseBody = body;
      responseSent = true;
    }
    return originalJson.call(this, body);
  };

  // Capture response when it finishes
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    // Extract user ID from request (set by auth middleware)
    const userId = req.user?.id || null;
    
    // Extract service name
    const service = extractServiceName(req.path);
    
    // Sanitize request body
    const sanitizedRequestBody = req.body ? sanitizeData(req.body) : null;
    
    // Sanitize request headers (remove sensitive data)
    const sanitizedHeaders = {};
    if (req.headers) {
      Object.keys(req.headers).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('api-key') || lowerKey.includes('authorization') || lowerKey.includes('token')) {
          sanitizedHeaders[key] = '[REDACTED]';
        } else {
          sanitizedHeaders[key] = req.headers[key];
        }
      });
    }
    
    // Parse response body if it's a string
    let sanitizedResponseBody = null;
    if (responseBody) {
      try {
        const parsed = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;
        sanitizedResponseBody = sanitizeData(parsed);
      } catch (e) {
        // If parsing fails, just use the string (truncated)
        sanitizedResponseBody = typeof responseBody === 'string' 
          ? responseBody.substring(0, 500) 
          : sanitizeData(responseBody);
      }
    }
    
    // Extract error information from response
    let errorCode = null;
    let errorMessage = null;
    
    if (res.statusCode >= 400) {
      // Try to extract error code and message from response
      if (sanitizedResponseBody) {
        if (typeof sanitizedResponseBody === 'object') {
          errorCode = sanitizedResponseBody.errorCode || sanitizedResponseBody.error_code || null;
          errorMessage = sanitizedResponseBody.message || sanitizedResponseBody.error || null;
        }
      }
      
      // If no error code found, use status code as fallback
      if (!errorCode) {
        errorCode = `HTTP_${res.statusCode}`;
      }
    }
    
    // Prepare audit log data
    const auditLogData = {
      userId: userId,
      service: service,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      errorCode: errorCode,
      errorMessage: errorMessage,
      requestBody: sanitizedRequestBody,
      responseBody: sanitizedResponseBody,
      requestHeaders: sanitizedHeaders,
      responseTime: responseTime,
      ipAddress: req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || null,
      userAgent: req.get('user-agent') || null
    };
    
    // Create audit log asynchronously (non-blocking)
    // Use setImmediate to ensure it doesn't block the response
    setImmediate(() => {
      createAuditLog(auditLogData).catch(err => {
        // Already handled in createAuditLog, but catch here too for safety
        console.error('[AUDIT_LOG] Unhandled error in audit logging:', err.message);
      });
    });
  });

  // Continue to next middleware
  next();
}

module.exports = { auditLogMiddleware };


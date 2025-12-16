// src/middleware/auth.js
const prisma = require('../utils/prismaClient');

const authenticateApiKey = async (req, res, next) => {
  const startTime = Date.now();
  const apiKey = req.headers['x-api-key'];
  
  console.log(`[AUTH] ${req.method} ${req.path} - Starting authentication`);
  
  try {
    if (!apiKey) {
      const duration = Date.now() - startTime;
      console.log(`[AUTH] ${req.method} ${req.path} - No API key provided (${duration}ms)`);
      return res.status(401).json({ success: false, message: 'API key is required' });
    }

    // Trim the API key to handle any whitespace issues
    const trimmedApiKey = apiKey.trim();
    
    console.log(`[AUTH] ${req.method} ${req.path} - Looking up API key: ${trimmedApiKey.substring(0, 8)}... (length: ${trimmedApiKey.length})`);
    
    // Query ApiKey model using 'key' field
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { 
        key: trimmedApiKey 
      },
      include: {
        user: true
      }
    });

    if (!apiKeyRecord) {
      const duration = Date.now() - startTime;
      console.log(`[AUTH] ${req.method} ${req.path} - Invalid API key (${duration}ms)`);
      return res.status(401).json({ success: false, message: 'Invalid API key' });
    }

    // Safety check: ensure user relation exists
    if (!apiKeyRecord.user) {
      const duration = Date.now() - startTime;
      console.error(`[AUTH] ${req.method} ${req.path} - API key found but user relation is missing (${duration}ms)`);
      return res.status(500).json({ 
        success: false, 
        errorCode: 'DATA_ERROR',
        message: 'Invalid API key configuration. Please contact support.' 
      });
    }

    console.log(`[AUTH] ${req.method} ${req.path} - API key found for user: ${apiKeyRecord.user.email}`);

    // Use 'isActive' field (boolean)
    if (!apiKeyRecord.isActive) {
      const duration = Date.now() - startTime;
      console.log(`[AUTH] ${req.method} ${req.path} - API key inactive for user: ${apiKeyRecord.user.email} (${duration}ms)`);
      return res.status(403).json({ success: false, message: 'API key is inactive' });
    }

    // Check if API key is deleted
    if (apiKeyRecord.deletedAt) {
      const duration = Date.now() - startTime;
      console.log(`[AUTH] ${req.method} ${req.path} - API key deleted for user: ${apiKeyRecord.user.email} (${duration}ms)`);
      return res.status(403).json({ success: false, message: 'API key is inactive' });
    }

    // Check if user is deleted
    if (apiKeyRecord.user.deletedAt) {
      const duration = Date.now() - startTime;
      console.log(`[AUTH] ${req.method} ${req.path} - User deleted: ${apiKeyRecord.user.email} (${duration}ms)`);
      return res.status(403).json({ 
        success: false, 
        errorCode: 'USER_DELETED',
        message: 'Your account has been deleted. Please contact support for assistance.' 
      });
    }

    // Check if user is verified
    if (!apiKeyRecord.user.verifiedByAdmin) {
      const duration = Date.now() - startTime;
      console.log(`[AUTH] ${req.method} ${req.path} - User not verified: ${apiKeyRecord.user.email} (${duration}ms)`);
      return res.status(403).json({ 
        success: false, 
        errorCode: 'USER_NOT_VERIFIED',
        message: 'Your account is pending verification. Please wait for admin approval before using the extension.' 
      });
    }

    // Update lastUsedAt (non-blocking - don't fail auth if this fails)
    try {
      await prisma.apiKey.update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date() }
      });
    } catch (updateError) {
      // Log but don't fail authentication if lastUsedAt update fails
      console.warn(`[AUTH] Failed to update lastUsedAt for API key ${apiKeyRecord.id}:`, updateError.message);
    }

    const duration = Date.now() - startTime;
    console.log(`[AUTH] ${req.method} ${req.path} - Authentication successful for user: ${apiKeyRecord.user.email} (${duration}ms)`);

    req.user = apiKeyRecord.user;
    next();
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Check for Prisma/database connection errors
    const isDatabaseError = (
      (error.code && (
        error.code.startsWith('P1') || // Prisma connection errors (P1001, P1008, etc.)
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND'
      )) ||
      error.name === 'PrismaClientKnownRequestError' ||
      error.name === 'PrismaClientInitializationError' ||
      error.name === 'PrismaClientUnknownRequestError'
    );
    
    if (isDatabaseError) {
      console.error(`[AUTH] ${req.method} ${req.path} - Database connection error (${duration}ms):`, {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      });
      return res.status(503).json({ 
        success: false, 
        errorCode: 'DATABASE_ERROR',
        message: 'Database connection error. Please try again in a moment.' 
      });
    }
    
    // Log other errors
    console.error(`[AUTH] ${req.method} ${req.path} - Authentication error (${duration}ms):`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    // Don't expose internal errors - return generic message
    return res.status(500).json({ 
      success: false, 
      errorCode: 'AUTH_ERROR',
      message: 'Authentication service temporarily unavailable. Please try again.' 
    });
  }
};

module.exports = { authenticateApiKey };
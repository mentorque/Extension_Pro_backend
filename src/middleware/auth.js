// src/middleware/auth.js
const prisma = require('../utils/prismaClient');

const { AuthenticationError, DatabaseError, sendErrorResponse, normalizeError } = require('../utils/errors');

const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  try {
    if (!apiKey) {
      return res.status(401).json({ success: false, message: 'API key is required' });
    }

    // Trim the API key to handle any whitespace issues
    const trimmedApiKey = apiKey.trim();
    
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
      return res.status(401).json({ success: false, message: 'Invalid API key' });
    }

    // Safety check: ensure user relation exists
    if (!apiKeyRecord.user) {
      console.error(`[AUTH] ${req.method} ${req.path} - API key found but user relation is missing`);
      return res.status(500).json({ 
        success: false, 
        errorCode: 'DATA_ERROR',
        message: 'Invalid API key configuration. Please contact support.' 
      });
    }

    // Use 'isActive' field (boolean)
    if (!apiKeyRecord.isActive) {
      return res.status(403).json({ success: false, message: 'API key is inactive' });
    }

    // Check if API key is deleted
    if (apiKeyRecord.deletedAt) {
      return res.status(403).json({ success: false, message: 'API key is inactive' });
    }

    // Check if user is deleted
    if (apiKeyRecord.user.deletedAt) {
      return res.status(403).json({ 
        success: false, 
        errorCode: 'USER_DELETED',
        message: 'Your account has been deleted. Please contact support for assistance.' 
      });
    }

    // Check if user is verified
    if (!apiKeyRecord.user.verifiedByAdmin) {
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

    req.user = apiKeyRecord.user;
    next();
  } catch (error) {
    // Log error
    console.error(`[AUTH] ${req.method} ${req.path} - Authentication error:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    // Normalize and send error response
    return sendErrorResponse(res, error);
  }
};

module.exports = { authenticateApiKey };
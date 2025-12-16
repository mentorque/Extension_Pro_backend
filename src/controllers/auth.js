// src/controllers/auth.js
const prisma = require('../utils/prismaClient');
const { AuthenticationError, ValidationError, AppError, ERROR_CODES, asyncHandler } = require('../utils/errors');

const validateApiKey = asyncHandler(async (req, res) => {
  // req.user is set by authenticateApiKey middleware
  if (!req.user) {
    console.error('[AUTH] validateApiKey called but req.user is missing');
    throw new AuthenticationError('Authentication required');
  }
  
  return res.status(200).json({
    success: true,
    message: 'API key is valid',
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.fullName // Changed from 'name' to 'fullName'
    }
  });
});

const validateApiKeyPublic = asyncHandler(async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    throw new AppError(ERROR_CODES.MISSING_API_KEY, 'API key is required', 401);
  }

  // Trim the API key to handle any whitespace issues
  const trimmedApiKey = apiKey.trim();
  
  console.log(`[AUTH_PUBLIC] Validating API key: ${trimmedApiKey.substring(0, 8)}... (length: ${trimmedApiKey.length})`);
  
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
    console.log(`[AUTH_PUBLIC] Invalid API key: ${apiKey.substring(0, 8)}...`);
    throw new AppError(ERROR_CODES.INVALID_API_KEY, 'Invalid API key', 401);
  }

  // Safety check: ensure user relation exists
  if (!apiKeyRecord.user) {
    console.error(`[AUTH_PUBLIC] API key found but user relation is missing`);
    throw new AppError(
      ERROR_CODES.DATA_ERROR,
      'Invalid API key configuration. Please contact support.',
      500
    );
  }

  // Check if API key is active
  if (!apiKeyRecord.isActive) {
    console.log(`[AUTH_PUBLIC] API key inactive for user: ${apiKeyRecord.user.email}`);
    throw new AppError(ERROR_CODES.API_KEY_INACTIVE, 'API key is inactive', 403);
  }

  // Check if API key is deleted
  if (apiKeyRecord.deletedAt) {
    console.log(`[AUTH_PUBLIC] API key deleted for user: ${apiKeyRecord.user.email}`);
    throw new AppError(ERROR_CODES.API_KEY_INACTIVE, 'API key is inactive', 403);
  }

  // Check if user is deleted
  if (apiKeyRecord.user.deletedAt) {
    console.log(`[AUTH_PUBLIC] User deleted: ${apiKeyRecord.user.email}`);
    throw new AppError(
      ERROR_CODES.USER_DELETED,
      'Your account has been deleted. Please contact support for assistance.',
      403
    );
  }

  // Check if user is verified
  if (!apiKeyRecord.user.verifiedByAdmin) {
    console.log(`[AUTH_PUBLIC] User not verified: ${apiKeyRecord.user.email}`);
    throw new AppError(
      ERROR_CODES.USER_NOT_VERIFIED,
      'Your account is pending verification. Please wait for admin approval before using the extension.',
      403
    );
  }

  console.log(`[AUTH_PUBLIC] API key validation successful for user: ${apiKeyRecord.user.email}`);

  // Update lastUsedAt (non-blocking - don't fail validation if this fails)
  try {
    await prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() }
    });
  } catch (updateError) {
    // Log but don't fail validation if lastUsedAt update fails
    console.warn(`[AUTH_PUBLIC] Failed to update lastUsedAt for API key ${apiKeyRecord.id}:`, updateError.message);
  }

  return res.status(200).json({
    success: true,
    message: 'API key is valid',
    user: {
      id: apiKeyRecord.user.id,
      email: apiKeyRecord.user.email,
      name: apiKeyRecord.user.fullName
    }
  });
});

module.exports = {
  validateApiKey,
  validateApiKeyPublic
};
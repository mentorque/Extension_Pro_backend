// src/controllers/usage.js
const prisma = require('../utils/prismaClient');
const { asyncHandler, AuthenticationError } = require('../utils/errors');

/**
 * Get daily API usage statistics for the authenticated user
 * Counts non-applied-jobs API calls made today
 */
const getDailyUsage = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Count API calls made today (excluding applied-jobs endpoints)
  // These are the calls that use Gemini API
  const todayUsage = await prisma.auditLog.count({
    where: {
      userId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
      },
      deletedAt: null,
      path: {
        not: {
          contains: 'applied-jobs'
        }
      },
      path: {
        startsWith: '/api/'
      }
    }
  });

  // Daily limit for free tier Gemini API calls
  const dailyLimit = 20;
  const remaining = Math.max(0, dailyLimit - todayUsage);

  return res.status(200).json({
    success: true,
    usage: {
      today: todayUsage,
      limit: dailyLimit,
      remaining: remaining,
      exceeded: todayUsage >= dailyLimit
    }
  });
});

/**
 * Get daily API usage for a specific API key (public endpoint)
 * Does not require authentication - just API key in header
 */
const getDailyUsageByApiKey = asyncHandler(async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    throw new AuthenticationError('API key is required');
  }

  // Find the API key and user
  const apiKeyRecord = await prisma.apiKey.findUnique({
    where: { key: apiKey.trim() },
    include: { user: true }
  });

  if (!apiKeyRecord || !apiKeyRecord.user) {
    throw new AuthenticationError('Invalid API key');
  }

  const userId = apiKeyRecord.userId;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Count API calls made today (excluding applied-jobs endpoints)
  // These are the calls that use Gemini API (keywords, coverletter, chat, experience, hr-lookup)
  const todayUsage = await prisma.auditLog.count({
    where: {
      userId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
      },
      deletedAt: null,
      path: {
        not: {
          contains: 'applied-jobs'
        }
      },
      path: {
        startsWith: '/api/'
      }
    }
  });

  // Daily limit for free tier Gemini API calls
  const dailyLimit = 20;
  const remaining = Math.max(0, dailyLimit - todayUsage);

  return res.status(200).json({
    success: true,
    usage: {
      today: todayUsage,
      limit: dailyLimit,
      remaining: remaining,
      exceeded: todayUsage >= dailyLimit
    },
    apiKey: {
      name: apiKeyRecord.name,
      userId: userId,
      userEmail: apiKeyRecord.user.email
    }
  });
});

module.exports = {
  getDailyUsage,
  getDailyUsageByApiKey
};

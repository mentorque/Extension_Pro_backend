// src/utils/slackNotifier.js
const axios = require('axios');

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

/**
 * Send error notification to Slack
 * Only sends for errors that require developer attention (500+, critical errors)
 */
async function notifySlack(errorData) {
  // Only send notifications for errors that need developer attention
  const requiresAttention = 
    errorData.statusCode >= 500 || // Server errors
    errorData.errorCode === 'DATABASE_ERROR' ||
    errorData.errorCode === 'DATABASE_CONNECTION_ERROR' ||
    errorData.errorCode === 'CONFIGURATION_ERROR' ||
    errorData.errorCode === 'AI_SERVICE_ERROR' ||
    errorData.errorCode === 'SERVICE_UNAVAILABLE';

  if (!requiresAttention) {
    return; // Don't notify for client errors (400-499)
  }

  if (!SLACK_WEBHOOK_URL) {
    console.warn('[SLACK] Webhook URL not configured, skipping notification');
    return;
  }

  try {
    // Create concise, skimmable message (1-2 lines max)
    const service = errorData.service || 'UNKNOWN';
    const errorCode = errorData.errorCode || `HTTP_${errorData.statusCode}`;
    const message = errorData.errorMessage || errorData.message || 'Unknown error';
    
    // Truncate message if too long (keep it skimmable - max 80 chars for main line)
    const shortMessage = message.length > 80 ? message.substring(0, 77) + '...' : message;
    
    // Use user email if available, otherwise use user ID
    const userInfo = errorData.userEmail || (errorData.userId ? errorData.userId.substring(0, 12) : 'N/A');
    
    // Create compact Slack message - single line format for easy skimming
    const slackMessage = {
      text: `🚨 *${service}* | ${errorCode} | ${shortMessage} | User: ${userInfo} | Path: ${(errorData.path || 'N/A').substring(0, 30)}`
    };

    // Send to Slack (non-blocking, fire and forget)
    axios.post(SLACK_WEBHOOK_URL, slackMessage, {
      timeout: 5000 // 5 second timeout
    }).catch(err => {
      // Don't throw - we don't want Slack failures to affect the app
      console.error('[SLACK] Failed to send notification:', err.message);
    });

  } catch (error) {
    // Don't throw - Slack notifications should never break the app
    console.error('[SLACK] Error preparing notification:', error.message);
  }
}

/**
 * Notify Slack from audit log data
 * Extracts error information from audit log entry
 */
async function notifySlackFromAuditLog(auditLogData) {
  if (!auditLogData.errorCode && auditLogData.statusCode < 500) {
    return; // Only notify for errors
  }

  const errorData = {
    service: auditLogData.service,
    errorCode: auditLogData.errorCode,
    errorMessage: auditLogData.errorMessage,
    statusCode: auditLogData.statusCode,
    userId: auditLogData.userId,
    userEmail: auditLogData.userEmail, // Pass user email through
    path: auditLogData.path,
    message: auditLogData.errorMessage
  };

  await notifySlack(errorData);
}

module.exports = {
  notifySlack,
  notifySlackFromAuditLog
};


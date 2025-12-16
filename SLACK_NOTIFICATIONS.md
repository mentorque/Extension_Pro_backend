# Slack Error Notifications

## Overview

The system automatically sends concise error notifications to Slack when errors occur that require developer attention. Notifications are sent asynchronously and won't affect API performance.

## Configuration

Add the Slack webhook URL to your `.env` file:

```env
SLACK_WEBHOOK_URL=your_slack_webhook_url_here
```

**Important:** Never commit the actual webhook URL to the repository. Always use environment variables.

## When Notifications Are Sent

Notifications are only sent for errors that require developer attention:

- **Server Errors (500+)**: All 5xx HTTP status codes
- **Database Errors**: `DATABASE_ERROR`, `DATABASE_CONNECTION_ERROR`
- **Configuration Errors**: `CONFIGURATION_ERROR`
- **AI Service Errors**: `AI_SERVICE_ERROR`
- **Service Unavailable**: `SERVICE_UNAVAILABLE`

**Client errors (400-499)** are NOT sent to Slack as they don't require developer attention.

## Message Format

Messages are designed to be concise and skimmable (1-2 lines):

```
🚨 *SERVICE_NAME* | ERROR_CODE | Error message... | User: user-id | Path: /api/endpoint
```

### Example Messages

**Database Error:**
```
🚨 *CHAT* | DATABASE_ERROR | Database connection error. Please try again in a moment. | User: clx123abc456 | Path: /api/chat
```

**AI Service Error:**
```
🚨 *COVER_LETTER* | AI_SERVICE_ERROR | All AI API keys failed. Please try again later. | User: clx789def012 | Path: /api/coverletter
```

**Internal Server Error:**
```
🚨 *KEYWORDS* | INTERNAL_SERVER_ERROR | An unexpected error occurred | User: clx456ghi789 | Path: /api/keywords
```

## Integration Points

1. **Error Handler** (`app.js`): Sends notifications for unhandled errors
2. **Audit Log Middleware** (`auditLog.js`): Sends notifications after audit logs are created for errors

## Features

- **Non-Blocking**: All Slack notifications are sent asynchronously
- **Error Isolation**: If Slack fails, it won't affect your API
- **Concise Format**: Messages are 1-2 lines for easy skimming
- **Automatic**: No manual intervention needed
- **Contextual**: Includes service name, error code, user ID, and path

## Testing

To test the Slack integration, you can trigger a 500 error:

```bash
# This will trigger an error and send a Slack notification
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: invalid-key" \
  -d '{"test": "data"}'
```

## Troubleshooting

**No notifications received:**
- Check that `SLACK_WEBHOOK_URL` is set in `.env`
- Verify the webhook URL is correct
- Check server logs for `[SLACK]` messages

**Too many notifications:**
- The system only sends for errors requiring developer attention (500+)
- Client errors (400-499) are not sent
- Adjust the `requiresAttention` logic in `slackNotifier.js` if needed

**Notifications are delayed:**
- Notifications are sent asynchronously using `setImmediate()`
- This ensures they don't block API responses
- Small delays are expected and normal

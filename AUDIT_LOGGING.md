# Audit Logging System

## Overview

The audit logging system provides comprehensive tracking of all API requests and responses, including user activity, errors, and system behavior. It's designed to be non-blocking and won't affect the performance of your main database operations.

## Features

- **Comprehensive Tracking**: Captures all requests and responses automatically
- **User Context**: Tracks user ID for authenticated requests
- **Error Tracking**: Captures error codes, messages, and status codes
- **Performance Metrics**: Records response times for all requests
- **Data Sanitization**: Automatically redacts sensitive information (API keys, passwords, tokens)
- **Non-Blocking**: Uses async operations that won't slow down your API
- **Indexed**: Database indexes for fast queries by user, service, date, etc.

## Database Schema

The `AuditLog` model stores:

- `userId`: User ID (nullable for unauthenticated requests)
- `service`: Service/endpoint name (e.g., 'CHAT', 'COVER_LETTER')
- `method`: HTTP method (GET, POST, etc.)
- `path`: Request path
- `statusCode`: HTTP status code
- `errorCode`: Error code if error occurred
- `errorMessage`: Error message if error occurred
- `requestBody`: Sanitized request body (JSON)
- `responseBody`: Sanitized response body (JSON)
- `requestHeaders`: Sanitized request headers (JSON)
- `responseTime`: Response time in milliseconds
- `ipAddress`: Client IP address
- `userAgent`: User agent string
- `createdAt`: Timestamp
- `deletedAt`: Soft delete timestamp

## Setup

1. **Run Prisma Migration**:
   ```bash
   npx prisma migrate dev --name add_audit_log
   ```

2. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

The audit logging middleware is already integrated into `app.js` and will automatically start logging all requests.

## How It Works

1. **Middleware Placement**: The audit middleware is placed after body parsing but before routes, ensuring it captures all API requests.

2. **Response Interception**: The middleware intercepts `res.send()` and `res.json()` to capture response bodies.

3. **Event-Based Logging**: Uses Express's `res.on('finish')` event to capture data after the response is sent, including error responses.

4. **Async Logging**: Uses `setImmediate()` to ensure audit logging happens asynchronously and doesn't block the response.

5. **Error Handling**: If audit logging fails, it logs an error but doesn't affect the main request flow.

## Data Sanitization

The system automatically sanitizes:

- **Sensitive Headers**: API keys, authorization tokens, etc. are redacted
- **Sensitive Fields**: Passwords, tokens, secrets in request/response bodies
- **Large Data**: Strings longer than 1000 characters are truncated
- **Deep Objects**: Limited to 3 levels of depth to prevent excessive data
- **Array Limits**: Arrays limited to first 10 items
- **Object Size**: Objects limited to 50 keys

## Querying Audit Logs

### Get all logs for a user:
```javascript
const logs = await prisma.auditLog.findMany({
  where: { userId: 'user-id' },
  orderBy: { createdAt: 'desc' }
});
```

### Get error logs:
```javascript
const errorLogs = await prisma.auditLog.findMany({
  where: { 
    statusCode: { gte: 400 },
    deletedAt: null
  },
  orderBy: { createdAt: 'desc' }
});
```

### Get logs by service:
```javascript
const serviceLogs = await prisma.auditLog.findMany({
  where: { 
    service: 'CHAT',
    createdAt: { gte: new Date('2024-01-01') }
  },
  orderBy: { createdAt: 'desc' }
});
```

### Get logs with specific error code:
```javascript
const errorCodeLogs = await prisma.auditLog.findMany({
  where: { 
    errorCode: 'VALIDATION_ERROR',
    deletedAt: null
  },
  orderBy: { createdAt: 'desc' }
});
```

## Service Name Mapping

The system automatically maps endpoints to service names:

- `/api/chat` → `CHAT`
- `/api/coverletter` → `COVER_LETTER`
- `/api/experience` → `EXPERIENCE`
- `/api/keywords` → `KEYWORDS`
- `/api/upload-resume` → `UPLOAD_RESUME`
- `/api/hr-lookup` → `HR_LOOKUP`
- `/api/applied-jobs` → `APPLIED_JOBS`
- `/api/auth` → `AUTH`
- `/api/health` → `HEALTH`

## Performance Considerations

- **Non-Blocking**: Audit logging uses `setImmediate()` to ensure it doesn't block responses
- **Async Database Operations**: All database writes are async and won't slow down requests
- **Error Isolation**: If audit logging fails, it won't affect the main request
- **Indexed Queries**: Database indexes ensure fast queries even with large datasets

## Best Practices

1. **Regular Cleanup**: Consider implementing a cleanup job to archive or delete old audit logs
2. **Monitoring**: Monitor audit log table size and implement retention policies
3. **Privacy**: Be mindful of PII (Personally Identifiable Information) in request/response bodies
4. **Compliance**: Ensure audit logging meets your compliance requirements (GDPR, etc.)

## Troubleshooting

### Audit logs not being created:
- Check database connection
- Verify Prisma client is generated
- Check console for error messages (prefixed with `[AUDIT_LOG]`)

### Missing user IDs:
- User ID is only captured for authenticated requests
- Public endpoints (like `/api/auth/validate`) may have null userId

### Performance issues:
- Audit logging is async and shouldn't affect performance
- If issues occur, check database connection pool settings
- Consider adding a queue system for high-traffic scenarios


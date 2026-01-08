# Railway Deployment Checklist

## Required Environment Variables on Railway:
```
PORT=8000 (or let Railway auto-set it)
DATABASE_URL=postgresql://...
GEMINI_API_KEY=...
GEMINI_API_KEY_FALLBACK_1=...
GOOGLE_CSE_ID=...
GOOGLE_API_KEY=...
SLACK_WEBHOOK_URL=...
NODE_ENV=production
```

## Quick Fixes:

### 1. Check Railway Logs
- Go to Railway dashboard
- Click on your service
- Check "Logs" tab for errors
- Look for:
  - Database connection errors
  - Prisma client generation errors
  - Missing environment variables
  - Port binding errors

### 2. Fix Dockerfile Port Issue
The Dockerfile exposes port 3000, but the server uses PORT env var (which Railway sets automatically).
The EXPOSE line is just for documentation - Railway will use whatever PORT env var is set.

### 3. Verify Prisma Generation
Make sure `npx prisma generate` runs successfully during build.
The Dockerfile already has this, but verify it's working.

### 4. Common Railway Issues:
- ❌ Database connection timeout
- ❌ Prisma binary target mismatch (needs Linux binaries)
- ❌ Environment variables not set
- ❌ Server crashing on startup
- ❌ Build failing

## To Redeploy:
1. Push latest code to GitHub (if using GitHub integration)
2. Or trigger a manual redeploy in Railway
3. Watch the logs for errors
4. Test the /health endpoint


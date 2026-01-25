# Regenerate Prisma Client for Extension_Pro

The Prisma schema has been updated to include:
- `isPrimary` field (Boolean, default false)
- `name` field (String, optional)
- `shareToken` field (String, optional, unique)
- `deletedSections` field (Json, optional)
- Removed `@unique` constraint from `userId` (allows multiple resumes per user)

## Steps to Regenerate Prisma Client

1. **Stop the Extension_Pro backend server** (if running)

2. **Regenerate Prisma client:**
   ```bash
   cd /Users/yadav/Documents/DublinCompany/Mentorque-Extensions/Extension_Pro/backend
   npx prisma generate
   ```

3. **Restart the Extension_Pro backend server**

## Manual SQL Migration (if needed)

If you need to run the migration manually:

```sql
-- Add isPrimary column
ALTER TABLE "ResumeSettings" 
ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN DEFAULT false;

-- Add name column
ALTER TABLE "ResumeSettings" 
ADD COLUMN IF NOT EXISTS "name" TEXT;

-- Add shareToken column
ALTER TABLE "ResumeSettings" 
ADD COLUMN IF NOT EXISTS "shareToken" TEXT;

-- Add deletedSections column
ALTER TABLE "ResumeSettings" 
ADD COLUMN IF NOT EXISTS "deletedSections" JSONB;

-- Create unique index on shareToken
CREATE UNIQUE INDEX IF NOT EXISTS "ResumeSettings_shareToken_key" 
ON "ResumeSettings"("shareToken") 
WHERE "shareToken" IS NOT NULL;

-- Create index on userId + isPrimary
CREATE INDEX IF NOT EXISTS "ResumeSettings_userId_isPrimary_idx" 
ON "ResumeSettings"("userId", "isPrimary");

-- Drop the unique constraint on userId (if exists)
DROP INDEX IF EXISTS "ResumeSettings_userId_key";
```

## Note

The code uses `as any` type assertions for `isPrimary` and `name` fields to work even if Prisma client hasn't been regenerated yet. After regenerating, these will work normally.

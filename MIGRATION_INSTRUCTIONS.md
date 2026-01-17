# Migration Instructions

## What This Migration Does

This migration creates three new tables:
1. **UserSkills** - Stores user skills with display mode preferences
2. **ResumeSettings** - Stores complete resume configuration and data
3. **FreetrialUsers** - Restores the FreetrialUsers table that was accidentally dropped

## How to Apply

### Option 1: Using Prisma Migrate (Recommended if connection works)

```bash
cd /Users/yadav/Documents/DublinCompany/Mentorque-Extensions/Extension_Pro/backend
npx prisma migrate deploy
```

Or if you want to create a new migration:
```bash
npx prisma migrate dev --name add_user_skills_resume_settings_and_freetrial_users
```

### Option 2: Direct SQL (If Prisma connection has issues)

```bash
cd /Users/yadav/Documents/DublinCompany/Mentorque-Extensions/Extension_Pro/backend

# Make sure DATABASE_URL is set in .env or environment
psql $DATABASE_URL < apply-migration.sql
```

Or use the helper script:
```bash
./apply-migration.sh
```

### Option 3: Using Prisma DB Push (Quick but not recommended for production)

```bash
npx prisma db push
```

**Warning**: `db push` can cause data loss if tables exist in DB but not in schema.

## After Migration

1. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

2. Verify tables were created:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('UserSkills', 'ResumeSettings', 'FreetrialUsers');
   ```

## Migration Files

- `prisma/migrations/20250114203000_add_user_skills_resume_settings_and_freetrial_users/migration.sql` - Prisma migration file
- `apply-migration.sql` - Standalone SQL file for direct execution
- `apply-migration.sh` - Helper script to run the migration

## Notes

- All tables use `IF NOT EXISTS` to prevent errors if they already exist
- Foreign keys are added with `DO $$` blocks to check if they exist first
- The migration is marked as applied in `_prisma_migrations` table
- FreetrialUsers table will be recreated but data will need to be manually re-entered (13 rows were lost)

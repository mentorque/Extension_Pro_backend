# Recover FreetrialUsers Table

## What Happened
When running `prisma db push` for Extension_Pro, the `FreetrialUsers` table was dropped because it's not defined in Extension_Pro's schema. This table belongs to Extension_Free_Tier but both projects share the same database.

## Data Loss
- **13 rows** of FreetrialUsers data were lost
- The table structure was: id, name, email, contactNumber, occupation, createdAt, updatedAt

## Recovery Options

### Option 1: Restore from Database Backup (Recommended)
If you have a database backup, restore it:
```bash
# Restore from backup
psql $DATABASE_URL < backup_file.sql
```

### Option 2: Add FreetrialUsers to Extension_Pro Schema
Since both projects share the database, add the model to Extension_Pro's schema:

```prisma
model FreetrialUsers {
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  contactNumber String
  occupation    String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([email])
}
```

Then run:
```bash
npx prisma db push
```

This will recreate the table structure, but **won't restore the lost data**.

### Option 3: Manual SQL Recovery
If you have access to database logs or can query the database directly, you might be able to recover the data if it's still in transaction logs (unlikely after commit).

## Prevention
To prevent this in the future:
1. Use `prisma migrate dev` instead of `prisma db push` for production databases
2. Always backup before schema changes
3. Consider using separate databases for different projects
4. Or merge all models into one shared schema file

## Immediate Action
1. Check if you have a database backup
2. If yes, restore it
3. If no, add the FreetrialUsers model to Extension_Pro schema to at least restore the table structure
4. Manually re-enter the 13 lost records if possible

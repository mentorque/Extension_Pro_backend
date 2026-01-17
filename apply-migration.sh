#!/bin/bash

# Apply migration script
# Usage: ./apply-migration.sh

echo "Applying migration: Add UserSkills, ResumeSettings, and FreetrialUsers tables..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    echo "Loading from .env file..."
    export $(cat .env | grep DATABASE_URL | xargs)
fi

# Apply the migration
psql "$DATABASE_URL" < apply-migration.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration applied successfully!"
    echo "Generating Prisma client..."
    npx prisma generate
else
    echo "❌ Migration failed. Please check the error above."
    exit 1
fi

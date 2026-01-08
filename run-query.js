// Quick script to run the non-applied jobs query
require('dotenv').config();
const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function runQuery() {
  const result = await prisma.$queryRaw`
    SELECT COUNT(*) as count 
    FROM "AuditLog" 
    WHERE "createdAt" >= NOW() - INTERVAL '20 days' 
      AND "deletedAt" IS NULL 
      AND "path" NOT LIKE '%applied-jobs%' 
      AND "path" LIKE '/api/%'
  `;
  console.log('Non-applied jobs calls (last 20 days):', result[0].count);
  await prisma.$disconnect();
}

runQuery().catch(console.error);


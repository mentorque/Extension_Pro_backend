const { PrismaClient } = require("../../generated/prisma");

// Configure Prisma client with connection pool settings and error handling
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  errorFormat: 'pretty',
  // Connection pool configuration
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Handle Prisma connection errors gracefully
// Note: $on('error') is not available in all Prisma versions, so we handle errors in catch blocks

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = prisma;

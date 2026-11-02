import { seedAdminFixtures } from './seed-data';
import { createPrismaClient } from '../src/database/prisma-client-factory';

const { prisma, pool } = createPrismaClient(process.env.DATABASE_URL);

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED_RESET !== 'true') {
    throw new Error(
      'Database seeding with table reset is disabled in production environments. Set ALLOW_SEED_RESET=true to override.',
    );
  }
  await seedAdminFixtures(prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool?.end();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    await pool?.end();
    process.exit(1);
  });

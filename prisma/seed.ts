import { seedAdminFixtures } from './seed-data';
import { createPrismaClient } from '../src/database/prisma-client-factory';

const { prisma, pool } = createPrismaClient(process.env.DATABASE_URL);

async function main() {
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

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findFirst();
  if (u) {
    console.log('Sample User ID:', u.id);
  }
}
main().finally(() => prisma.$disconnect());

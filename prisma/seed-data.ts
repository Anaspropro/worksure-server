import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '../src/generated/prisma';

export async function resetAdminFixtures(prisma: PrismaClient) {
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.artisanProfile.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.disputeHistory.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.job.deleteMany();
  await prisma.user.deleteMany();
  await prisma.ledgerAccount.deleteMany();
}

export async function seedAdminFixtures(prisma: PrismaClient) {
  await resetAdminFixtures(prisma);

  const existingEscrow = await prisma.ledgerAccount.findFirst({
    where: { type: 'SYSTEM_ESCROW' },
  });

  if (!existingEscrow) {
    await prisma.ledgerAccount.create({
      data: {
        id: uuidv4(),
        name: 'WorkSure Escrow',
        type: 'SYSTEM_ESCROW',
      },
    });
  }

  const existingFee = await prisma.ledgerAccount.findFirst({
    where: { type: 'SYSTEM_FEE' },
  });

  if (!existingFee) {
    await prisma.ledgerAccount.create({
      data: {
        id: uuidv4(),
        name: 'WorkSure Fees',
        type: 'SYSTEM_FEE',
      },
    });
  }

  const adminPasswordHash = await bcrypt.hash('AdminPass123', 10);

  // Generate UUIDs for users
  const adminId = uuidv4();
  const platformId = uuidv4();

  await prisma.user.createMany({
    data: [
      {
        id: adminId,
        name: 'Webwiz',
        email: 'webwiz.admin@worksure.dev',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        artisanVerified: false,
        emailVerified: true,
        createdAt: new Date('2026-01-10T08:00:00.000Z'),
      },
      {
        id: platformId,
        name: 'WorkSure Platform',
        email: 'platform@worksure.dev',
        passwordHash: 'system:platform',
        role: 'ADMIN',
        status: 'ACTIVE',
        artisanVerified: false,
        emailVerified: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: uuidv4(),
        name: 'Test Client',
        email: 'test.client@worksure.dev',
        passwordHash: adminPasswordHash, // Use same AdminPass123
        role: 'CLIENT',
        status: 'ACTIVE',
        artisanVerified: false,
        emailVerified: true,
        createdAt: new Date(),
      },
      {
        id: uuidv4(),
        name: 'Test Artisan',
        email: 'test.artisan@worksure.dev',
        passwordHash: adminPasswordHash, // Use same AdminPass123
        role: 'ARTISAN',
        status: 'ACTIVE',
        artisanVerified: true, // Artisan is verified
        emailVerified: true,
        createdAt: new Date(),
      },
    ],
  });
}

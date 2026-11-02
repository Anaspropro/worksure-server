import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '../src/generated/prisma';

export async function resetAdminFixtures(prisma: PrismaClient) {
  await prisma.review.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.proposalAttachment.deleteMany();
  await prisma.proposalTimelineEvent.deleteMany();
  await prisma.proposalDecision.deleteMany();
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

export async function seedAdminFixtures(
  prisma: PrismaClient,
  forceReset = false,
) {
  if (forceReset || process.env.RESET_DB === 'true') {
    await resetAdminFixtures(prisma);
  }

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

  const rawPassword = 'WebwiZ@22';
  const adminPasswordHash = rawPassword.startsWith('$2')
    ? rawPassword
    : await bcrypt.hash(rawPassword, 10);

  const adminId = uuidv4();
  const platformId = uuidv4();

  // Safe Upsert for Webwiz admin
  await prisma.user.upsert({
    where: { email: 'anas.webwiz@gmail.com' },
    update: {
      name: 'Webwiz',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      adminRoles: ['SUPER_ADMIN'],
      status: 'ACTIVE',
      emailVerified: true,
    },
    create: {
      id: adminId,
      name: 'Webwiz',
      email: 'anas.webwiz@gmail.com',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      adminRoles: ['SUPER_ADMIN'],
      status: 'ACTIVE',
      artisanVerified: false,
      emailVerified: true,
      createdAt: new Date('2026-01-10T08:00:00.000Z'),
    },
  });

  // Safe Upsert for WorkSure Platform admin
  await prisma.user.upsert({
    where: { email: 'aliuanas004@gmail.com' },
    update: {
      name: 'WorkSure Platform',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
    create: {
      id: platformId,
      name: 'WorkSure Platform',
      email: 'aliuanas004@gmail.com',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      artisanVerified: false,
      emailVerified: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  });
}

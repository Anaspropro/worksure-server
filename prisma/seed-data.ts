import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '../src/generated/prisma';

export async function resetAdminFixtures(prisma: PrismaClient) {
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.wallet.deleteMany();
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
  const clientPasswordHash = await bcrypt.hash('ClientPass123', 10);
  const artisanOnePasswordHash = await bcrypt.hash('ArtisanPass123', 10);
  const artisanTwoPasswordHash = await bcrypt.hash('ArtisanPass456', 10);

  // Generate UUIDs for users
  const adminId = uuidv4();
  const clientId = uuidv4();
  const artisanOneId = uuidv4();
  const artisanTwoId = uuidv4();
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
        id: clientId,
        name: 'Chinedu Client',
        email: 'chinedu.client@worksure.dev',
        passwordHash: clientPasswordHash,
        role: 'CLIENT',
        status: 'ACTIVE',
        artisanVerified: false,
        emailVerified: true,
        createdAt: new Date('2026-02-01T10:30:00.000Z'),
      },
      {
        id: artisanOneId,
        name: 'Bola Builder',
        email: 'bola.builder@worksure.dev',
        passwordHash: artisanOnePasswordHash,
        role: 'ARTISAN',
        status: 'ACTIVE',
        artisanVerified: false,
        emailVerified: true,
        createdAt: new Date('2026-02-03T09:15:00.000Z'),
      },
      {
        id: artisanTwoId,
        name: 'Kemi Carpenter',
        email: 'kemi.carpenter@worksure.dev',
        passwordHash: artisanTwoPasswordHash,
        role: 'ARTISAN',
        status: 'BANNED',
        artisanVerified: true,
        emailVerified: true,
        createdAt: new Date('2026-01-22T11:45:00.000Z'),
      },
      {
        id: platformId,
        name: 'WorkSure Platform',
        email: 'aliuanas',
        passwordHash: 'system:platform',
        role: 'ADMIN',
        status: 'ACTIVE',
        artisanVerified: false,
        emailVerified: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ],
  });

  // Generate UUIDs for jobs
  const jobOneId = uuidv4();
  const jobTwoId = uuidv4();
  const jobThreeId = uuidv4();

  await prisma.job.createMany({
    data: [
      {
        id: jobOneId,
        title: 'Kitchen wall tiling',
        description:
          'Need experienced tiler for kitchen backsplash and wall installation',
        budget: 85000,
        clientId: clientId,
        amount: 85000,
        status: 'IN_PROGRESS',
        flagged: true,
        createdAt: new Date('2026-03-16T14:00:00.000Z'),
      },
      {
        id: jobTwoId,
        title: 'Office desk carpentry',
        description: 'Custom office desk and shelving unit needed',
        budget: 120000,
        clientId: clientId,
        amount: 120000,
        status: 'OPEN',
        flagged: false,
        createdAt: new Date('2026-03-18T09:30:00.000Z'),
      },
      {
        id: jobThreeId,
        title: 'Electrical wiring installation',
        description: 'Complete electrical wiring for new office space',
        budget: 95000,
        clientId: clientId,
        amount: 95000,
        status: 'OPEN',
        flagged: false,
        createdAt: new Date('2026-03-20T11:00:00.000Z'),
      },
    ],
  });

  // Create artisan profiles
  await prisma.artisanProfile.createMany({
    data: [
      {
        id: uuidv4(),
        userId: artisanOneId,
        bio: 'Experienced tiler with 8+ years in residential and commercial projects. Specialized in kitchen and bathroom installations.',
        skills: JSON.stringify([
          'ceramic tiling',
          'porcelain installation',
          'grouting',
          'waterproofing',
          'backsplash installation',
        ]),
        experience: '8+ years of professional tiling experience. Completed over 150 residential projects and 20 commercial installations.',
        portfolio: JSON.stringify([
          'https://example.com/portfolio/kitchen-001.jpg',
          'https://example.com/portfolio/bathroom-001.jpg',
          'https://example.com/portfolio/backsplash-001.jpg',
        ]),
        verified: false,
        rating: 4.5,
        reviewCount: 12,
        createdAt: new Date('2026-02-03T09:15:00.000Z'),
      },
      {
        id: uuidv4(),
        userId: artisanTwoId,
        bio: 'Master carpenter specializing in custom furniture and office installations. 15+ years of experience.',
        skills: JSON.stringify([
          'custom furniture',
          'office installation',
          'shelving',
          'cabinet making',
          'wood finishing',
        ]),
        experience: '15+ years as a master carpenter. Have worked with over 200 clients on custom projects.',
        portfolio: JSON.stringify([
          'https://example.com/portfolio/desk-001.jpg',
          'https://example.com/portfolio/shelving-001.jpg',
          'https://example.com/portfolio/cabinet-001.jpg',
        ]),
        verified: true,
        rating: 4.8,
        reviewCount: 28,
        createdAt: new Date('2026-01-22T11:45:00.000Z'),
      },
    ],
  });

  // Generate UUIDs for proposals
  const proposalOneId = uuidv4();
  const proposalTwoId = uuidv4();

  await prisma.proposal.createMany({
    data: [
      {
        id: proposalOneId,
        jobId: jobOneId,
        artisanId: artisanOneId,
        clientId: clientId,
        amount: 85000,
        message: 'I can complete your kitchen tiling project within 3 days. I have extensive experience with backsplash installations and will provide high-quality materials.',
        status: 'ACCEPTED',
        createdAt: new Date('2026-03-16T12:00:00.000Z'),
        updatedAt: new Date('2026-03-16T13:00:00.000Z'),
      },
      {
        id: proposalTwoId,
        jobId: jobTwoId,
        artisanId: artisanTwoId,
        clientId: clientId,
        amount: 120000,
        message: 'Custom office desk and shelving unit - I can design and build exactly what you need. Premium wood materials included.',
        status: 'ACCEPTED',
        createdAt: new Date('2026-03-01T07:00:00.000Z'),
        updatedAt: new Date('2026-03-01T08:30:00.000Z'),
      },
    ],
  });

  // Generate UUIDs for contracts
  const contractOneId = uuidv4();
  const contractTwoId = uuidv4();

  await prisma.contract.createMany({
    data: [
      {
        id: contractOneId,
        amount: 85000,
        status: 'IN_PROGRESS',
        escrowReleased: false,
        clientId: clientId,
        artisanId: artisanOneId,
        clientConfirmedCompletion: false,
        artisanConfirmedCompletion: true,
        jobId: jobOneId,
        proposalId: proposalOneId,
        fundedAt: new Date('2026-03-16T14:30:00.000Z'),
        activatedAt: new Date('2026-03-16T14:45:00.000Z'),
        startedAt: new Date('2026-03-17T08:00:00.000Z'),
        createdAt: new Date('2026-03-16T13:00:00.000Z'),
        updatedAt: new Date('2026-03-16T14:45:00.000Z'),
      },
      {
        id: contractTwoId,
        amount: 120000,
        status: 'COMPLETED',
        escrowReleased: true,
        clientId: clientId,
        artisanId: artisanTwoId,
        clientConfirmedCompletion: true,
        clientConfirmedAt: new Date('2026-03-10T17:30:00.000Z'),
        artisanConfirmedCompletion: true,
        artisanConfirmedAt: new Date('2026-03-10T17:45:00.000Z'),
        jobId: jobTwoId,
        proposalId: proposalTwoId,
        fundedAt: new Date('2026-03-01T09:00:00.000Z'),
        activatedAt: new Date('2026-03-01T09:15:00.000Z'),
        startedAt: new Date('2026-03-02T08:00:00.000Z'),
        completedAt: new Date('2026-03-10T17:00:00.000Z'),
        escrowReleasedAt: new Date('2026-03-11T09:00:00.000Z'),
        platformFeeDeducted: true,
        createdAt: new Date('2026-03-01T08:30:00.000Z'),
        updatedAt: new Date('2026-03-11T09:00:00.000Z'),
      },
    ],
  });

  // Generate UUIDs for wallets
  const clientWalletId = uuidv4();
  const artisanOneWalletId = uuidv4();
  const artisanTwoWalletId = uuidv4();
  const platformWalletId = uuidv4();

  await prisma.wallet.createMany({
    data: [
      {
        id: clientWalletId,
        userId: clientId,
        balance: 50000,
        frozen: 0,
        version: 1,
        createdAt: new Date('2026-02-01T10:30:00.000Z'),
        updatedAt: new Date('2026-03-20T14:00:00.000Z'),
      },
      {
        id: artisanOneWalletId,
        userId: artisanOneId,
        balance: 120000,
        frozen: 0,
        version: 1,
        createdAt: new Date('2026-02-03T09:15:00.000Z'),
        updatedAt: new Date('2026-03-11T09:30:00.000Z'),
      },
      {
        id: artisanTwoWalletId,
        userId: artisanTwoId,
        balance: 180000,
        frozen: 0,
        version: 1,
        createdAt: new Date('2026-01-22T11:45:00.000Z'),
        updatedAt: new Date('2026-03-11T09:15:00.000Z'),
      },
      {
        id: platformWalletId,
        userId: platformId,
        balance: 24000,
        frozen: 0,
        version: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-11T09:00:00.000Z'),
      },
    ],
  });

  // Generate UUIDs for transactions
  await prisma.transaction.createMany({
    data: [
      {
        id: uuidv4(),
        userId: clientId,
        type: 'ESCROW_HOLD',
        amount: 85000,
        status: 'COMPLETED',
        reference: `escrow-${contractOneId}`,
        createdAt: new Date('2026-03-16T14:30:00.000Z'),
      },
      {
        id: uuidv4(),
        userId: clientId,
        type: 'ESCROW_HOLD',
        amount: 120000,
        status: 'COMPLETED',
        reference: `escrow-${contractTwoId}`,
        createdAt: new Date('2026-03-01T09:00:00.000Z'),
      },
      {
        id: uuidv4(),
        userId: artisanTwoId,
        type: 'ESCROW_RELEASE',
        amount: 120000,
        status: 'COMPLETED',
        reference: `earnings-${contractTwoId}`,
        createdAt: new Date('2026-03-11T09:00:00.000Z'),
      },
    ],
  });

  // Generate UUIDs for payments
  await prisma.payment.createMany({
    data: [
      {
        id: uuidv4(),
        contractId: contractOneId,
        userId: clientId,
        amount: 85000,
        status: 'COMPLETED',
        paymentMethod: 'ESCROW',
        paymentReference: `payment-${contractOneId}`,
        createdAt: new Date('2026-03-16T14:30:00.000Z'),
        completedAt: new Date('2026-03-16T14:35:00.000Z'),
      },
      {
        id: uuidv4(),
        contractId: contractTwoId,
        userId: clientId,
        amount: 120000,
        status: 'COMPLETED',
        paymentMethod: 'ESCROW',
        paymentReference: `payment-${contractTwoId}`,
        createdAt: new Date('2026-03-01T09:00:00.000Z'),
        completedAt: new Date('2026-03-01T09:05:00.000Z'),
      },
    ],
  });

  // Generate UUIDs for notifications
  await prisma.notification.createMany({
    data: [
      {
        id: uuidv4(),
        userId: clientId,
        title: 'Contract Funded',
        message: 'Your contract for kitchen tiling has been funded successfully.',
        type: 'CONTRACT',
        read: false,
        createdAt: new Date('2026-03-17T15:05:00.000Z'),
      },
      {
        id: uuidv4(),
        userId: artisanOneId,
        title: 'Work Started',
        message: 'The client has confirmed the start of work for kitchen tiling.',
        type: 'CONTRACT',
        read: false,
        createdAt: new Date('2026-03-18T08:05:00.000Z'),
      },
    ],
  });

}

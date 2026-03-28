import * as bcrypt from 'bcrypt';
import { PrismaClient, TransactionStatus } from '../src/generated/prisma';

export async function resetAdminFixtures(prisma: PrismaClient) {
  await prisma.review.deleteMany();
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
}

export async function seedAdminFixtures(prisma: PrismaClient) {
  await resetAdminFixtures(prisma);

  const adminPasswordHash = await bcrypt.hash('AdminPass123', 10);
  const clientPasswordHash = await bcrypt.hash('ClientPass123', 10);
  const artisanOnePasswordHash = await bcrypt.hash('ArtisanPass123', 10);
  const artisanTwoPasswordHash = await bcrypt.hash('ArtisanPass456', 10);

  await prisma.user.createMany({
    data: [
      {
        id: 'usr_admin_001',
        name: 'Webwiz',
        email: 'webwiz.admin@worksure.dev',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        artisanVerified: false,
        createdAt: new Date('2026-01-10T08:00:00.000Z'),
      },
      {
        id: 'usr_client_001',
        name: 'Chinedu Client',
        email: 'chinedu.client@worksure.dev',
        passwordHash: clientPasswordHash,
        role: 'CLIENT',
        status: 'ACTIVE',
        artisanVerified: false,
        createdAt: new Date('2026-02-01T10:30:00.000Z'),
      },
      {
        id: 'usr_artisan_001',
        name: 'Bola Builder',
        email: 'bola.builder@worksure.dev',
        passwordHash: artisanOnePasswordHash,
        role: 'ARTISAN',
        status: 'ACTIVE',
        artisanVerified: false,
        createdAt: new Date('2026-02-03T09:15:00.000Z'),
      },
      {
        id: 'usr_artisan_002',
        name: 'Kemi Carpenter',
        email: 'kemi.carpenter@worksure.dev',
        passwordHash: artisanTwoPasswordHash,
        role: 'ARTISAN',
        status: 'BANNED',
        artisanVerified: true,
        createdAt: new Date('2026-01-22T11:45:00.000Z'),
      },
      {
        id: 'platform',
        name: 'WorkSure Platform',
        email: 'platform@worksure.dev',
        passwordHash: 'system:platform',
        role: 'ADMIN',
        status: 'ACTIVE',
        artisanVerified: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ],
  });

  await prisma.job.createMany({
    data: [
      {
        id: 'job_001',
        title: 'Kitchen wall tiling',
        description: 'Need experienced tiler for kitchen backsplash and wall installation',
        budget: 85000,
        clientId: 'usr_client_001',
        amount: 85000,
        status: 'IN_PROGRESS',
        flagged: true,
        createdAt: new Date('2026-03-16T14:00:00.000Z'),
      },
      {
        id: 'job_002',
        title: 'Office desk carpentry',
        description: 'Custom office desk and shelving unit needed',
        budget: 120000,
        clientId: 'usr_client_001',
        amount: 120000,
        status: 'COMPLETED',
        flagged: false,
        createdAt: new Date('2026-03-01T08:00:00.000Z'),
      },
      {
        id: 'job_003',
        title: 'Bathroom renovation',
        description: 'Complete bathroom remodel including plumbing and tiling',
        budget: 250000,
        clientId: 'usr_client_001',
        status: 'OPEN',
        flagged: false,
        createdAt: new Date('2026-03-25T10:00:00.000Z'),
      },
    ],
  });

  // Create artisan profiles
  await prisma.artisanProfile.createMany({
    data: [
      {
        id: 'apr_001',
        userId: 'usr_artisan_001',
        bio: 'Experienced tiler with 8+ years in residential and commercial projects. Specialized in kitchen and bathroom installations.',
        skills: JSON.stringify(['ceramic tiling', 'porcelain installation', 'grouting', 'waterproofing', 'backsplash installation']),
        experience: '8+ years of professional tiling experience. Completed over 150 residential projects and 20 commercial installations.',
        portfolio: JSON.stringify([
          'https://example.com/portfolio/kitchen-001.jpg',
          'https://example.com/portfolio/bathroom-001.jpg',
          'https://example.com/portfolio/backsplash-001.jpg'
        ]),
        verified: false,
        rating: 4.5,
        reviewCount: 12,
        createdAt: new Date('2026-02-03T09:15:00.000Z'),
      },
      {
        id: 'apr_002',
        userId: 'usr_artisan_002',
        bio: 'Master carpenter specializing in custom furniture and office installations. 15+ years of experience.',
        skills: JSON.stringify(['custom furniture', 'office installation', 'shelving', 'cabinet making', 'wood finishing']),
        experience: '15+ years as a master carpenter. Have worked with over 200 clients on custom projects.',
        portfolio: JSON.stringify([
          'https://example.com/portfolio/desk-001.jpg',
          'https://example.com/portfolio/shelving-001.jpg',
          'https://example.com/portfolio/cabinet-001.jpg'
        ]),
        verified: true,
        rating: 4.8,
        reviewCount: 28,
        createdAt: new Date('2026-01-22T11:45:00.000Z'),
      },
    ],
  });

  // Create proposals
  await prisma.proposal.createMany({
    data: [
      {
        id: 'prp_001',
        jobId: 'job_001',
        artisanId: 'usr_artisan_001',
        clientId: 'usr_client_001',
        amount: 85000,
        message: 'I can complete your kitchen tiling project within 3 days. I have extensive experience with backsplash installations and will provide high-quality materials.',
        status: 'ACCEPTED',
        createdAt: new Date('2026-03-16T12:00:00.000Z'),
        updatedAt: new Date('2026-03-16T13:00:00.000Z'),
      },
      {
        id: 'prp_002',
        jobId: 'job_002',
        artisanId: 'usr_artisan_002',
        clientId: 'usr_client_001',
        amount: 120000,
        message: 'Custom office desk and shelving unit - I can design and build exactly what you need. Premium wood materials included.',
        status: 'ACCEPTED',
        createdAt: new Date('2026-03-01T07:00:00.000Z'),
        updatedAt: new Date('2026-03-01T08:30:00.000Z'),
      },
      {
        id: 'prp_003',
        jobId: 'job_003',
        artisanId: 'usr_artisan_001',
        clientId: 'usr_client_001',
        amount: 250000,
        message: 'Complete bathroom renovation including plumbing, tiling, and fixtures. Estimated timeline: 2 weeks.',
        status: 'PENDING',
        createdAt: new Date('2026-03-25T11:00:00.000Z'),
      },
    ],
  });

  // Create contracts
  await prisma.contract.createMany({
    data: [
      {
        id: 'ctr_001',
        jobId: 'job_001',
        proposalId: 'prp_001',
        clientId: 'usr_client_001',
        artisanId: 'usr_artisan_001',
        amount: 85000,
        status: 'ACTIVE',
        fundedAt: new Date('2026-03-16T14:30:00.000Z'),
        activatedAt: new Date('2026-03-16T14:45:00.000Z'),
        startedAt: new Date('2026-03-17T08:00:00.000Z'),
        createdAt: new Date('2026-03-16T13:00:00.000Z'),
        updatedAt: new Date('2026-03-16T14:45:00.000Z'),
      },
      {
        id: 'ctr_002',
        jobId: 'job_002',
        proposalId: 'prp_002',
        clientId: 'usr_client_001',
        artisanId: 'usr_artisan_002',
        amount: 120000,
        status: 'COMPLETED',
        fundedAt: new Date('2026-03-01T09:00:00.000Z'),
        activatedAt: new Date('2026-03-01T09:15:00.000Z'),
        startedAt: new Date('2026-03-02T08:00:00.000Z'),
        completedAt: new Date('2026-03-10T17:00:00.000Z'),
        clientConfirmedCompletion: true,
        clientConfirmedAt: new Date('2026-03-10T17:30:00.000Z'),
        artisanConfirmedCompletion: true,
        artisanConfirmedAt: new Date('2026-03-10T17:45:00.000Z'),
        escrowReleased: true,
        escrowReleasedAt: new Date('2026-03-11T09:00:00.000Z'),
        platformFeeDeducted: true,
        createdAt: new Date('2026-03-01T08:30:00.000Z'),
        updatedAt: new Date('2026-03-11T09:00:00.000Z'),
      },
    ],
  });

  // Create wallets
  await prisma.wallet.createMany({
    data: [
      {
        id: 'wal_001',
        userId: 'usr_client_001',
        balance: 50000,
        frozen: 0,
        version: 1,
        createdAt: new Date('2026-02-01T10:30:00.000Z'),
        updatedAt: new Date('2026-03-20T14:00:00.000Z'),
      },
      {
        id: 'wal_002',
        userId: 'usr_artisan_001',
        balance: 120000,
        frozen: 0,
        version: 1,
        createdAt: new Date('2026-02-03T09:15:00.000Z'),
        updatedAt: new Date('2026-03-11T09:30:00.000Z'),
      },
      {
        id: 'wal_003',
        userId: 'usr_artisan_002',
        balance: 180000,
        frozen: 0,
        version: 1,
        createdAt: new Date('2026-01-22T11:45:00.000Z'),
        updatedAt: new Date('2026-03-11T09:15:00.000Z'),
      },
      {
        id: 'wal_platform',
        userId: 'platform',
        balance: 24000,
        frozen: 0,
        version: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-11T09:00:00.000Z'),
      },
    ],
  });

  // Create reviews
  await prisma.review.createMany({
    data: [
      {
        id: 'rvw_001',
        contractId: 'ctr_002',
        clientId: 'usr_client_001',
        artisanId: 'usr_artisan_002',
        rating: 5,
        comment: 'Excellent work! The custom office desk and shelving exceeded my expectations. Professional and timely.',
        createdAt: new Date('2026-03-11T10:00:00.000Z'),
      },
    ],
  });

  await prisma.dispute.createMany({
    data: [
      {
        id: 'dsp_001',
        contractId: 'ctr_001',
        jobId: 'job_001',
        clientId: 'usr_client_001',
        artisanId: 'usr_artisan_001',
        amount: 85000,
        status: 'OPEN',
        evidenceImages: ['https://example.com/evidence/job-001-damage.jpg'],
        evidenceVideos: ['https://example.com/evidence/job-001-walkthrough.mp4'],
        evidenceMessages: ['Client reported incomplete tiling work on March 20.'],
        createdAt: new Date('2026-03-20T15:20:00.000Z'),
      },
      {
        id: 'dsp_002',
        contractId: 'ctr_002',
        jobId: 'job_002',
        clientId: 'usr_client_001',
        artisanId: 'usr_artisan_002',
        amount: 120000,
        status: 'RESOLVED',
        evidenceImages: ['https://example.com/evidence/job-002-before.jpg'],
        evidenceVideos: [],
        evidenceMessages: ['Admin previously reviewed progress photos and approved payout.'],
        resolutionDecision: 'PAY_ARTISAN',
        resolvedAt: new Date('2026-03-03T12:00:00.000Z'),
        resolvedBy: 'usr_admin_001',
        resolutionNotes: 'Evidence showed milestone completed as contracted.',
        createdAt: new Date('2026-03-01T09:00:00.000Z'),
      },
    ],
  });

  await prisma.disputeHistory.createMany({
    data: [
      {
        id: 'dsh_001',
        disputeId: 'dsp_001',
        action: 'DISPUTE_OPENED',
        at: new Date('2026-03-20T15:20:00.000Z'),
        by: 'usr_client_001',
        notes: 'Client requested refund after incomplete delivery.',
      },
      {
        id: 'dsh_002',
        disputeId: 'dsp_002',
        action: 'DISPUTE_OPENED',
        at: new Date('2026-03-01T09:00:00.000Z'),
        by: 'usr_client_001',
      },
      {
        id: 'dsh_003',
        disputeId: 'dsp_002',
        action: 'DISPUTE_RESOLVED',
        at: new Date('2026-03-03T12:00:00.000Z'),
        by: 'usr_admin_001',
        notes: 'Evidence showed milestone completed as contracted.',
      },
    ],
  });

  await prisma.transaction.createMany({
    data: [
      {
        id: 'txn_001',
        userId: 'usr_client_001',
        type: 'FUNDING',
        amount: 205000,
        status: 'COMPLETED',
        reference: 'fund_wallet_001',
        metadata: JSON.stringify({ paymentMethod: 'bank_transfer', gateway: 'stripe' }),
        createdAt: new Date('2026-03-15T10:00:00.000Z'),
        completedAt: new Date('2026-03-15T10:05:00.000Z'),
      },
      {
        id: 'txn_002',
        userId: 'usr_client_001',
        type: 'ESCROW_HOLD',
        amount: 85000,
        status: 'COMPLETED',
        reference: 'escrow_ctr_001',
        metadata: JSON.stringify({ contractId: 'ctr_001', jobId: 'job_001' }),
        createdAt: new Date('2026-03-16T14:30:00.000Z'),
        completedAt: new Date('2026-03-16T14:31:00.000Z'),
      },
      {
        id: 'txn_003',
        userId: 'usr_client_001',
        type: 'ESCROW_HOLD',
        amount: 120000,
        status: 'COMPLETED',
        reference: 'escrow_ctr_002',
        metadata: JSON.stringify({ contractId: 'ctr_002', jobId: 'job_002' }),
        createdAt: new Date('2026-03-01T09:00:00.000Z'),
        completedAt: new Date('2026-03-01T09:01:00.000Z'),
      },
      {
        id: 'txn_004',
        userId: 'usr_artisan_002',
        type: 'ESCROW_RELEASE',
        amount: 108000,
        status: 'COMPLETED',
        reference: 'release_ctr_002',
        metadata: JSON.stringify({ contractId: 'ctr_002', platformFee: 12000 }),
        createdAt: new Date('2026-03-11T09:00:00.000Z'),
        completedAt: new Date('2026-03-11T09:02:00.000Z'),
      },
      {
        id: 'txn_005',
        userId: 'platform',
        type: 'PLATFORM_FEE',
        amount: 12000,
        status: 'COMPLETED',
        reference: 'fee_ctr_002',
        metadata: JSON.stringify({ contractId: 'ctr_002', feeRate: 0.1 }),
        createdAt: new Date('2026-03-11T09:01:00.000Z'),
        completedAt: new Date('2026-03-11T09:01:30.000Z'),
      },
    ],
  });

  // Create notifications
  await prisma.notification.createMany({
    data: [
      {
        id: 'ntf_001',
        userId: 'usr_client_001',
        title: 'Proposal Accepted',
        message: 'Your proposal for "Kitchen wall tiling" has been accepted',
        createdAt: new Date('2026-03-16T13:00:00.000Z'),
      },
      {
        id: 'ntf_002',
        userId: 'usr_artisan_001',
        title: 'New Proposal Received',
        message: 'You received a new proposal for "Kitchen wall tiling"',
        createdAt: new Date('2026-03-16T12:00:00.000Z'),
      },
      {
        id: 'ntf_003',
        userId: 'usr_client_001',
        title: 'Contract Completed',
        message: 'The contract for "Office desk carpentry" has been completed',
        createdAt: new Date('2026-03-10T17:00:00.000Z'),
      },
      {
        id: 'ntf_004',
        userId: 'usr_artisan_002',
        title: 'Payment Released',
        message: 'Payment for "Office desk carpentry" has been released to your wallet',
        createdAt: new Date('2026-03-11T09:02:00.000Z'),
      },
      {
        id: 'ntf_005',
        userId: 'usr_client_001',
        title: 'Dispute Created',
        message: 'A dispute has been created for "Kitchen wall tiling"',
        createdAt: new Date('2026-03-20T15:20:00.000Z'),
      },
      {
        id: 'ntf_006',
        userId: 'usr_admin_001',
        title: 'New Dispute Requires Review',
        message: 'A new dispute has been created and requires your attention',
        createdAt: new Date('2026-03-20T15:21:00.000Z'),
      },
    ],
  });
}

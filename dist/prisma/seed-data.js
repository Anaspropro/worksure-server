"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetAdminFixtures = resetAdminFixtures;
exports.seedAdminFixtures = seedAdminFixtures;
const bcrypt = require("bcrypt");
const prisma_1 = require("../src/generated/prisma");
async function resetAdminFixtures(prisma) {
    await prisma.auditLog.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.disputeHistory.deleteMany();
    await prisma.dispute.deleteMany();
    await prisma.job.deleteMany();
    await prisma.user.deleteMany();
}
async function seedAdminFixtures(prisma) {
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
                contractId: 'ctr_001',
                clientId: 'usr_client_001',
                artisanId: 'usr_artisan_001',
                amount: 85000,
                status: 'IN_PROGRESS',
                flagged: true,
                createdAt: new Date('2026-03-16T14:00:00.000Z'),
            },
            {
                id: 'job_002',
                title: 'Office desk carpentry',
                contractId: 'ctr_002',
                clientId: 'usr_client_001',
                artisanId: 'usr_artisan_002',
                amount: 120000,
                status: 'COMPLETED',
                flagged: false,
                createdAt: new Date('2026-03-01T08:00:00.000Z'),
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
                status: prisma_1.TransactionStatus.COMPLETED,
                reference: 'fund_wallet_001',
                createdAt: new Date('2026-03-15T10:00:00.000Z'),
            },
            {
                id: 'txn_002',
                userId: 'usr_client_001',
                type: 'ESCROW_HOLD',
                amount: 85000,
                status: prisma_1.TransactionStatus.COMPLETED,
                reference: 'escrow_ctr_001',
                createdAt: new Date('2026-03-16T14:30:00.000Z'),
            },
            {
                id: 'txn_003',
                userId: 'platform',
                type: 'PLATFORM_FEE',
                amount: 12000,
                status: prisma_1.TransactionStatus.COMPLETED,
                reference: 'fee_ctr_002',
                createdAt: new Date('2026-03-03T12:05:00.000Z'),
            },
        ],
    });
}
//# sourceMappingURL=seed-data.js.map
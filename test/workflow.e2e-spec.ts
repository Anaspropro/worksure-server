import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { setupIsolatedTestDatabase } from './test-database';

jest.setTimeout(30000);

describe('Workflow enforcement (e2e)', () => {
  let app: INestApplication;
  let prisma: Awaited<ReturnType<typeof setupIsolatedTestDatabase>>['prisma'];
  let testDatabase: Awaited<ReturnType<typeof setupIsolatedTestDatabase>>;

  beforeAll(async () => {
    testDatabase = await setupIsolatedTestDatabase('workflow_e2e');
    process.env.DATABASE_URL = testDatabase.databaseUrl;
    prisma = testDatabase.prisma;
    const { AppModule } = await import('../src/app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await testDatabase?.teardown();
  });

  it('blocks unverified artisans from proposing and enforces contract lifecycle checks', async () => {
    const suffix = Date.now();
    const clientEmail = `workflow-client-${suffix}@worksure.dev`;
    const artisanEmail = `workflow-artisan-${suffix}@worksure.dev`;

    const clientRegistration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Workflow Client',
        email: clientEmail,
        password: 'SecurePass123',
        role: 'CLIENT',
      })
      .expect(201);

    const artisanRegistration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Workflow Artisan',
        email: artisanEmail,
        password: 'SecurePass123',
        role: 'ARTISAN',
      })
      .expect(201);

    const clientToken = clientRegistration.body.data.accessToken as string;
    const artisanToken = artisanRegistration.body.data.accessToken as string;

    const jobResponse = await request(app.getHttpServer())
      .post('/jobs')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Kitchen cabinet repair',
        description: 'Fix damaged cabinet hinges and align doors.',
        budget: 50000,
      })
      .expect(201);

    const jobId = jobResponse.body.id as string;

    await request(app.getHttpServer())
      .post('/proposals')
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({
        jobId,
        amount: 45000,
        message: 'I can handle this repair within two days.',
      })
      .expect(403);

    const artisan = await prisma.user.findUniqueOrThrow({
      where: { email: artisanEmail },
    });

    await prisma.user.update({
      where: { id: artisan.id },
      data: {
        artisanVerified: true,
      },
    });

    const proposalResponse = await request(app.getHttpServer())
      .post('/proposals')
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({
        jobId,
        amount: 45000,
        message: 'I can handle this repair within two days.',
      })
      .expect(201);

    const proposalId = proposalResponse.body.id as string;

    await request(app.getHttpServer())
      .patch(`/proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const contractResponse = await request(app.getHttpServer())
      .post('/contracts')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        proposalId,
      })
      .expect(201);

    const contractId = contractResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post('/wallet/create')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/wallet/add-funds')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        amount: 60000,
        reference: `workflow-funding-${suffix}`,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/contracts/${contractId}/fund`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        amount: 45000,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/contracts/${contractId}/confirm-completion`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        isClient: true,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/contracts/${contractId}/activate`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/contracts/${contractId}/confirm-completion`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        isClient: true,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/contracts/${contractId}/confirm-completion`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        isClient: true,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/contracts/${contractId}/confirm-completion`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({
        isClient: false,
      })
      .expect(200);

    const releaseResponse = await request(app.getHttpServer())
      .post(`/contracts/${contractId}/release-escrow`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    expect(releaseResponse.body.message).toContain('Escrow released');

    const clientWallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: clientRegistration.body.data.user.id },
    });
    const artisanWallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: artisan.id },
    });
    const contract = await prisma.contract.findUniqueOrThrow({
      where: { id: contractId },
    });

    expect(clientWallet.frozen).toBe(0);
    expect(artisanWallet.balance).toBe(45000);
    expect(contract.status).toBe('COMPLETED');
    expect(contract.escrowReleased).toBe(true);
  });
});

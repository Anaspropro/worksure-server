import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { seedAdminFixtures } from '../prisma/seed-data';
import { setupIsolatedTestDatabase } from './test-database';

jest.setTimeout(30000);

describe('AdminModule (e2e)', () => {
  let app: INestApplication;
  let prisma: Awaited<ReturnType<typeof setupIsolatedTestDatabase>>['prisma'];
  let testDatabase: Awaited<ReturnType<typeof setupIsolatedTestDatabase>>;
  let adminAccessToken: string;

  beforeAll(async () => {
    testDatabase = await setupIsolatedTestDatabase('admin_e2e');
    process.env.DATABASE_URL = testDatabase.databaseUrl;
    prisma = testDatabase.prisma;
    await seedAdminFixtures(prisma);
    const { AppModule } = await import('../src/app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'webwiz.admin@worksure.dev',
        password: 'AdminPass123',
      })
      .expect(201);

    adminAccessToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    await app?.close();
    await testDatabase?.teardown();
  });

  it('blocks non-admin access to admin endpoints', async () => {
    const clientLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'chinedu.client@worksure.dev',
        password: 'ClientPass123',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/admin/users')
      .set(
        'Authorization',
        `Bearer ${clientLoginResponse.body.data.accessToken as string}`,
      )
      .expect(403);
  });

  it('returns admin users for admin access', async () => {
    const response = await request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body.meta.total).toBeGreaterThan(0);
    expect(response.body.data[0]).toHaveProperty('email');
  });

  it('resolves disputes and records audit data', async () => {
    const resolveResponse = await request(app.getHttpServer())
      .patch('/admin/disputes/dsp_001/resolve')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        decision: 'REFUND_CLIENT',
        notes: 'Evidence supports a full refund.',
      })
      .expect(200);

    expect(resolveResponse.body.data.status).toBe('RESOLVED');
    expect(resolveResponse.body.sideEffects.walletTransactionRecorded).toBe(
      true,
    );

    const auditResponse = await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(auditResponse.body.meta.total).toBeGreaterThan(0);
    expect(auditResponse.body.data[0].action).toBe('DISPUTE_RESOLVED');
  });

  it('rejects artisan verification for non-artisan users', async () => {
    await request(app.getHttpServer())
      .patch('/admin/users/usr_client_001/verify')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(400);
  });

  it('issues reset tokens and completes the reset flow with audit coverage', async () => {
    const resetResponse = await request(app.getHttpServer())
      .patch('/admin/users/usr_artisan_001/reset-password')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        expiresInMinutes: 45,
      })
      .expect(200);

    expect(resetResponse.body.data.resetToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        token: resetResponse.body.data.resetToken,
        newPassword: 'ArtisanPass999',
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'bola.builder@worksure.dev',
        password: 'ArtisanPass999',
      })
      .expect(201);

    expect(loginResponse.body.data.accessToken).toEqual(expect.any(String));

    const auditResponse = await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(
      auditResponse.body.data.some(
        (log) => log.action === 'USER_PASSWORD_RESET',
      ),
    ).toBe(true);
  });
});

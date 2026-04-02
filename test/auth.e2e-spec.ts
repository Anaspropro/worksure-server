import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { setupIsolatedTestDatabase } from './test-database';

jest.setTimeout(30000);

describe('AuthModule (e2e)', () => {
  let app: INestApplication;
  let prisma: Awaited<ReturnType<typeof setupIsolatedTestDatabase>>['prisma'];
  let testDatabase: Awaited<ReturnType<typeof setupIsolatedTestDatabase>>;

  beforeAll(async () => {
    testDatabase = await setupIsolatedTestDatabase('auth_e2e');
    process.env.DATABASE_URL = testDatabase.databaseUrl;
    prisma = testDatabase.prisma;
    const { AppModule } = await import('../src/app.module');

    await prisma.notification.deleteMany({
      where: { user: { email: { startsWith: 'auth-spec-' } } },
    });
    await prisma.transaction.deleteMany({
      where: { user: { email: { startsWith: 'auth-spec-' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'auth-spec-' } },
    });

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
    await prisma?.user.deleteMany({
      where: { email: { startsWith: 'auth-spec-' } },
    });
    await testDatabase?.teardown();
  });

  it('registers a user, manages session-backed auth, and resets the password', async () => {
    const email = `auth-spec-${Date.now()}@worksure.dev`;
    const password = 'SecurePass123';

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Auth Spec User',
        email,
        password,
        role: 'CLIENT',
      })
      .expect(201);

    expect(registerResponse.body.data.user.email).toBe(email);
    expect(registerResponse.body.data.user).not.toHaveProperty('passwordHash');
    expect(registerResponse.body.data.accessToken).toEqual(expect.any(String));

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(201);

    const accessToken = loginResponse.body.data.accessToken as string;
    expect(accessToken).toEqual(expect.any(String));

    const meResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meResponse.body.data.email).toBe(email);
    expect(meResponse.body.data.role).toBe('CLIENT');

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    const secondLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(201);

    const secondAccessToken = secondLoginResponse.body.data
      .accessToken as string;

    const forgotPasswordResponse = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email })
      .expect(201);

    const resetToken = forgotPasswordResponse.body.data.resetToken as string;
    expect(resetToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        token: resetToken,
        newPassword: 'SecurePass456',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${secondAccessToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password: 'SecurePass456',
      })
      .expect(201);
  });
});

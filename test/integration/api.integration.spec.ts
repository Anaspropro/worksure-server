import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../../src/app.setup';
import { setupIsolatedTestDatabase } from '../test-database';

describe('API Integration Tests', () => {
  let app: INestApplication<App>;
  let testDatabase: Awaited<ReturnType<typeof setupIsolatedTestDatabase>>;

  beforeAll(async () => {
    testDatabase = await setupIsolatedTestDatabase('api_integration');
    process.env.DATABASE_URL = testDatabase.databaseUrl;
    const { AppModule } = await import('../../src/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await testDatabase?.teardown();
  });

  describe('Authentication Endpoints', () => {
    it('POST /auth/register - should register a new user', async () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Test Client',
          email: 'test.client@example.com',
          password: 'TestPass123',
          role: 'CLIENT',
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body.user.email).toBe('test.client@example.com');
          expect(body.user.role).toBe('CLIENT');
          expect(body.access_token).toBeDefined();
        });
    });

    it('POST /auth/login - should login with valid credentials', async () => {
      // First register a user
      await request(app.getHttpServer()).post('/auth/register').send({
        name: 'Login Test',
        email: 'login.test@example.com',
        password: 'LoginPass123',
        role: 'CLIENT',
      });

      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'login.test@example.com',
          password: 'LoginPass123',
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.access_token).toBeDefined();
          expect(body.user.email).toBe('login.test@example.com');
        });
    });

    it('POST /auth/login - should reject invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('POST /auth/forgot-password - should request password reset', async () => {
      // First register a user
      await request(app.getHttpServer()).post('/auth/register').send({
        name: 'Password Reset User',
        email: 'password.reset@example.com',
        password: 'OriginalPass123',
        role: 'CLIENT',
      });

      return request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({
          email: 'password.reset@example.com',
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.message).toContain('Password reset token generated');
        });
    });

    it('POST /auth/forgot-password - should handle non-existent email gracefully', () => {
      return request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com',
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.message).toContain('If an account exists');
        });
    });

    it('POST /auth/reset-password - should reject invalid token', () => {
      return request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPass123',
        })
        .expect(404);
    });

    it('should complete full password reset flow', async () => {
      // Register a user
      await request(app.getHttpServer()).post('/auth/register').send({
        name: 'Full Flow User',
        email: 'full.flow@example.com',
        password: 'OriginalPass123',
        role: 'CLIENT',
      });

      // Request password reset
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({
          email: 'full.flow@example.com',
        })
        .expect(200);

      // Get services from the app
      const authService = app.get('AuthService');
      const usersService = app.get('UsersService');

      const user = await usersService.findByEmail('full.flow@example.com');
      const tokenData = await authService.issueUserPasswordReset(user.id, 30);

      // Reset password with valid token
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: tokenData.resetToken,
          newPassword: 'NewSecurePass456',
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.message).toContain('Password reset successful');
        });

      // Login with new password
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'full.flow@example.com',
          password: 'NewSecurePass456',
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.access_token).toBeDefined();
          expect(body.user.email).toBe('full.flow@example.com');
        });

      // Login with old password should fail
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'full.flow@example.com',
          password: 'OriginalPass123',
        })
        .expect(401);
    });
  });

  describe('Jobs Endpoints', () => {
    let clientToken: string;
    let jobId: string;

    beforeAll(async () => {
      // Register and login a client
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Job Client',
          email: 'job.client@example.com',
          password: 'JobPass123',
          role: 'CLIENT',
        });

      clientToken = registerResponse.body.access_token;
    });

    it('POST /jobs - should create a new job', () => {
      return request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          title: 'Test Job',
          description: 'This is a test job for integration testing',
          budget: 50000,
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body.title).toBe('Test Job');
          expect(body.budget).toBe(50000);
          jobId = body.id;
        });
    });

    it('GET /jobs - should list jobs', () => {
      return request(app.getHttpServer())
        .get('/jobs')
        .expect(200)
        .expect(({ body }) => {
          expect(Array.isArray(body.jobs)).toBe(true);
          expect(body.jobs.length).toBeGreaterThan(0);
        });
    });

    it('GET /jobs/:id - should get job details', () => {
      return request(app.getHttpServer())
        .get(`/jobs/${jobId}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.id).toBe(jobId);
          expect(body.title).toBe('Test Job');
        });
    });
  });

  describe('Proposals Endpoints', () => {
    let clientToken: string;
    let artisanToken: string;
    let jobId: string;

    beforeAll(async () => {
      // Register and login a client
      const clientResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Proposal Client',
          email: 'proposal.client@example.com',
          password: 'PropPass123',
          role: 'CLIENT',
        });

      clientToken = clientResponse.body.access_token;

      // Create a job
      const jobResponse = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          title: 'Proposal Test Job',
          description: 'Job for proposal testing',
          budget: 75000,
        });

      jobId = jobResponse.body.id;

      // Register and login an artisan
      const artisanResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Proposal Artisan',
          email: 'proposal.artisan@example.com',
          password: 'ArtPass123',
          role: 'ARTISAN',
        });

      artisanToken = artisanResponse.body.access_token;
    });

    it('POST /proposals - should create a new proposal', () => {
      return request(app.getHttpServer())
        .post('/proposals')
        .set('Authorization', `Bearer ${artisanToken}`)
        .send({
          jobId,
          amount: 75000,
          message: 'I can complete this job professionally and on time.',
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body.jobId).toBe(jobId);
          expect(body.amount).toBe(75000);
          expect(body.status).toBe('PENDING');
        });
    });

    it('GET /proposals - should list proposals', () => {
      return request(app.getHttpServer())
        .get('/proposals')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(Array.isArray(body.proposals)).toBe(true);
        });
    });
  });

  describe('Reviews Endpoints', () => {
    let clientToken: string;
    let artisanToken: string;
    let contractId: string;

    beforeAll(async () => {
      // Register users
      const clientResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Review Client',
          email: 'review.client@example.com',
          password: 'RevPass123',
          role: 'CLIENT',
        });

      const artisanResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Review Artisan',
          email: 'review.artisan@example.com',
          password: 'ArtPass123',
          role: 'ARTISAN',
        });

      clientToken = clientResponse.body.access_token;
      artisanToken = artisanResponse.body.access_token;

      // Create job and contract (simplified for testing)
      const jobResponse = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          title: 'Review Test Job',
          description: 'Job for review testing',
          budget: 100000,
        });

      const jobId = jobResponse.body.id;

      // Create proposal
      const proposalResponse = await request(app.getHttpServer())
        .post('/proposals')
        .set('Authorization', `Bearer ${artisanToken}`)
        .send({
          jobId,
          amount: 100000,
          message: 'Test proposal for review',
        });

      const proposalId = proposalResponse.body.id;

      // Create contract (assuming this endpoint exists)
      const contractResponse = await request(app.getHttpServer())
        .post('/contracts')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          proposalId,
        });

      contractId = contractResponse.body.id;
    });

    it('POST /reviews - should create a new review', () => {
      return request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          contractId,
          rating: 5,
          comment: 'Excellent work! Very professional.',
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body.contractId).toBe(contractId);
          expect(body.rating).toBe(5);
          expect(body.comment).toBe('Excellent work! Very professional.');
        });
    });

    it('GET /reviews - should list reviews', () => {
      return request(app.getHttpServer())
        .get('/reviews')
        .expect(200)
        .expect(({ body }) => {
          expect(Array.isArray(body.reviews)).toBe(true);
        });
    });
  });

  describe('Wallet Endpoints', () => {
    let clientToken: string;
    let clientUserId: string;

    beforeAll(async () => {
      // Register and login a client
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Wallet Client',
          email: 'wallet.client@example.com',
          password: 'WalletPass123',
          role: 'CLIENT',
        });

      clientToken = registerResponse.body.access_token;
      clientUserId = registerResponse.body.user.id;
    });

    it('POST /wallet/create - should create a wallet', () => {
      return request(app.getHttpServer())
        .post('/wallet/create')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(201)
        .expect(({ body }) => {
          expect(body.message).toContain('Wallet created successfully');
          expect(body.data.userId).toBe(clientUserId);
        });
    });

    it('GET /wallet/balance - should get wallet balance', () => {
      return request(app.getHttpServer())
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.balance).toBeDefined();
          expect(body.data.frozen).toBeDefined();
          expect(body.data.available).toBeDefined();
        });
    });

    it('POST /wallet/add-funds - should add funds to wallet', () => {
      return request(app.getHttpServer())
        .post('/wallet/add-funds')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          amount: 100000, // $1000.00 in cents
          reference: 'test-funding',
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.message).toContain('Funds added successfully');
          expect(body.balance).toBe(100000);
        });
    });

    it('GET /wallet/transactions - should get wallet transactions', () => {
      return request(app.getHttpServer())
        .get('/wallet/transactions')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(Array.isArray(body.data.transactions)).toBe(true);
          expect(body.data.pagination).toBeDefined();
        });
    });
  });

  describe('Contracts Endpoints', () => {
    let clientToken: string;
    let artisanToken: string;
    let jobId: string;
    let proposalId: string;

    beforeAll(async () => {
      // Register and login a client
      const clientResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Contract Client',
          email: 'contract.client@example.com',
          password: 'ContractPass123',
          role: 'CLIENT',
        });

      clientToken = clientResponse.body.access_token;

      // Create a job
      const jobResponse = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          title: 'Contract Test Job',
          description: 'Job for contract testing',
          budget: 50000,
        });

      jobId = jobResponse.body.id;

      // Register and login an artisan
      const artisanResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Contract Artisan',
          email: 'contract.artisan@example.com',
          password: 'ArtPass123',
          role: 'ARTISAN',
        });

      artisanToken = artisanResponse.body.access_token;

      // Create a proposal
      const proposalResponse = await request(app.getHttpServer())
        .post('/proposals')
        .set('Authorization', `Bearer ${artisanToken}`)
        .send({
          jobId,
          amount: 50000,
          message: 'I can complete this job professionally.',
        });

      proposalId = proposalResponse.body.id;

      // Accept the proposal (simulate acceptance)
      await request(app.getHttpServer())
        .put(`/proposals/${proposalId}/accept`)
        .set('Authorization', `Bearer ${clientToken}`);
    });

    it('POST /contracts - should create a contract', () => {
      return request(app.getHttpServer())
        .post('/contracts')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          proposalId,
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body.message).toContain('Contract created successfully');
          expect(body.data.proposalId).toBe(proposalId);
          expect(body.data.status).toBe('DRAFT');
        });
    });

    it('GET /contracts - should get user contracts', () => {
      return request(app.getHttpServer())
        .get('/contracts')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(Array.isArray(body.data)).toBe(true);
          expect(body.data.length).toBeGreaterThan(0);
        });
    });
  });

  describe('Payments Endpoints', () => {
    let clientToken: string;
    let contractId: string;

    beforeAll(async () => {
      // Register and login a client
      const clientResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Payment Client',
          email: 'payment.client@example.com',
          password: 'PaymentPass123',
          role: 'CLIENT',
        });

      clientToken = clientResponse.body.access_token;

      // Create wallet and add funds
      await request(app.getHttpServer())
        .post('/wallet/create')
        .set('Authorization', `Bearer ${clientToken}`);

      await request(app.getHttpServer())
        .post('/wallet/add-funds')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          amount: 75000,
          reference: 'payment-test-funds',
        });

      // Create a simple contract for testing
      const contractResponse = await request(app.getHttpServer())
        .post('/contracts')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          proposalId: 'test-proposal-id', // This would need to be a real proposal in a real test
        });

      contractId = contractResponse.body.id || 'test-contract-id';
    });

    it('POST /payments/fund-contract - should fund a contract', () => {
      return request(app.getHttpServer())
        .post(`/payments/fund-contract/${contractId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          amount: 50000,
          paymentMethod: 'wallet',
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.message).toContain('Contract funded successfully');
        });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', () => {
      return request(app.getHttpServer())
        .get('/non-existent-endpoint')
        .expect(404)
        .expect(({ body }) => {
          expect(body.statusCode).toBe(404);
          expect(body.message).toBeDefined();
        });
    });

    it('should return 401 for unauthorized access', () => {
      return request(app.getHttpServer()).get('/jobs/me').expect(401);
    });

    it('should return 400 for validation errors', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: '',
          email: 'invalid-email',
          password: '123', // Too short
        })
        .expect(400)
        .expect(({ body }) => {
          expect(body.statusCode).toBe(400);
          expect(body.message).toBeDefined();
        });
    });
  });

  describe('API Documentation', () => {
    it('GET /api - should serve Swagger documentation', () => {
      return request(app.getHttpServer())
        .get('/api')
        .expect(200)
        .expect('content-type', /text\/html/);
    });

    it('GET /api/openapi.json - should serve OpenAPI spec', () => {
      return request(app.getHttpServer())
        .get('/api/openapi.json')
        .expect(200)
        .expect(({ body }) => {
          expect(body.openapi).toBeDefined();
          expect(body.info.title).toBe('WorkSure API');
          expect(body.paths).toBeDefined();
        });
    });
  });
});

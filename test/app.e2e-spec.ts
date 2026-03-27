import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';
import { setupIsolatedTestDatabase } from './test-database';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let testDatabase: Awaited<ReturnType<typeof setupIsolatedTestDatabase>>;

  beforeAll(async () => {
    testDatabase = await setupIsolatedTestDatabase('app_e2e');
    process.env.DATABASE_URL = testDatabase.databaseUrl;
    const { AppModule } = await import('./../src/app.module');

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

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect(({ body }) => {
        expect(body.project).toBe('Escrow-Based Artisan Marketplace API');
        expect(body.architecture).toBe('Modular Monolith');
        expect(body.modules).toHaveLength(12);
      });
  });

  it('/docs/openapi.json (GET)', () => {
    return request(app.getHttpServer())
      .get('/docs/openapi.json')
      .expect(200)
      .expect(({ body }) => {
        expect(body.info.title).toBe('WorkSure API');
        expect(body.paths['/auth/login']).toBeDefined();
        expect(body.paths['/admin/users']).toBeDefined();
      });
  });
});

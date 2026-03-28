import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

const ROOT_DATABASE_URL = process.env.DATABASE_URL;

function createDatabaseName(label: string) {
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `test_${safeLabel}_${randomUUID().replace(/-/g, '_')}`;
}

function withDatabase(baseUrl: string, databaseName: string) {
  const url = new URL(baseUrl);
  url.pathname = `/${databaseName}`;
  url.searchParams.delete('schema');
  return url.toString();
}

async function createDatabase(baseUrl: string, databaseName: string) {
  const pool = new Pool({
    connectionString: baseUrl,
  });

  try {
    await pool.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await pool.end();
  }
}

async function dropDatabase(baseUrl: string, databaseName: string) {
  const pool = new Pool({
    connectionString: baseUrl,
  });

  try {
    await pool.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1
         AND pid <> pg_backend_pid()`,
      [databaseName],
    );
    await pool.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  } finally {
    await pool.end();
  }
}

async function applyMigrations(databaseUrl: string) {
  const { execSync } = require('child_process');
  
  try {
    // Use Prisma migrate to apply migrations to the test database
    execSync(`npx prisma migrate deploy --skip-generate`, {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit'
    });
  } catch (error) {
    console.error('Failed to apply migrations:', error);
    throw error;
  }
}

export async function setupIsolatedTestDatabase(label: string) {
  const baseUrl = ROOT_DATABASE_URL;

  if (!baseUrl) {
    throw new Error('DATABASE_URL must be configured for e2e tests.');
  }

  const databaseName = createDatabaseName(label);
  const databaseUrl = withDatabase(baseUrl, databaseName);
  await createDatabase(baseUrl, databaseName);
  await applyMigrations(databaseUrl);

  process.env.DATABASE_URL = databaseUrl;
  const { createPrismaClient } =
    await import('../src/database/prisma-client-factory');
  const { prisma, pool } = createPrismaClient(databaseUrl);

  return {
    databaseUrl,
    prisma,
    pool,
    async teardown() {
      await prisma.$disconnect();
      await pool?.end();
      await dropDatabase(baseUrl, databaseName);
    },
  };
}

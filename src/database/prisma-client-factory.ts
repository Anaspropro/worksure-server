import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma';

type PrismaClientWithPool = {
  prisma: PrismaClient;
  pool?: Pool;
};

export function createPrismaAdapter(databaseUrl?: string) {
  const urlObj = databaseUrl ? new URL(databaseUrl) : undefined;
  const schema = urlObj?.searchParams.get('schema') ?? undefined;

  // Fix SSL warning: pg 8.x+ warns if sslmode is in the connection string.
  // We strip it from the URL and configure SSL explicitly.
  const hasSsl =
    urlObj?.searchParams.get('sslmode') === 'require' ||
    urlObj?.searchParams.get('ssl') === 'true';

  if (urlObj) {
    urlObj.searchParams.delete('sslmode');
    urlObj.searchParams.delete('ssl');
  }

  const pool = urlObj
    ? new Pool({
        connectionString: urlObj.toString(),
        options: schema ? `-c search_path=${schema}` : undefined,
        max: 20,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 30_000, // Increased for cloud DB cold starts
        ssl: hasSsl ? { rejectUnauthorized: false } : false,
      })
    : undefined;

  return {
    adapter: pool ? new PrismaPg(pool) : undefined,
    pool,
  };
}

export function createPrismaClient(databaseUrl?: string): PrismaClientWithPool {
  const { adapter, pool } = createPrismaAdapter(databaseUrl);

  const prisma = new PrismaClient({
    adapter,
  });

  return {
    prisma,
    pool,
  };
}

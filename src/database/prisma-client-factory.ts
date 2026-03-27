import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma';

type PrismaClientWithPool = {
  prisma: PrismaClient;
  pool?: Pool;
};

export function createPrismaAdapter(databaseUrl?: string) {
  const parsedUrl = databaseUrl ? new URL(databaseUrl) : undefined;
  const schema = parsedUrl?.searchParams.get('schema') ?? undefined;

  const pool = databaseUrl
    ? new Pool({
        connectionString: databaseUrl,
        options: schema ? `-c search_path=${schema}` : undefined,
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

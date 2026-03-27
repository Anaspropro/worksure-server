import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma';
type PrismaClientWithPool = {
    prisma: PrismaClient;
    pool?: Pool;
};
export declare function createPrismaAdapter(databaseUrl?: string): {
    adapter: PrismaPg | undefined;
    pool: Pool | undefined;
};
export declare function createPrismaClient(databaseUrl?: string): PrismaClientWithPool;
export {};

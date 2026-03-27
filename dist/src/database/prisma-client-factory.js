"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPrismaAdapter = createPrismaAdapter;
exports.createPrismaClient = createPrismaClient;
require("dotenv/config");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const prisma_1 = require("../generated/prisma");
function createPrismaAdapter(databaseUrl) {
    const parsedUrl = databaseUrl ? new URL(databaseUrl) : undefined;
    const schema = parsedUrl?.searchParams.get('schema') ?? undefined;
    const pool = databaseUrl
        ? new pg_1.Pool({
            connectionString: databaseUrl,
            options: schema ? `-c search_path=${schema}` : undefined,
        })
        : undefined;
    return {
        adapter: pool ? new adapter_pg_1.PrismaPg(pool) : undefined,
        pool,
    };
}
function createPrismaClient(databaseUrl) {
    const { adapter, pool } = createPrismaAdapter(databaseUrl);
    const prisma = new prisma_1.PrismaClient({
        adapter,
    });
    return {
        prisma,
        pool,
    };
}
//# sourceMappingURL=prisma-client-factory.js.map
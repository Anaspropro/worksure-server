"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPrismaAdapter = createPrismaAdapter;
exports.createPrismaClient = createPrismaClient;
require("dotenv/config");
var adapter_pg_1 = require("@prisma/adapter-pg");
var pg_1 = require("pg");
var prisma_1 = require("../generated/prisma");
function createPrismaAdapter(databaseUrl) {
    var _a;
    var parsedUrl = databaseUrl ? new URL(databaseUrl) : undefined;
    var schema = (_a = parsedUrl === null || parsedUrl === void 0 ? void 0 : parsedUrl.searchParams.get('schema')) !== null && _a !== void 0 ? _a : undefined;
    var pool = databaseUrl
        ? new pg_1.Pool({
            connectionString: databaseUrl,
            options: schema ? "-c search_path=".concat(schema) : undefined,
        })
        : undefined;
    return {
        adapter: pool ? new adapter_pg_1.PrismaPg(pool) : undefined,
        pool: pool,
    };
}
function createPrismaClient(databaseUrl) {
    var _a = createPrismaAdapter(databaseUrl), adapter = _a.adapter, pool = _a.pool;
    var prisma = new prisma_1.PrismaClient({
        adapter: adapter,
    });
    return {
        prisma: prisma,
        pool: pool,
    };
}

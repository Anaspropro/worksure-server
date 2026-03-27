"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const seed_data_1 = require("./seed-data");
const prisma_client_factory_1 = require("../src/database/prisma-client-factory");
const { prisma, pool } = (0, prisma_client_factory_1.createPrismaClient)(process.env.DATABASE_URL);
async function main() {
    await (0, seed_data_1.seedAdminFixtures)(prisma);
}
main()
    .then(async () => {
    await prisma.$disconnect();
    await pool?.end();
})
    .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await pool?.end();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map
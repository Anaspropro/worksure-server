const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();
async function main() {
  const walletAgg = await prisma.wallet.aggregate({ _sum: { balance: true } });
  const escrowAgg = await prisma.contract.aggregate({
    where: { status: { in: ['FUNDED', 'ACTIVE', 'IN_PROGRESS', 'CLIENT_CONFIRMED', 'READY_FOR_PAYOUT', 'DISPUTED'] } },
    _sum: { amount: true },
  });
  console.log("Wallet:", walletAgg._sum.balance);
  console.log("Escrow:", escrowAgg._sum.amount);
}
main().catch(console.error).finally(() => prisma.$disconnect());

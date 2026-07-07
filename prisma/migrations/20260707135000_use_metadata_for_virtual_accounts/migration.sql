-- AlterTable
ALTER TABLE "LedgerAccount" ADD COLUMN "metadata" JSONB;

-- DropTable
DROP TABLE "VirtualAccount";

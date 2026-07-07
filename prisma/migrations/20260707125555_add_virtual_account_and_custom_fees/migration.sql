-- AlterEnum
ALTER TYPE "TransactionStatus" ADD VALUE 'PROCESSING';

-- DropIndex
DROP INDEX "LedgerAccount_userId_idx";

-- DropIndex
DROP INDEX "Review_contractId_idx";

-- DropIndex
DROP INDEX "Transaction_reference_idx";

-- DropIndex
DROP INDEX "VerificationToken_token_idx";

-- AlterTable
ALTER TABLE "ArtisanProfile" ADD COLUMN     "platformFeePercent" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "VirtualAccount" (
    "id" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "bankName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VirtualAccount_ledgerAccountId_key" ON "VirtualAccount"("ledgerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualAccount_accountNumber_key" ON "VirtualAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "ArtisanProfile_skills_idx" ON "ArtisanProfile" USING GIN ("skills");

-- CreateIndex
CREATE INDEX "Job_title_description_idx" ON "Job"("title", "description");

-- CreateIndex
CREATE INDEX "Job_requiredSkills_idx" ON "Job" USING GIN ("requiredSkills");

-- CreateIndex
CREATE INDEX "Transaction_metadata_idx" ON "Transaction" USING GIN ("metadata");

-- AddForeignKey
ALTER TABLE "VirtualAccount" ADD CONSTRAINT "VirtualAccount_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - A unique constraint covering the columns `[contractId]` on the table `Job` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionStatus" ADD VALUE 'PENDING';
ALTER TYPE "TransactionStatus" ADD VALUE 'FAILED';

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'ESCROW_RELEASE';

-- DropIndex
DROP INDEX "Dispute_jobId_key";

-- AlterTable
ALTER TABLE "Dispute" ALTER COLUMN "contractId" DROP NOT NULL,
ALTER COLUMN "jobId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "budget" INTEGER,
ADD COLUMN     "description" TEXT,
ALTER COLUMN "contractId" DROP NOT NULL,
ALTER COLUMN "artisanId" DROP NOT NULL,
ALTER COLUMN "amount" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "metadata" JSONB,
ALTER COLUMN "status" SET DEFAULT 'PENDING',
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "ArtisanProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "skills" JSONB NOT NULL DEFAULT '[]',
    "experience" TEXT,
    "portfolio" JSONB NOT NULL DEFAULT '[]',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtisanProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "fundedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "clientConfirmedCompletion" BOOLEAN NOT NULL DEFAULT false,
    "clientConfirmedAt" TIMESTAMP(3),
    "artisanConfirmedCompletion" BOOLEAN NOT NULL DEFAULT false,
    "artisanConfirmedAt" TIMESTAMP(3),
    "escrowReleased" BOOLEAN NOT NULL DEFAULT false,
    "escrowReleasedAt" TIMESTAMP(3),
    "platformFeeDeducted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "frozen" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArtisanProfile_userId_key" ON "ArtisanProfile"("userId");

-- CreateIndex
CREATE INDEX "ArtisanProfile_verified_rating_idx" ON "ArtisanProfile"("verified", "rating");

-- CreateIndex
CREATE INDEX "Proposal_jobId_status_idx" ON "Proposal"("jobId", "status");

-- CreateIndex
CREATE INDEX "Proposal_artisanId_status_idx" ON "Proposal"("artisanId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_jobId_artisanId_key" ON "Proposal"("jobId", "artisanId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_jobId_key" ON "Contract"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_proposalId_key" ON "Contract"("proposalId");

-- CreateIndex
CREATE INDEX "Contract_clientId_status_idx" ON "Contract"("clientId", "status");

-- CreateIndex
CREATE INDEX "Contract_artisanId_status_idx" ON "Contract"("artisanId", "status");

-- CreateIndex
CREATE INDEX "Contract_status_activatedAt_idx" ON "Contract"("status", "activatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_contractId_key" ON "Review"("contractId");

-- CreateIndex
CREATE INDEX "Review_artisanId_rating_idx" ON "Review"("artisanId", "rating");

-- CreateIndex
CREATE INDEX "Review_contractId_idx" ON "Review"("contractId");

-- CreateIndex
CREATE INDEX "Dispute_clientId_status_idx" ON "Dispute"("clientId", "status");

-- CreateIndex
CREATE INDEX "Dispute_artisanId_status_idx" ON "Dispute"("artisanId", "status");

-- CreateIndex
CREATE INDEX "Dispute_contractId_idx" ON "Dispute"("contractId");

-- CreateIndex
CREATE INDEX "Dispute_jobId_idx" ON "Dispute"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_contractId_key" ON "Job"("contractId");

-- CreateIndex
CREATE INDEX "Job_clientId_status_idx" ON "Job"("clientId", "status");

-- CreateIndex
CREATE INDEX "Job_artisanId_status_idx" ON "Job"("artisanId", "status");

-- CreateIndex
CREATE INDEX "Transaction_type_status_idx" ON "Transaction"("type", "status");

-- CreateIndex
CREATE INDEX "Transaction_reference_idx" ON "Transaction"("reference");

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtisanProfile" ADD CONSTRAINT "ArtisanProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT';
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'FUNDED';
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'CLIENT_CONFIRMED';
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_PAYOUT';
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'PAID_OUT';
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'PAYMENT';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'TRANSFER';

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "paystackRecipientCode" TEXT,
ADD COLUMN "payoutBankCode" TEXT,
ADD COLUMN "payoutAccountNumber" TEXT,
ADD COLUMN "payoutAccountName" TEXT;

-- AlterTable
ALTER TABLE "Contract"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN "paystackReference" TEXT,
ADD COLUMN "paystackAuthorizationUrl" TEXT,
ADD COLUMN "paystackAccessCode" TEXT,
ADD COLUMN "fundedPaymentId" TEXT,
ADD COLUMN "payoutRequestedAt" TIMESTAMP(3),
ADD COLUMN "paidOutAt" TIMESTAMP(3),
ADD COLUMN "refundedAt" TIMESTAMP(3),
ADD COLUMN "refundReason" TEXT,
ADD COLUMN "payoutFailureReason" TEXT;

-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN "gateway" TEXT,
ADD COLUMN "paystackAccessCode" TEXT,
ADD COLUMN "paystackAuthorizationUrl" TEXT,
ADD COLUMN "paystackTransactionId" TEXT,
ADD COLUMN "recipientCode" TEXT,
ADD COLUMN "transferCode" TEXT,
ADD COLUMN "metadata" JSONB,
ADD COLUMN "failureReason" TEXT,
ADD COLUMN "refundedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Review"
ADD COLUMN "categories" JSONB,
ADD COLUMN "workQuality" INTEGER,
ADD COLUMN "communication" INTEGER,
ADD COLUMN "timeliness" INTEGER,
ADD COLUMN "professionalism" INTEGER,
ADD COLUMN "evidence" JSONB,
ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "type" TEXT NOT NULL DEFAULT 'system_update',
ADD COLUMN "entityId" TEXT,
ADD COLUMN "entityType" TEXT,
ADD COLUMN "actionUrl" TEXT,
ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "metadata" JSONB,
ADD COLUMN "readAt" TIMESTAMP(3),
ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Contract_paystackReference_key" ON "Contract"("paystackReference");

-- CreateIndex
CREATE INDEX "Notification_userId_type_createdAt_idx" ON "Notification"("userId", "type", "createdAt");

-- AlterTable
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Job_deletedAt_idx" ON "Job"("deletedAt");

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Contract_deletedAt_idx" ON "Contract"("deletedAt");

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Proposal_deletedAt_idx" ON "Proposal"("deletedAt");

-- AlterTable
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Review_deletedAt_idx" ON "Review"("deletedAt");

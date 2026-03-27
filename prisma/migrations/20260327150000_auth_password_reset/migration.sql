-- AlterTable
ALTER TABLE "User"
ADD COLUMN "passwordResetRequestedAt" TIMESTAMP(3),
ADD COLUMN "passwordResetTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "passwordResetTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetTokenHash_key" ON "User"("passwordResetTokenHash");

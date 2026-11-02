-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AdminRole" AS ENUM (
        'SUPER_ADMIN',
        'OPERATIONS_MANAGER',
        'FINANCE_ADMIN',
        'DISPUTE_ADMIN',
        'VERIFICATION_ADMIN',
        'SUPPORT_ADMIN',
        'CONTENT_MODERATOR',
        'ANALYTICS_ADMIN'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminRoles" "AdminRole"[] DEFAULT ARRAY[]::"AdminRole"[];


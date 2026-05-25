ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'CONTRACT';

CREATE TYPE "FinancialEventType" AS ENUM (
  'FUND_REQUESTED',
  'FUND_CONFIRMED',
  'RELEASE_REQUESTED',
  'RELEASE_CONFIRMED',
  'REFUND_REQUESTED',
  'REFUND_CONFIRMED'
);

CREATE TABLE "FinancialEvent" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "type" "FinancialEventType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "actorId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FinancialEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialEvent_contractId_createdAt_idx" ON "FinancialEvent"("contractId", "createdAt");
CREATE INDEX "FinancialEvent_type_createdAt_idx" ON "FinancialEvent"("type", "createdAt");

ALTER TABLE "FinancialEvent"
ADD CONSTRAINT "FinancialEvent_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "Contract"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

WITH ranked_keys AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "namespace", "key"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS row_number
  FROM "IdempotencyKey"
)
DELETE FROM "IdempotencyKey"
WHERE "id" IN (
  SELECT "id"
  FROM ranked_keys
  WHERE row_number > 1
);

DROP INDEX IF EXISTS "IdempotencyKey_key_key";
DROP INDEX IF EXISTS "IdempotencyKey_namespace_key_idx";
CREATE UNIQUE INDEX "IdempotencyKey_namespace_key_key" ON "IdempotencyKey"("namespace", "key");

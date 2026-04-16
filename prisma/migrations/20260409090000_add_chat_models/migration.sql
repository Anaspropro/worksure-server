CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE');

CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "fileUrl" TEXT,
    "fileType" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Conversation_contractId_key" ON "Conversation"("contractId");
CREATE INDEX "Conversation_clientId_updatedAt_idx" ON "Conversation"("clientId", "updatedAt");
CREATE INDEX "Conversation_artisanId_updatedAt_idx" ON "Conversation"("artisanId", "updatedAt");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");

ALTER TABLE "Conversation"
ADD CONSTRAINT "Conversation_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
ADD CONSTRAINT "Message_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

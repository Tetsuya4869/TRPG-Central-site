-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN "combatJson" TEXT;

-- CreateTable
CREATE TABLE "SessionChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionChatMessage_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionChatMessage_gameSessionId_seq_key" ON "SessionChatMessage"("gameSessionId", "seq");


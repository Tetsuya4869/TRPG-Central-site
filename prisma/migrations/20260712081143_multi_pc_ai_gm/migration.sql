-- AlterTable
ALTER TABLE "DiceRoll" ADD COLUMN "characterId" TEXT;
ALTER TABLE "DiceRoll" ADD COLUMN "characterName" TEXT;
ALTER TABLE "DiceRoll" ADD COLUMN "sanAfter" INTEGER;

-- CreateTable
CREATE TABLE "AiGmSessionMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aiGmSessionId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "stateJson" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "AiGmSessionMember_aiGmSessionId_fkey" FOREIGN KEY ("aiGmSessionId") REFERENCES "AiGmSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiGmSessionMember_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Backfill: 既存の1人用セッションを1メンバーのパーティとして移行する
-- (この後の RedefineTables で AiGmSession.characterId / stateJson が削除されるため、必ずこの位置で実行)
INSERT INTO "AiGmSessionMember" ("id", "aiGmSessionId", "characterId", "stateJson", "position")
SELECT lower(hex(randomblob(16))), "id", "characterId", "stateJson", 0 FROM "AiGmSession";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiGmSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "scenarioId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ONGOING',
    "growthAppliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiGmSession_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AiGmSession" ("createdAt", "growthAppliedAt", "id", "scenario", "scenarioId", "status", "title", "updatedAt") SELECT "createdAt", "growthAppliedAt", "id", "scenario", "scenarioId", "status", "title", "updatedAt" FROM "AiGmSession";
DROP TABLE "AiGmSession";
ALTER TABLE "new_AiGmSession" RENAME TO "AiGmSession";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AiGmSessionMember_aiGmSessionId_characterId_key" ON "AiGmSessionMember"("aiGmSessionId", "characterId");


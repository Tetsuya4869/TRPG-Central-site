-- AlterTable
ALTER TABLE "Character" ADD COLUMN "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "DiceRoll" ADD COLUMN "skillName" TEXT;

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "tags" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiGmSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "scenarioId" TEXT,
    "characterId" TEXT NOT NULL,
    "stateJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ONGOING',
    "growthAppliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiGmSession_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiGmSession_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AiGmSession" ("characterId", "createdAt", "id", "scenario", "stateJson", "status", "title", "updatedAt") SELECT "characterId", "createdAt", "id", "scenario", "stateJson", "status", "title", "updatedAt" FROM "AiGmSession";
DROP TABLE "AiGmSession";
ALTER TABLE "new_AiGmSession" RENAME TO "AiGmSession";
CREATE TABLE "new_GameSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "scenarioName" TEXT,
    "scenarioId" TEXT,
    "scheduledAt" DATETIME,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECRUITING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GameSession_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GameSession" ("createdAt", "id", "notes", "scenarioName", "scheduledAt", "status", "title", "updatedAt") SELECT "createdAt", "id", "notes", "scenarioName", "scheduledAt", "status", "title", "updatedAt" FROM "GameSession";
DROP TABLE "GameSession";
ALTER TABLE "new_GameSession" RENAME TO "GameSession";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

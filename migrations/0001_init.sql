-- TRPG Central 初期スキーマ (prisma/migrations を空DBに適用した最終形のダンプ)

CREATE TABLE "AiGmSession" (
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

CREATE TABLE "AiGmSessionMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aiGmSessionId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "stateJson" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "AiGmSessionMember_aiGmSessionId_fkey" FOREIGN KEY ("aiGmSessionId") REFERENCES "AiGmSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiGmSessionMember_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "edition" TEXT NOT NULL DEFAULT '6',
    "name" TEXT NOT NULL,
    "playerName" TEXT,
    "occupation" TEXT,
    "age" INTEGER,
    "sex" TEXT,
    "imageUrl" TEXT,
    "luck" INTEGER,
    "str" INTEGER NOT NULL,
    "con" INTEGER NOT NULL,
    "pow" INTEGER NOT NULL,
    "dex" INTEGER NOT NULL,
    "app" INTEGER NOT NULL,
    "siz" INTEGER NOT NULL,
    "int" INTEGER NOT NULL,
    "edu" INTEGER NOT NULL,
    "currentHp" INTEGER NOT NULL,
    "currentMp" INTEGER NOT NULL,
    "currentSan" INTEGER NOT NULL,
    "skillsJson" TEXT NOT NULL DEFAULT '{}',
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aiGmSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_aiGmSessionId_fkey" FOREIGN KEY ("aiGmSessionId") REFERENCES "AiGmSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DiceRoll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expression" TEXT NOT NULL,
    "rolls" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "target" INTEGER,
    "outcome" TEXT,
    "context" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "aiGmSessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "skillName" TEXT, "characterId" TEXT, "characterName" TEXT, "sanAfter" INTEGER,
    CONSTRAINT "DiceRoll_aiGmSessionId_fkey" FOREIGN KEY ("aiGmSessionId") REFERENCES "AiGmSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "scenarioName" TEXT,
    "scenarioId" TEXT,
    "scheduledAt" DATETIME,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECRUITING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL, "combatJson" TEXT,
    CONSTRAINT "GameSession_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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

CREATE TABLE "ScenarioAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScenarioAsset_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SessionCharacter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    CONSTRAINT "SessionCharacter_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SessionChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionChatMessage_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AiGmSessionMember_aiGmSessionId_characterId_key" ON "AiGmSessionMember"("aiGmSessionId", "characterId");

CREATE UNIQUE INDEX "ChatMessage_aiGmSessionId_seq_key" ON "ChatMessage"("aiGmSessionId", "seq");

CREATE UNIQUE INDEX "SessionCharacter_sessionId_characterId_key" ON "SessionCharacter"("sessionId", "characterId");

CREATE UNIQUE INDEX "SessionChatMessage_gameSessionId_seq_key" ON "SessionChatMessage"("gameSessionId", "seq");

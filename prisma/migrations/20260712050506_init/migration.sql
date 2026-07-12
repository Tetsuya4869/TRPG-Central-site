-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "playerName" TEXT,
    "occupation" TEXT,
    "age" INTEGER,
    "sex" TEXT,
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

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "scenarioName" TEXT,
    "scheduledAt" DATETIME,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECRUITING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SessionCharacter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    CONSTRAINT "SessionCharacter_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiceRoll_aiGmSessionId_fkey" FOREIGN KEY ("aiGmSessionId") REFERENCES "AiGmSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiGmSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "stateJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ONGOING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiGmSession_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aiGmSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_aiGmSessionId_fkey" FOREIGN KEY ("aiGmSessionId") REFERENCES "AiGmSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionCharacter_sessionId_characterId_key" ON "SessionCharacter"("sessionId", "characterId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_aiGmSessionId_seq_key" ON "ChatMessage"("aiGmSessionId", "seq");

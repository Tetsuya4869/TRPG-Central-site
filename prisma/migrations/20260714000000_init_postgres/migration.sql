-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
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
    "weaponsJson" TEXT NOT NULL DEFAULT '[]',
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scenarioName" TEXT,
    "scenarioId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECRUITING',
    "combatJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionLog" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'EVENT',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionChatMessage" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "tags" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioAsset" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionCharacter" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,

    CONSTRAINT "SessionCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiceRoll" (
    "id" TEXT NOT NULL,
    "expression" TEXT NOT NULL,
    "rolls" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "target" INTEGER,
    "outcome" TEXT,
    "context" TEXT,
    "skillName" TEXT,
    "characterId" TEXT,
    "characterName" TEXT,
    "sanAfter" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "gameSessionId" TEXT,
    "aiGmSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiceRoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiGmSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "scenarioId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ONGOING',
    "growthAppliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiGmSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiGmSessionMember" (
    "id" TEXT NOT NULL,
    "aiGmSessionId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "stateJson" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "AiGmSessionMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "aiGmSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionChatMessage_gameSessionId_seq_key" ON "SessionChatMessage"("gameSessionId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "SessionCharacter_sessionId_characterId_key" ON "SessionCharacter"("sessionId", "characterId");

-- CreateIndex
CREATE UNIQUE INDEX "AiGmSessionMember_aiGmSessionId_characterId_key" ON "AiGmSessionMember"("aiGmSessionId", "characterId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_aiGmSessionId_seq_key" ON "ChatMessage"("aiGmSessionId", "seq");

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionLog" ADD CONSTRAINT "SessionLog_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionChatMessage" ADD CONSTRAINT "SessionChatMessage_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioAsset" ADD CONSTRAINT "ScenarioAsset_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCharacter" ADD CONSTRAINT "SessionCharacter_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCharacter" ADD CONSTRAINT "SessionCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiceRoll" ADD CONSTRAINT "DiceRoll_aiGmSessionId_fkey" FOREIGN KEY ("aiGmSessionId") REFERENCES "AiGmSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGmSession" ADD CONSTRAINT "AiGmSession_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGmSessionMember" ADD CONSTRAINT "AiGmSessionMember_aiGmSessionId_fkey" FOREIGN KEY ("aiGmSessionId") REFERENCES "AiGmSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGmSessionMember" ADD CONSTRAINT "AiGmSessionMember_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_aiGmSessionId_fkey" FOREIGN KEY ("aiGmSessionId") REFERENCES "AiGmSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;


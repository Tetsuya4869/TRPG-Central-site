import { prisma } from "@/lib/prisma";

// 全データのJSONバックアップ。ローカル運用でのデータ退避用。
export async function GET() {
  const [
    characters,
    scenarios,
    scenarioAssets,
    gameSessions,
    sessionCharacters,
    sessionChatMessages,
    aiGmSessions,
    aiGmSessionMembers,
    chatMessages,
    diceRolls,
  ] = await Promise.all([
    prisma.character.findMany(),
    prisma.scenario.findMany(),
    prisma.scenarioAsset.findMany(),
    prisma.gameSession.findMany(),
    prisma.sessionCharacter.findMany(),
    prisma.sessionChatMessage.findMany(),
    prisma.aiGmSession.findMany(),
    prisma.aiGmSessionMember.findMany(),
    prisma.chatMessage.findMany(),
    prisma.diceRoll.findMany(),
  ]);

  const backup = {
    app: "trpg-central",
    version: 2, // v2: scenarioAssets / sessionChatMessages を追加
    exportedAt: new Date().toISOString(),
    data: {
      characters,
      scenarios,
      scenarioAssets,
      gameSessions,
      sessionCharacters,
      sessionChatMessages,
      aiGmSessions,
      aiGmSessionMembers,
      chatMessages,
      diceRolls,
    },
  };

  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="trpg-central-backup-${date}.json"`,
    },
  });
}

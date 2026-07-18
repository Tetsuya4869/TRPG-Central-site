import { prisma } from "@/lib/prisma";
import {
  collectImageUrls,
  contentTypeForFilename,
  uploadFilenameFromUrl,
  MAX_EMBED_TOTAL,
  type BackupImageEntry,
} from "@/lib/backup-images";
import { readUpload } from "@/lib/upload-storage";

export const runtime = "nodejs";

// 全データのJSONバックアップ。ローカル運用でのデータ退避用。
// v3: 卓ログ (sessionLogs) と画像 (立ち絵・資料画像のbase64) を同梱する。
export async function GET() {
  const [
    characters,
    scenarios,
    scenarioAssets,
    gameSessions,
    sessionCharacters,
    sessionChatMessages,
    sessionLogs,
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
    prisma.sessionLog.findMany(),
    prisma.aiGmSession.findMany(),
    prisma.aiGmSessionMember.findMany(),
    prisma.chatMessage.findMany(),
    prisma.diceRoll.findMany(),
  ]);

  // 画像の同梱 (ベストエフォート): 読めない画像はスキップしてバックアップ自体は成功させる
  const images: Record<string, BackupImageEntry> = {};
  const imagesSkipped: string[] = [];
  let embedded = 0;
  for (const url of collectImageUrls(characters, scenarioAssets)) {
    const filename = uploadFilenameFromUrl(url);
    const contentType = filename ? contentTypeForFilename(filename) : null;
    if (!filename || !contentType) {
      imagesSkipped.push(url);
      continue;
    }
    if (embedded >= MAX_EMBED_TOTAL) {
      imagesSkipped.push(url);
      continue;
    }
    const bytes = await readUpload(url);
    if (!bytes || embedded + bytes.length > MAX_EMBED_TOTAL) {
      imagesSkipped.push(url);
      continue;
    }
    embedded += bytes.length;
    images[url] = { contentType, base64: bytes.toString("base64") };
  }

  const backup = {
    app: "trpg-central",
    version: 3, // v3: sessionLogs / images を追加 (v2: scenarioAssets / sessionChatMessages)
    exportedAt: new Date().toISOString(),
    data: {
      characters,
      scenarios,
      scenarioAssets,
      gameSessions,
      sessionCharacters,
      sessionChatMessages,
      sessionLogs,
      aiGmSessions,
      aiGmSessionMembers,
      chatMessages,
      diceRolls,
    },
    images,
    imagesSkipped,
  };

  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="trpg-central-backup-${date}.json"`,
    },
  });
}

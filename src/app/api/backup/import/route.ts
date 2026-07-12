// バックアップJSONからの全データ復元。既存データはすべて置き換えられる(UI側で確認済み)。
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

// 各行はPrismaのcreateManyにそのまま渡す。厳密な列検証はDB制約に任せ、
// ここでは「バックアップファイルとしての形」だけを検証する。
const rowsSchema = z.array(z.record(z.string(), z.unknown())).max(100000);

const backupSchema = z.object({
  app: z.literal("trpg-central"),
  version: z.union([z.literal(1), z.literal(2)]),
  data: z.object({
    characters: rowsSchema,
    scenarios: rowsSchema,
    scenarioAssets: rowsSchema.optional(), // v2から
    gameSessions: rowsSchema,
    sessionCharacters: rowsSchema,
    sessionChatMessages: rowsSchema.optional(), // v2から
    aiGmSessions: rowsSchema,
    aiGmSessionMembers: rowsSchema.optional(), // v1でも複数PC化以降は存在
    chatMessages: rowsSchema,
    diceRolls: rowsSchema,
  }),
});

export async function POST(req: NextRequest) {
  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_SIZE) {
    return NextResponse.json(
      { error: "バックアップファイルが大きすぎます (50MBまで)" },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONとして読み込めません" }, { status: 400 });
  }
  const parsed = backupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "TRPG Centralのバックアップファイルではありません" },
      { status: 400 },
    );
  }
  const { data } = parsed.data;

  // v1互換: 複数PC化前のバックアップは aiGmSessions に characterId/stateJson を持ち
  // aiGmSessionMembers が無い。メンバー行に変換して取り込む。
  let aiGmSessions = data.aiGmSessions;
  let aiGmSessionMembers = data.aiGmSessionMembers ?? [];
  const isLegacy =
    aiGmSessionMembers.length === 0 &&
    aiGmSessions.some((r) => "characterId" in r);
  if (isLegacy) {
    aiGmSessionMembers = aiGmSessions
      .filter((r) => r.characterId)
      .map((r) => ({
        id: `legacy-${String(r.id)}`,
        aiGmSessionId: r.id,
        characterId: r.characterId,
        stateJson: r.stateJson ?? "{}",
        position: 0,
      }));
  }
  // 現行スキーマに無いカラムを落とす (v1のcharacterId/stateJson)
  aiGmSessions = aiGmSessions.map((r) => {
    const rest = { ...r };
    delete rest.characterId;
    delete rest.stateJson;
    return rest;
  });

  /* eslint-disable @typescript-eslint/no-explicit-any -- 行データはDB制約とcreateManyの検証に委ねる */
  try {
    await prisma.$transaction([
      // 依存の深い順に全削除
      prisma.chatMessage.deleteMany(),
      prisma.sessionChatMessage.deleteMany(),
      prisma.diceRoll.deleteMany(),
      prisma.aiGmSessionMember.deleteMany(),
      prisma.aiGmSession.deleteMany(),
      prisma.sessionCharacter.deleteMany(),
      prisma.gameSession.deleteMany(),
      prisma.scenarioAsset.deleteMany(),
      prisma.scenario.deleteMany(),
      prisma.character.deleteMany(),
      // 親から順に復元 (id/日時はバックアップの値をそのまま使う)
      prisma.character.createMany({ data: data.characters as any }),
      prisma.scenario.createMany({ data: data.scenarios as any }),
      prisma.scenarioAsset.createMany({ data: (data.scenarioAssets ?? []) as any }),
      prisma.gameSession.createMany({ data: data.gameSessions as any }),
      prisma.sessionCharacter.createMany({ data: data.sessionCharacters as any }),
      prisma.sessionChatMessage.createMany({
        data: (data.sessionChatMessages ?? []) as any,
      }),
      prisma.aiGmSession.createMany({ data: aiGmSessions as any }),
      prisma.aiGmSessionMember.createMany({ data: aiGmSessionMembers as any }),
      prisma.chatMessage.createMany({ data: data.chatMessages as any }),
      prisma.diceRoll.createMany({ data: data.diceRolls as any }),
    ]);
  } catch (e) {
    // トランザクションなので失敗時は元のデータが残る。
    // DB内部情報 (列名・制約名) を含む生のエラーはログのみに出す
    console.error("バックアップ復元に失敗:", e);
    return NextResponse.json(
      {
        error:
          "復元に失敗しました (データは変更されていません)。バックアップファイルの内容がスキーマと一致しない可能性があります",
      },
      { status: 400 },
    );
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return NextResponse.json({
    ok: true,
    restored: {
      characters: data.characters.length,
      scenarios: data.scenarios.length,
      gameSessions: data.gameSessions.length,
      aiGmSessions: data.aiGmSessions.length,
      diceRolls: data.diceRolls.length,
    },
  });
}

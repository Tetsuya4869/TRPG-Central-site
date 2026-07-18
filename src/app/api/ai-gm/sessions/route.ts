import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deriveStatsFor } from "@/lib/coc";
import { skillsSchema, type AiGmState, type StatBlock } from "@/lib/coc6/types";
import { hasApiKey } from "@/lib/ai-gm/client";
import type { Character } from "@prisma/client";

const createSchema = z.object({
  title: z.string().min(1, "タイトルは必須です").max(200),
  scenario: z.string().min(1, "シナリオ導入は必須です").max(50000),
  characterIds: z
    .array(z.string().min(1))
    .min(1, "探索者を1人以上選択してください")
    .max(4, "探索者は最大4人までです")
    .refine((ids) => new Set(ids).size === ids.length, "探索者が重複しています"),
  scenarioId: z.string().optional().nullable(),
  // キャンペーン続編: 前セッションIDを指定するとメンバー最終状態(HP/MP/SAN/幸運)を引き継ぐ。
  // summaryText はユーザーが編集した「前回のあらすじ」(APIキー無しでも手書きで続編可)
  previousSessionId: z.string().optional().nullable(),
  summaryText: z.string().max(5000).optional().nullable(),
});

function initialState(character: Character): AiGmState {
  const stats: StatBlock = {
    str: character.str,
    con: character.con,
    pow: character.pow,
    dex: character.dex,
    app: character.app,
    siz: character.siz,
    int_: character.int_,
    edu: character.edu,
  };
  const skills = skillsSchema.catch({}).parse(JSON.parse(character.skillsJson));
  const derived = deriveStatsFor(
    character.edition === "7" ? "7" : "6",
    stats,
    skills["クトゥルフ神話"] ?? 0,
  );
  return {
    hp: character.currentHp,
    maxHp: derived.hp,
    mp: character.currentMp,
    maxMp: derived.mp,
    san: character.currentSan,
    maxSan: derived.maxSan,
    // 7版のみ: 幸運消費 (spend_luck) 用に現在幸運をセッション状態で管理する
    ...(character.edition === "7" && { luck: character.luck ?? 0 }),
  };
}

export async function GET() {
  const sessions = await prisma.aiGmSession.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      members: {
        orderBy: { position: "asc" },
        include: {
          character: { select: { id: true, name: true, imageUrl: true } },
        },
      },
    },
  });
  return NextResponse.json({ sessions, apiKeyConfigured: hasApiKey() });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 },
    );
  }
  const characters = await prisma.character.findMany({
    where: { id: { in: parsed.data.characterIds }, deletedAt: null },
  });
  if (characters.length !== parsed.data.characterIds.length) {
    // 続編作成はメンバーIDを前セッションから自動で引き継ぐため、
    // ゴミ箱行きの探索者が混ざっていても残りのメンバーで続行する
    if (parsed.data.previousSessionId && characters.length > 0) {
      // 元の並び順 (前セッションのposition順) を保ったまま欠員だけ除く
      parsed.data.characterIds = parsed.data.characterIds.filter((id) =>
        characters.some((c) => c.id === id),
      );
    } else {
      return NextResponse.json(
        {
          error: parsed.data.previousSessionId
            ? "前回のメンバーが全員ゴミ箱にあります。ゴミ箱から復元してから続編を作成してください"
            : "探索者が見つかりません (ゴミ箱にある探索者は選べません)",
        },
        { status: 404 },
      );
    }
  }
  // 判定ルールが版で異なるため、パーティは同一版のみ
  const editions = new Set(characters.map((c) => c.edition));
  if (editions.size > 1) {
    return NextResponse.json(
      { error: "6版と7版の探索者を同じセッションに混在させることはできません" },
      { status: 400 },
    );
  }

  // ライブラリシナリオの紐付けは任意。存在しないIDは黙って無視する
  let scenarioId: string | null = null;
  let scenarioText = parsed.data.scenario;
  if (parsed.data.scenarioId) {
    const scenarioRef = await prisma.scenario.findUnique({
      where: { id: parsed.data.scenarioId },
      select: {
        id: true,
        assets: {
          where: { kind: "NPC" },
          orderBy: { position: "asc" },
          select: { name: true, content: true },
        },
      },
    });
    scenarioId = scenarioRef?.id ?? null;
    // NPC資料はキーパー用情報としてスナップショットに連結する
    // (ハンドアウトはプレイヤー向け資料なのでAIには渡さない)
    if (scenarioRef && scenarioRef.assets.length > 0) {
      const npcSection = scenarioRef.assets
        .map((a) => `### ${a.name}\n${a.content}`)
        .join("\n\n");
      scenarioText += `\n\n## 追加NPC資料\n${npcSection}`;
    }
  }

  // キャンペーン続編: 前セッションのメンバー最終状態を引き継ぐ
  let previousSessionId: string | null = null;
  const carriedStates = new Map<string, string>(); // characterId → stateJson
  if (parsed.data.previousSessionId) {
    const prev = await prisma.aiGmSession.findUnique({
      where: { id: parsed.data.previousSessionId },
      include: { members: true },
    });
    if (!prev) {
      return NextResponse.json(
        { error: "続編元のセッションが見つかりません" },
        { status: 404 },
      );
    }
    previousSessionId = prev.id;
    for (const m of prev.members) carriedStates.set(m.characterId, m.stateJson);
  }
  // あらすじをシナリオ末尾へ連結 (キーパーが前回の展開を把握できる)
  const summaryText = parsed.data.summaryText?.trim();
  if (summaryText) {
    scenarioText += `\n\n## 前回のあらすじ\n${summaryText}`;
  }

  // 選択順を保持してポジションを振る
  const ordered = parsed.data.characterIds.map(
    (id) => characters.find((c) => c.id === id)!,
  );
  const session = await prisma.aiGmSession.create({
    data: {
      title: parsed.data.title,
      scenario: scenarioText,
      scenarioId,
      previousSessionId,
      members: {
        create: ordered.map((character, position) => ({
          characterId: character.id,
          // 続編で前セッションにも居た探索者は最終状態を継続、新規参加は初期状態
          stateJson:
            carriedStates.get(character.id) ??
            JSON.stringify(initialState(character)),
          position,
        })),
      },
    },
  });
  return NextResponse.json(session, { status: 201 });
}

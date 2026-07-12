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
    where: { id: { in: parsed.data.characterIds } },
  });
  if (characters.length !== parsed.data.characterIds.length) {
    return NextResponse.json({ error: "探索者が見つかりません" }, { status: 404 });
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
  if (parsed.data.scenarioId) {
    const scenarioRef = await prisma.scenario.findUnique({
      where: { id: parsed.data.scenarioId },
      select: { id: true },
    });
    scenarioId = scenarioRef?.id ?? null;
  }

  // 選択順を保持してポジションを振る
  const ordered = parsed.data.characterIds.map(
    (id) => characters.find((c) => c.id === id)!,
  );
  const session = await prisma.aiGmSession.create({
    data: {
      title: parsed.data.title,
      scenario: parsed.data.scenario,
      scenarioId,
      members: {
        create: ordered.map((character, position) => ({
          characterId: character.id,
          stateJson: JSON.stringify(initialState(character)),
          position,
        })),
      },
    },
  });
  return NextResponse.json(session, { status: 201 });
}

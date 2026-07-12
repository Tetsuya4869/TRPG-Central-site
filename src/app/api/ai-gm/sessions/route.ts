import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deriveStats } from "@/lib/coc6/stats";
import { skillsSchema, type AiGmState, type StatBlock } from "@/lib/coc6/types";
import { hasApiKey } from "@/lib/ai-gm/client";

const createSchema = z.object({
  title: z.string().min(1, "タイトルは必須です").max(200),
  scenario: z.string().min(1, "シナリオ導入は必須です").max(50000),
  characterId: z.string().min(1, "探索者を選択してください"),
  scenarioId: z.string().optional().nullable(),
});

export async function GET() {
  const sessions = await prisma.aiGmSession.findMany({
    orderBy: { updatedAt: "desc" },
    include: { character: { select: { id: true, name: true } } },
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
  const character = await prisma.character.findUnique({
    where: { id: parsed.data.characterId },
  });
  if (!character) {
    return NextResponse.json({ error: "探索者が見つかりません" }, { status: 404 });
  }

  // プレイ中の状態はマスターシートのスナップショットとして保持
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
  const derived = deriveStats(stats, skills["クトゥルフ神話"] ?? 0);
  const state: AiGmState = {
    hp: character.currentHp,
    maxHp: derived.hp,
    mp: character.currentMp,
    maxMp: derived.mp,
    san: character.currentSan,
    maxSan: derived.maxSan,
  };

  // ライブラリシナリオの紐付けは任意。存在しないIDは黙って無視する
  let scenarioId: string | null = null;
  if (parsed.data.scenarioId) {
    const scenarioRef = await prisma.scenario.findUnique({
      where: { id: parsed.data.scenarioId },
      select: { id: true },
    });
    scenarioId = scenarioRef?.id ?? null;
  }

  const session = await prisma.aiGmSession.create({
    data: {
      title: parsed.data.title,
      scenario: parsed.data.scenario,
      scenarioId,
      characterId: character.id,
      stateJson: JSON.stringify(state),
    },
  });
  return NextResponse.json(session, { status: 201 });
}

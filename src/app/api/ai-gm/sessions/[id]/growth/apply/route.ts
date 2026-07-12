import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { skillsSchema, aiGmStateSchema } from "@/lib/coc6/types";

type Params = { params: Promise<{ id: string }> };

const applySchema = z.object({
  skills: skillsSchema, // 技能名 → 成長後の値
  applyVitals: z.boolean().default(true),
});

// 成長結果とプレイ中のHP/MP/SANをマスターのキャラクターシートに反映する
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  const session = await prisma.aiGmSession.findUnique({
    where: { id },
    include: { character: true },
  });
  if (!session) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  if (session.growthAppliedAt) {
    return NextResponse.json(
      { error: "このセッションの成長は既に反映済みです" },
      { status: 409 },
    );
  }

  const sheetSkills = skillsSchema
    .catch({})
    .parse(JSON.parse(session.character.skillsJson));
  const merged = { ...sheetSkills, ...parsed.data.skills };

  const state = aiGmStateSchema.safeParse(JSON.parse(session.stateJson));
  const vitals =
    parsed.data.applyVitals && state.success
      ? {
          currentHp: state.data.hp,
          currentMp: state.data.mp,
          currentSan: state.data.san,
        }
      : {};

  await prisma.$transaction([
    prisma.character.update({
      where: { id: session.characterId },
      data: { skillsJson: JSON.stringify(merged), ...vitals },
    }),
    prisma.aiGmSession.update({
      where: { id },
      data: { growthAppliedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

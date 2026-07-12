import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { skillsSchema, aiGmStateSchema } from "@/lib/coc6/types";

type Params = { params: Promise<{ id: string }> };

const applySchema = z.object({
  members: z
    .array(
      z.object({
        characterId: z.string().min(1),
        skills: skillsSchema, // 技能名 → 成長後の値
        applyVitals: z.boolean().default(true),
      }),
    )
    .min(1),
});

// 成長結果とプレイ中のHP/MP/SANをメンバー各自のマスターシートに反映する
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
    include: { members: { include: { character: true } } },
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

  const updates = [];
  for (const input of parsed.data.members) {
    const member = session.members.find((m) => m.characterId === input.characterId);
    if (!member) continue; // メンバーでないキャラへの反映は無視

    const sheetSkills = skillsSchema
      .catch({})
      .parse(JSON.parse(member.character.skillsJson));
    const merged = { ...sheetSkills, ...input.skills };

    const state = aiGmStateSchema.safeParse(JSON.parse(member.stateJson));
    const vitals =
      input.applyVitals && state.success
        ? {
            currentHp: state.data.hp,
            currentMp: state.data.mp,
            currentSan: state.data.san,
          }
        : {};

    updates.push(
      prisma.character.update({
        where: { id: member.characterId },
        data: { skillsJson: JSON.stringify(merged), ...vitals },
      }),
    );
  }

  await prisma.$transaction([
    ...updates,
    prisma.aiGmSession.update({
      where: { id },
      data: { growthAppliedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

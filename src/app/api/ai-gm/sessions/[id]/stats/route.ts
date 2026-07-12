import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSessionStats } from "@/lib/ai-gm/stats";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await prisma.aiGmSession.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: { position: "asc" },
        include: { character: { select: { name: true } } },
      },
    },
  });
  if (!session) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  const rolls = await prisma.diceRoll.findMany({
    where: { aiGmSessionId: id, source: "AI_GM" },
    select: {
      expression: true,
      total: true,
      target: true,
      outcome: true,
      skillName: true,
      characterId: true,
      characterName: true,
      sanAfter: true,
      createdAt: true,
    },
  });
  const stats = buildSessionStats(
    rolls,
    session.members.map((m) => ({
      characterId: m.characterId,
      name: m.character.name,
    })),
  );
  return NextResponse.json(stats);
}

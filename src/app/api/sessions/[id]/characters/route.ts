import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const linkSchema = z.object({ characterId: z.string().min(1) });

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "characterId が必要です" }, { status: 400 });
  }
  const [session, character] = await Promise.all([
    prisma.gameSession.findUnique({ where: { id } }),
    // ゴミ箱にある探索者は新規参加させない (既存の参加リンクは維持される)
    prisma.character.findFirst({
      where: { id: parsed.data.characterId, deletedAt: null },
    }),
  ]);
  if (!session || !character) {
    return NextResponse.json({ error: "卓または探索者が見つかりません" }, { status: 404 });
  }
  const existing = await prisma.sessionCharacter.findUnique({
    where: {
      sessionId_characterId: { sessionId: id, characterId: character.id },
    },
    include: { character: true },
  });
  if (existing) {
    return NextResponse.json(existing, { status: 200 }); // 既存リンクは新規作成ではない
  }
  const link = await prisma.sessionCharacter.create({
    data: { sessionId: id, characterId: character.id },
    include: { character: true },
  });
  return NextResponse.json(link, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const characterId = req.nextUrl.searchParams.get("characterId");
  if (!characterId) {
    return NextResponse.json({ error: "characterId が必要です" }, { status: 400 });
  }
  await prisma.sessionCharacter.deleteMany({
    where: { sessionId: id, characterId },
  });
  return NextResponse.json({ ok: true });
}

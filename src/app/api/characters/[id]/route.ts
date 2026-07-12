import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { characterInputSchema } from "@/lib/coc6/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const character = await prisma.character.findUnique({ where: { id } });
  if (!character) {
    return NextResponse.json({ error: "探索者が見つかりません" }, { status: 404 });
  }
  return NextResponse.json(character);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = characterInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 },
    );
  }
  const d = parsed.data;
  try {
    const character = await prisma.character.update({
      where: { id },
      data: {
        // editionは作成後変更不可 (判定ルールが変わるため)
        ...(d.luck !== undefined && { luck: d.luck }),
        name: d.name,
        playerName: d.playerName ?? null,
        occupation: d.occupation ?? null,
        age: d.age ?? null,
        sex: d.sex ?? null,
        imageUrl: d.imageUrl ?? null,
        str: d.str,
        con: d.con,
        pow: d.pow,
        dex: d.dex,
        app: d.app,
        siz: d.siz,
        int_: d.int_,
        edu: d.edu,
        ...(d.currentHp !== undefined && { currentHp: d.currentHp }),
        ...(d.currentMp !== undefined && { currentMp: d.currentMp }),
        ...(d.currentSan !== undefined && { currentSan: d.currentSan }),
        skillsJson: JSON.stringify(d.skills),
        memo: d.memo ?? null,
      },
    });
    return NextResponse.json(character);
  } catch {
    return NextResponse.json({ error: "探索者が見つかりません" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.character.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "探索者が見つかりません" }, { status: 404 });
  }
}

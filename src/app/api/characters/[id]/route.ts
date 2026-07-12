import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { characterInputSchema } from "@/lib/coc6/types";
import { deriveStatsFor } from "@/lib/coc";

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
  // 現在値は派生上限を超えないようクランプする (editionは既存レコードの値を使う)
  const existing = await prisma.character.findUnique({
    where: { id },
    select: { edition: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "探索者が見つかりません" }, { status: 404 });
  }
  const derived = deriveStatsFor(
    existing.edition === "7" ? "7" : "6",
    d,
    d.skills["クトゥルフ神話"] ?? 0,
  );
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
        ...(d.currentHp !== undefined && { currentHp: Math.min(d.currentHp, derived.hp) }),
        ...(d.currentMp !== undefined && { currentMp: Math.min(d.currentMp, derived.mp) }),
        ...(d.currentSan !== undefined && {
          currentSan: Math.min(d.currentSan, derived.maxSan),
        }),
        skillsJson: JSON.stringify(d.skills),
        weaponsJson: JSON.stringify(d.weapons),
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

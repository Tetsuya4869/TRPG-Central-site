import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { characterInputSchema } from "@/lib/coc6/types";
import { deriveStatsFor, initialLuckFor } from "@/lib/coc";

export async function GET() {
  const characters = await prisma.character.findMany({
    where: { deletedAt: null },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(characters);
}

export async function POST(req: NextRequest) {
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
  const derived = deriveStatsFor(d.edition, d);
  const character = await prisma.character.create({
    data: {
      edition: d.edition,
      luck: d.luck ?? initialLuckFor(d.edition),
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
      // 現在値は派生上限を超えないようクランプする
      currentHp: Math.min(d.currentHp ?? derived.hp, derived.hp),
      currentMp: Math.min(d.currentMp ?? derived.mp, derived.mp),
      currentSan: Math.min(d.currentSan ?? derived.san, derived.maxSan), // 7版は初期SAN=POW

      skillsJson: JSON.stringify(d.skills),
      weaponsJson: JSON.stringify(d.weapons),
      memo: d.memo ?? null,
    },
  });
  return NextResponse.json(character, { status: 201 });
}

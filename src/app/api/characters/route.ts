import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { characterInputSchema } from "@/lib/coc6/types";
import { deriveStats } from "@/lib/coc6/stats";

export async function GET() {
  const characters = await prisma.character.findMany({
    orderBy: { updatedAt: "desc" },
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
  const derived = deriveStats(d);
  const character = await prisma.character.create({
    data: {
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
      currentHp: d.currentHp ?? derived.hp,
      currentMp: d.currentMp ?? derived.mp,
      currentSan: d.currentSan ?? derived.san,
      skillsJson: JSON.stringify(d.skills),
      memo: d.memo ?? null,
    },
  });
  return NextResponse.json(character, { status: 201 });
}

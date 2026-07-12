import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// 探索者の複製。AI GMプレイで消耗する前の状態を残したいときなどに使う。
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const character = await prisma.character.findUnique({ where: { id } });
  if (!character) {
    return NextResponse.json({ error: "探索者が見つかりません" }, { status: 404 });
  }
  const copy = await prisma.character.create({
    data: {
      name: `${character.name}のコピー`,
      playerName: character.playerName,
      occupation: character.occupation,
      age: character.age,
      sex: character.sex,
      imageUrl: character.imageUrl,
      str: character.str,
      con: character.con,
      pow: character.pow,
      dex: character.dex,
      app: character.app,
      siz: character.siz,
      int_: character.int_,
      edu: character.edu,
      currentHp: character.currentHp,
      currentMp: character.currentMp,
      currentSan: character.currentSan,
      skillsJson: character.skillsJson,
      memo: character.memo,
    },
  });
  return NextResponse.json(copy, { status: 201 });
}

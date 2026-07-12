// 狂気表ロール (手動)。6版: 一時的狂気 / 7版: 狂気の発作。
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { editionSchema } from "@/lib/coc";
import { rollMadness } from "@/lib/coc/madness";

const madnessSchema = z.object({
  edition: editionSchema.default("6"),
  characterName: z.string().max(100).optional().nullable(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = madnessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  const result = rollMadness(parsed.data.edition);
  await prisma.diceRoll.create({
    data: {
      expression: "1d10",
      rolls: JSON.stringify([result.roll]),
      total: result.roll,
      context: `狂気表(${parsed.data.edition}版): ${result.entry.title}`,
      characterName: parsed.data.characterName ?? null,
      source: "MANUAL",
    },
  });

  return NextResponse.json({
    edition: result.edition,
    roll: result.roll,
    title: result.entry.title,
    description: result.entry.description,
    duration: result.durationText,
  });
}

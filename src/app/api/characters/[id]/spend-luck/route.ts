// 7版の幸運消費: 失敗した判定に幸運ポイントを支払い、成功 (レギュラー) に変える。
// 対象のDiceRollのoutcomeを書き換え、contextに消費記録を残す (二重適用防止に使う)。
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const spendSchema = z.object({
  diceRollId: z.string().min(1),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = spendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  const [character, roll] = await Promise.all([
    prisma.character.findUnique({ where: { id } }),
    prisma.diceRoll.findUnique({ where: { id: parsed.data.diceRollId } }),
  ]);
  if (!character) {
    return NextResponse.json({ error: "探索者が見つかりません" }, { status: 404 });
  }
  if (!roll) {
    return NextResponse.json({ error: "対象のロールが見つかりません" }, { status: 404 });
  }
  if (character.edition !== "7") {
    return NextResponse.json(
      { error: "幸運消費は7版のルールです" },
      { status: 400 },
    );
  }
  // 二重適用チェックを先に行う (消費後はoutcomeがSUCCESSになるため)
  if (roll.context?.includes("(幸運")) {
    return NextResponse.json(
      { error: "このロールには既に幸運を消費しています" },
      { status: 409 },
    );
  }
  if (roll.outcome !== "FAILURE" || roll.target == null) {
    return NextResponse.json(
      { error: "幸運を消費できるのは失敗した判定のみです (ファンブルは不可)" },
      { status: 400 },
    );
  }

  // 消費コスト = 出目 - 目標値 (成功に必要な差分)
  const cost = roll.total - roll.target;
  if (cost <= 0) {
    return NextResponse.json({ error: "この判定は失敗していません" }, { status: 400 });
  }
  const currentLuck = character.luck ?? 0;
  if (currentLuck < cost) {
    return NextResponse.json(
      { error: `幸運が足りません (必要${cost}、現在${currentLuck})` },
      { status: 400 },
    );
  }

  const [updatedCharacter, updatedRoll] = await prisma.$transaction([
    prisma.character.update({
      where: { id },
      data: { luck: currentLuck - cost },
    }),
    prisma.diceRoll.update({
      where: { id: roll.id },
      data: {
        outcome: "SUCCESS",
        context: `${roll.context ?? ""} (幸運${cost}消費で成功)`.trim(),
      },
    }),
  ]);

  return NextResponse.json({
    spent: cost,
    luck: updatedCharacter.luck,
    roll: updatedRoll,
  });
}

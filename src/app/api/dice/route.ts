import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rollDice } from "@/lib/dice";
import { skillCheck } from "@/lib/coc6/check";

const rollRequestSchema = z.object({
  expression: z.string().max(20).optional(),
  target: z.number().int().min(1).max(100).optional(),
  context: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = rollRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  const { expression, target, context } = parsed.data;

  try {
    if (target !== undefined) {
      // 目標値付き = 技能判定 (1d100固定)
      const result = skillCheck(target);
      const record = await prisma.diceRoll.create({
        data: {
          expression: "1d100",
          rolls: JSON.stringify([result.roll]),
          total: result.roll,
          target,
          outcome: result.outcome,
          context: context ?? null,
        },
      });
      return NextResponse.json(record);
    }

    if (!expression) {
      return NextResponse.json(
        { error: "ダイス式か目標値のどちらかを指定してください" },
        { status: 400 },
      );
    }
    const result = rollDice(expression);
    const record = await prisma.diceRoll.create({
      data: {
        expression: result.expression,
        rolls: JSON.stringify(result.rolls),
        total: result.total,
        context: context ?? null,
      },
    });
    return NextResponse.json(record);
  } catch (e) {
    const message = e instanceof Error ? e.message : "ロールに失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  const rolls = await prisma.diceRoll.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(rolls);
}

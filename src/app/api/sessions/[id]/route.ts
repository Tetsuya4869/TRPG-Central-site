import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sessionStatusSchema } from "@/lib/coc6/types";
import { combatStateSchema } from "@/lib/combat";

const sessionUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  scenarioName: z.string().max(200).optional().nullable(),
  scenarioId: z.string().optional().nullable(),
  scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
  notes: z.string().max(20000).optional().nullable(),
  status: sessionStatusSchema.optional(),
  combatJson: z.string().max(50000).optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await prisma.gameSession.findUnique({
    where: { id },
    include: { characters: { include: { character: true } }, scenario: { select: { id: true, title: true } } },
  });
  if (!session) {
    return NextResponse.json({ error: "卓が見つかりません" }, { status: 404 });
  }
  return NextResponse.json(session);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = sessionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 },
    );
  }
  const d = parsed.data;
  // combatJsonは中身をスキーマ検証してから保存する
  if (d.combatJson != null) {
    try {
      combatStateSchema.parse(JSON.parse(d.combatJson));
    } catch {
      return NextResponse.json({ error: "戦闘状態が不正です" }, { status: 400 });
    }
  }
  // 存在しないscenarioIdはFK違反(誤った404)にせず、POSTと同じく黙ってnull化する
  let scenarioId = d.scenarioId;
  if (scenarioId) {
    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId },
      select: { id: true },
    });
    if (!scenario) scenarioId = null;
  }
  try {
    const session = await prisma.gameSession.update({
      where: { id },
      data: {
        ...(d.title !== undefined && { title: d.title }),
        ...(d.scenarioName !== undefined && { scenarioName: d.scenarioName }),
        ...(d.scenarioId !== undefined && { scenarioId }),
        ...(d.scheduledAt !== undefined && {
          scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null,
        }),
        ...(d.notes !== undefined && { notes: d.notes }),
        ...(d.status !== undefined && { status: d.status }),
        ...(d.combatJson !== undefined && { combatJson: d.combatJson }),
      },
      include: { characters: { include: { character: true } }, scenario: { select: { id: true, title: true } } },
    });
    return NextResponse.json(session);
  } catch {
    return NextResponse.json({ error: "卓が見つかりません" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.gameSession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "卓が見つかりません" }, { status: 404 });
  }
}

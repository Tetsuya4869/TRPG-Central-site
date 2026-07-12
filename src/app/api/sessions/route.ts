import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sessionStatusSchema } from "@/lib/coc6/types";

const sessionInputSchema = z.object({
  title: z.string().min(1, "タイトルは必須です").max(200),
  scenarioName: z.string().max(200).optional().nullable(),
  scenarioId: z.string().optional().nullable(),
  scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
  notes: z.string().max(20000).optional().nullable(),
  status: sessionStatusSchema.default("RECRUITING"),
});

export async function GET() {
  const sessions = await prisma.gameSession.findMany({
    orderBy: { updatedAt: "desc" },
    include: { characters: { include: { character: true } }, scenario: { select: { id: true, title: true } } },
  });
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = sessionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 },
    );
  }
  const d = parsed.data;
  let scenarioId: string | null = null;
  if (d.scenarioId) {
    const ref = await prisma.scenario.findUnique({
      where: { id: d.scenarioId },
      select: { id: true },
    });
    scenarioId = ref?.id ?? null;
  }
  const session = await prisma.gameSession.create({
    data: {
      title: d.title,
      scenarioName: d.scenarioName ?? null,
      scenarioId,
      scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null,
      notes: d.notes ?? null,
      status: d.status,
    },
  });
  return NextResponse.json(session, { status: 201 });
}

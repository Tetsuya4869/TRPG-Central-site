import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scenarioInputSchema } from "@/lib/coc6/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) {
    return NextResponse.json({ error: "シナリオが見つかりません" }, { status: 404 });
  }
  return NextResponse.json(scenario);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = scenarioInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 },
    );
  }
  const d = parsed.data;
  try {
    const scenario = await prisma.scenario.update({
      where: { id },
      data: {
        title: d.title,
        content: d.content,
        summary: d.summary ?? null,
        tags: d.tags.length > 0 ? d.tags.join(",") : null,
        source: d.source,
      },
    });
    return NextResponse.json(scenario);
  } catch {
    return NextResponse.json({ error: "シナリオが見つかりません" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.scenario.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "シナリオが見つかりません" }, { status: 404 });
  }
}

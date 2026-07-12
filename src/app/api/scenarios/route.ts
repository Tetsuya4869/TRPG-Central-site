import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scenarioInputSchema } from "@/lib/coc6/types";

export async function GET() {
  const scenarios = await prisma.scenario.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(scenarios);
}

export async function POST(req: NextRequest) {
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
  const scenario = await prisma.scenario.create({
    data: {
      title: d.title,
      content: d.content,
      summary: d.summary ?? null,
      tags: d.tags.length > 0 ? d.tags.join(",") : null,
      source: d.source,
    },
  });
  return NextResponse.json(scenario, { status: 201 });
}

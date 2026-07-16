// AIによるNPC生成。生成結果は ScenarioAsset (kind: NPC) として保存する。
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasApiKey } from "@/lib/ai-gm/client";
import { generateNpc } from "@/lib/ai-gm/npc-gen";

export const runtime = "nodejs";
export const maxDuration = 300;

const generateSchema = z.object({
  role: z.string().min(1, "役どころを入力してください").max(200),
  tone: z.string().max(100).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!hasApiKey()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 503 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 },
    );
  }
  const scenario = await prisma.scenario.findUnique({
    where: { id },
    select: { content: true, _count: { select: { assets: true } } },
  });
  if (!scenario) {
    return NextResponse.json({ error: "シナリオが見つかりません" }, { status: 404 });
  }

  try {
    const npc = await generateNpc({
      role: parsed.data.role,
      tone: parsed.data.tone,
      scenarioContext: scenario.content.slice(0, 2000),
    });
    const asset = await prisma.scenarioAsset.create({
      data: {
        scenarioId: id,
        kind: "NPC",
        name: npc.name,
        content: npc.content,
        position: scenario._count.assets,
      },
    });
    return NextResponse.json(asset, { status: 201 });
  } catch (e) {
    console.error("NPC生成に失敗:", e);
    return NextResponse.json(
      { error: "NPCの生成に失敗しました。時間をおいて再試行してください" },
      { status: 502 },
    );
  }
}

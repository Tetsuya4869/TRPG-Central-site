import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { imageUrlSchema } from "@/lib/upload";

const assetInputSchema = z.object({
  kind: z.enum(["NPC", "HANDOUT"]),
  name: z.string().min(1, "名前は必須です").max(100),
  content: z.string().min(1, "内容は必須です").max(10000),
  imageUrl: imageUrlSchema.optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const assets = await prisma.scenarioAsset.findMany({
    where: { scenarioId: id },
    orderBy: [{ kind: "asc" }, { position: "asc" }],
  });
  return NextResponse.json(assets);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const scenario = await prisma.scenario.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!scenario) {
    return NextResponse.json({ error: "シナリオが見つかりません" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = assetInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 },
    );
  }
  const last = await prisma.scenarioAsset.findFirst({
    where: { scenarioId: id, kind: parsed.data.kind },
    orderBy: { position: "desc" },
  });
  const asset = await prisma.scenarioAsset.create({
    data: {
      scenarioId: id,
      kind: parsed.data.kind,
      name: parsed.data.name,
      content: parsed.data.content,
      imageUrl: parsed.data.imageUrl ?? null,
      position: (last?.position ?? -1) + 1,
    },
  });
  return NextResponse.json(asset, { status: 201 });
}

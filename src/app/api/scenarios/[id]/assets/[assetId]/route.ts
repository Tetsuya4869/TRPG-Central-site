import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const assetUpdateSchema = z.object({
  kind: z.enum(["NPC", "HANDOUT"]).optional(),
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).max(10000).optional(),
  imageUrl: z
    .string()
    .max(300)
    .regex(/^\/uploads\//)
    .optional()
    .nullable(),
});

type Params = { params: Promise<{ id: string; assetId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id, assetId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = assetUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }
  try {
    const asset = await prisma.scenarioAsset.update({
      where: { id: assetId, scenarioId: id },
      data: {
        ...(parsed.data.kind !== undefined && { kind: parsed.data.kind }),
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.content !== undefined && { content: parsed.data.content }),
        ...(parsed.data.imageUrl !== undefined && { imageUrl: parsed.data.imageUrl }),
      },
    });
    return NextResponse.json(asset);
  } catch {
    return NextResponse.json({ error: "資料が見つかりません" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, assetId } = await params;
  try {
    await prisma.scenarioAsset.delete({ where: { id: assetId, scenarioId: id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "資料が見つかりません" }, { status: 404 });
  }
}

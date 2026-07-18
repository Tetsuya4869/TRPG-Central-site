// シナリオのお気に入りピン留めトグル。
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({ pinned: z.boolean() });

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "pinned (boolean) が必要です" }, { status: 400 });
  }
  const existing = await prisma.scenario.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "シナリオが見つかりません" }, { status: 404 });
  }
  const scenario = await prisma.scenario.update({
    where: { id },
    data: { pinned: parsed.data.pinned },
    select: { id: true, pinned: true },
  });
  return NextResponse.json(scenario);
}

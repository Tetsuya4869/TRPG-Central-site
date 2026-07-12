import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { aiGmStatusSchema } from "@/lib/coc6/types";
import { hasApiKey } from "@/lib/ai-gm/client";
import { toDisplayMessages } from "@/lib/ai-gm/display";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await prisma.aiGmSession.findUnique({
    where: { id },
    include: {
      character: true,
      messages: { orderBy: { seq: "asc" } },
    },
  });
  if (!session) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  return NextResponse.json({
    id: session.id,
    title: session.title,
    scenario: session.scenario,
    status: session.status,
    state: JSON.parse(session.stateJson),
    character: {
      id: session.character.id,
      name: session.character.name,
      occupation: session.character.occupation,
      imageUrl: session.character.imageUrl,
      skillsJson: session.character.skillsJson,
    },
    messages: toDisplayMessages(session.messages),
    apiKeyConfigured: hasApiKey(),
  });
}

const updateSchema = z.object({ status: aiGmStatusSchema });

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }
  try {
    const session = await prisma.aiGmSession.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    return NextResponse.json(session);
  } catch {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.aiGmSession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
}

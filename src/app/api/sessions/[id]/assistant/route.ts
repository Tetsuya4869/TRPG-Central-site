import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDisplayMessages } from "@/lib/ai-gm/display";
import { hasApiKey } from "@/lib/ai-gm/client";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await prisma.gameSession.findUnique({
    where: { id },
    include: { kpMessages: { orderBy: { seq: "asc" } } },
  });
  if (!session) {
    return NextResponse.json({ error: "卓が見つかりません" }, { status: 404 });
  }
  return NextResponse.json({
    messages: toDisplayMessages(session.kpMessages),
    apiKeyConfigured: hasApiKey(),
  });
}

// 相談履歴のクリア
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.sessionChatMessage.deleteMany({ where: { gameSessionId: id } });
  return NextResponse.json({ ok: true });
}

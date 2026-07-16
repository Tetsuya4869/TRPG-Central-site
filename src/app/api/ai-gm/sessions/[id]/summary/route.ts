// AI GMセッションの「前回のあらすじ」生成。結果は AiGmSession.summary にキャッシュする。
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasApiKey } from "@/lib/ai-gm/client";
import {
  buildSummarySourceFromChat,
  generateSummary,
} from "@/lib/ai-gm/summary";

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!hasApiKey()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません。あらすじは手動でも入力できます。" },
      { status: 503 },
    );
  }
  const session = await prisma.aiGmSession.findUnique({
    where: { id },
    include: { messages: { orderBy: { seq: "asc" } } },
  });
  if (!session) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  if (session.messages.length === 0) {
    return NextResponse.json(
      { error: "ログがないため、あらすじを生成できません" },
      { status: 400 },
    );
  }

  try {
    const source = buildSummarySourceFromChat(session.messages);
    const summary = await generateSummary(source);
    await prisma.aiGmSession.update({ where: { id }, data: { summary } });
    return NextResponse.json({ summary });
  } catch (e) {
    console.error("あらすじ生成に失敗:", e);
    return NextResponse.json(
      { error: "あらすじの生成に失敗しました。時間をおいて再試行してください" },
      { status: 502 },
    );
  }
}

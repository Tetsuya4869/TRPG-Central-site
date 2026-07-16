// 人間卓の「これまでのあらすじ」生成。卓ログ(SessionLog+DiceRoll)から要約し、
// SessionLog (kind: SUMMARY) として卓ログに残す。
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasApiKey } from "@/lib/ai-gm/client";
import {
  buildSummarySourceFromSessionLog,
  generateSummary,
} from "@/lib/ai-gm/summary";

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!hasApiKey()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 503 },
    );
  }
  const session = await prisma.gameSession.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!session) {
    return NextResponse.json({ error: "卓が見つかりません" }, { status: 404 });
  }
  const [logs, rolls] = await Promise.all([
    prisma.sessionLog.findMany({
      where: { gameSessionId: id, kind: { not: "SUMMARY" } }, // 過去のあらすじ自体は要約対象外
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
    prisma.diceRoll.findMany({
      where: { gameSessionId: id },
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
  ]);
  if (logs.length === 0 && rolls.length === 0) {
    return NextResponse.json(
      { error: "卓ログがないため、あらすじを生成できません" },
      { status: 400 },
    );
  }

  try {
    const source = buildSummarySourceFromSessionLog(logs, rolls);
    const summary = await generateSummary(source);
    const log = await prisma.sessionLog.create({
      data: { gameSessionId: id, kind: "SUMMARY", body: summary },
    });
    return NextResponse.json({ summary, log }, { status: 201 });
  } catch (e) {
    console.error("あらすじ生成に失敗:", e);
    return NextResponse.json(
      { error: "あらすじの生成に失敗しました。時間をおいて再試行してください" },
      { status: 502 },
    );
  }
}

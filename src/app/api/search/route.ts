import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 横断検索: 探索者・卓・シナリオ・AI GMセッションを名前/タイトル等の部分一致で探す。
// コマンドパレット(⌘K)から叩かれる。各カテゴリ最大5件。
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1 || q.length > 100) {
    return NextResponse.json({ characters: [], sessions: [], scenarios: [], aiGmSessions: [] });
  }
  const contains = { contains: q, mode: "insensitive" as const };

  const [characters, sessions, scenarios, aiGmSessions] = await Promise.all([
    prisma.character.findMany({
      where: {
        OR: [{ name: contains }, { occupation: contains }, { playerName: contains }],
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, occupation: true, edition: true, imageUrl: true },
    }),
    prisma.gameSession.findMany({
      where: {
        OR: [{ title: contains }, { scenarioName: contains }, { notes: contains }],
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, scheduledAt: true },
    }),
    prisma.scenario.findMany({
      where: {
        OR: [{ title: contains }, { tags: contains }, { summary: contains }],
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, tags: true, source: true },
    }),
    prisma.aiGmSession.findMany({
      where: { title: contains },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true },
    }),
  ]);

  return NextResponse.json({ characters, sessions, scenarios, aiGmSessions });
}

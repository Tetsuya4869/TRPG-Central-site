// 卓予定の.icsダウンロード。カレンダーアプリ (Google/iOS等) にそのまま登録できる。
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSessionIcs } from "@/lib/ics";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await prisma.gameSession.findUnique({
    where: { id },
    select: { id: true, title: true, scenarioName: true, notes: true, scheduledAt: true },
  });
  if (!session) {
    return NextResponse.json({ error: "卓が見つかりません" }, { status: 404 });
  }
  if (!session.scheduledAt) {
    return NextResponse.json(
      { error: "開催日時が設定されていません" },
      { status: 400 },
    );
  }
  const ics = buildSessionIcs({ ...session, scheduledAt: session.scheduledAt });
  const filename = encodeURIComponent(`${session.title}.ics`);
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="session.ics"; filename*=UTF-8''${filename}`,
    },
  });
}

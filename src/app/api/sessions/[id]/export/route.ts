// 卓ログ (出来事メモ+ダイス履歴) をMarkdownファイルとしてダウンロードする。
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSessionLogMarkdown } from "@/lib/markdown-export";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await prisma.gameSession.findUnique({
    where: { id },
    select: { id: true, title: true, scenarioName: true, scheduledAt: true },
  });
  if (!session) {
    return NextResponse.json({ error: "卓が見つかりません" }, { status: 404 });
  }
  const [logs, rolls] = await Promise.all([
    prisma.sessionLog.findMany({
      where: { gameSessionId: id },
      orderBy: { createdAt: "asc" },
      take: 1000,
    }),
    prisma.diceRoll.findMany({
      where: { gameSessionId: id },
      orderBy: { createdAt: "asc" },
      take: 1000,
    }),
  ]);

  const markdown = buildSessionLogMarkdown(session, logs, rolls);
  // RFC 5987: 日本語タイトルはfilename*でUTF-8エンコードして渡す
  const filename = encodeURIComponent(`卓ログ_${session.title}.md`);
  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="session-log.md"; filename*=UTF-8''${filename}`,
    },
  });
}

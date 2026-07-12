import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDisplayMessages } from "@/lib/ai-gm/display";
import { buildReplayMarkdown } from "@/lib/ai-gm/replay";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await prisma.aiGmSession.findUnique({
    where: { id },
    include: { character: true, messages: { orderBy: { seq: "asc" } } },
  });
  if (!session) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }

  const markdown = buildReplayMarkdown(
    session,
    session.character,
    toDisplayMessages(session.messages),
  );

  // 日本語ファイル名はRFC5987 (filename*=UTF-8'') で指定する
  const filename = encodeURIComponent(`${session.title}_リプレイ.md`);
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="replay.md"; filename*=UTF-8''${filename}`,
    },
  });
}

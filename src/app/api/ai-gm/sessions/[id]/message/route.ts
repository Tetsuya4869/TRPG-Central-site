// AI GMへのプレイヤー発言を受け付け、SSEで応答をストリーミングする。
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { hasApiKey } from "@/lib/ai-gm/client";
import { runGmTurn, type SseEvent } from "@/lib/ai-gm/loop";

export const runtime = "nodejs";
export const maxDuration = 300;

const messageSchema = z.object({
  message: z.string().min(1, "メッセージを入力してください").max(4000),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!hasApiKey()) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY が設定されていません。.env に APIキーを設定してサーバーを再起動してください。",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 },
    );
  }

  const session = await prisma.aiGmSession.findUnique({
    where: { id },
    include: {
      members: { orderBy: { position: "asc" }, include: { character: true } },
      messages: { orderBy: { seq: "asc" } },
    },
  });
  if (!session) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  if (session.status === "FINISHED") {
    return NextResponse.json({ error: "終了したセッションです" }, { status: 400 });
  }
  if (session.members.length === 0) {
    return NextResponse.json(
      { error: "参加探索者が削除されているため、このセッションは再開できません" },
      { status: 400 },
    );
  }

  // 保存済み履歴を無加工で復元 (thinking/tool_useブロック含む)
  const history: Anthropic.MessageParam[] = session.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: JSON.parse(m.contentJson),
  }));

  // 今回のプレイヤー発言を追加・永続化
  const userContent: Anthropic.ContentBlockParam[] = [
    { type: "text", text: parsed.data.message },
  ];
  let nextSeq = (session.messages.at(-1)?.seq ?? -1) + 1;
  await prisma.chatMessage.create({
    data: {
      aiGmSessionId: session.id,
      role: "user",
      contentJson: JSON.stringify(userContent),
      seq: nextSeq,
    },
  });
  history.push({ role: "user", content: userContent });
  nextSeq += 1;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // クライアント切断後のenqueueは例外になるため握りつぶす
      // (ループ自体は継続し、メッセージの永続化は完了させる)
      let closed = false;
      const emit = (event: SseEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };
      try {
        await runGmTurn({ session, history, nextSeq, emit });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "AI GMの応答中にエラーが発生しました";
        emit({ type: "error", message });
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            // すでに閉じられている場合は無視
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

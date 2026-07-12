// AI KP補佐への相談を受け付け、SSEで応答をストリーミングする。
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasApiKey } from "@/lib/ai-gm/client";
import { mergeConsecutiveUserTurns } from "@/lib/ai-gm/history";
import { runKpTurn } from "@/lib/ai-kp/assistant";
import type { SseEvent } from "@/lib/ai-gm/loop";

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

  const session = await prisma.gameSession.findUnique({
    where: { id },
    include: {
      kpMessages: { orderBy: { seq: "asc" } },
      scenario: { include: { assets: { orderBy: { position: "asc" } } } },
      characters: { include: { character: true } },
    },
  });
  if (!session) {
    return NextResponse.json({ error: "卓が見つかりません" }, { status: 404 });
  }

  const history: Anthropic.MessageParam[] = session.kpMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: JSON.parse(m.contentJson),
  }));

  const userContent: Anthropic.ContentBlockParam[] = [
    { type: "text", text: parsed.data.message },
  ];
  let nextSeq = (session.kpMessages.at(-1)?.seq ?? -1) + 1;
  try {
    await prisma.sessionChatMessage.create({
      data: {
        gameSessionId: session.id,
        role: "user",
        contentJson: JSON.stringify(userContent),
        seq: nextSeq,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "他の送信を処理中です。少し待って再送してください" },
        { status: 409 },
      );
    }
    throw e;
  }
  history.push({ role: "user", content: userContent });
  nextSeq += 1;

  const ctx = {
    session,
    scenario: session.scenario,
    characters: session.characters.map((sc) => sc.character),
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
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
        await runKpTurn({
          ctx,
          history: mergeConsecutiveUserTurns(history),
          nextSeq,
          emit,
        });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "AI KP補佐の応答中にエラーが発生しました";
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

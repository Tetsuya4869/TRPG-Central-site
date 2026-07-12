// AI GMのツール使用ループ (streaming manual loop)。
// assistantメッセージは finalMessage() 成功後にのみ永続化する。
// 途中でエラーが起きた場合、直前のuser発言だけが残るため再送で復旧できる。
import type Anthropic from "@anthropic-ai/sdk";
import type { AiGmSession, Character } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { aiGmStateSchema, type AiGmState } from "@/lib/coc6/types";
import { createClient, GM_MODEL } from "./client";
import { GM_TOOLS, executeGmTool } from "./tools";
import { buildSystemPrompt } from "./system-prompt";

const MAX_ITERATIONS = 8;
const MAX_TOKENS = 16000;

export type SseEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool"; data: Record<string, unknown> }
  | { type: "state"; state: AiGmState }
  | { type: "done" }
  | { type: "error"; message: string };

async function persistMessage(
  aiGmSessionId: string,
  role: "user" | "assistant",
  content: unknown,
  seq: number,
) {
  await prisma.chatMessage.create({
    data: {
      aiGmSessionId,
      role,
      contentJson: JSON.stringify(content),
      seq,
    },
  });
}

export async function runGmTurn(opts: {
  session: AiGmSession & { character: Character };
  history: Anthropic.MessageParam[]; // 永続化済み履歴 (今回のuser発言を含む)
  nextSeq: number; // 次に保存するChatMessageのseq
  emit: (event: SseEvent) => void;
}): Promise<void> {
  const { session, emit } = opts;
  const client = createClient();
  let state = aiGmStateSchema.parse(JSON.parse(session.stateJson));
  const messages: Anthropic.MessageParam[] = [...opts.history];
  let seq = opts.nextSeq;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // Sonnet 5: temperature等は送らない(400になる)。thinkingは省略でadaptive。
    const stream = client.messages.stream({
      model: GM_MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(session.character, state, session.scenario),
      tools: GM_TOOLS,
      messages,
    });

    stream.on("text", (delta) => {
      emit({ type: "text_delta", text: delta });
    });

    const message = await stream.finalMessage();

    // assistant contentを丸ごと保存 (thinking/tool_useブロック含む。再開時に無加工で返送する)
    messages.push({ role: "assistant", content: message.content });
    await persistMessage(session.id, "assistant", message.content, seq++);

    if (message.stop_reason === "pause_turn") {
      // サーバー側ループの一時停止。そのまま継続
      continue;
    }

    const toolUses = message.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (message.stop_reason !== "tool_use" || toolUses.length === 0) {
      break; // end_turn等 — ターン完了
    }

    // すべてのツールを実行し、tool_resultを1つのuserメッセージに集約する
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      try {
        const result = await executeGmTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          { aiGmSessionId: session.id, state },
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result.resultForModel,
        });
        emit({ type: "tool", data: result.display });
        if (result.newState) {
          state = result.newState;
          await prisma.aiGmSession.update({
            where: { id: session.id },
            data: { stateJson: JSON.stringify(state) },
          });
          emit({ type: "state", state });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "ツール実行に失敗しました";
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify({ error: msg }),
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
    await persistMessage(session.id, "user", toolResults, seq++);
  }

  emit({ type: "done" });
}

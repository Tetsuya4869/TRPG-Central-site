// AI GMのツール使用ループ (streaming manual loop)。
// assistantメッセージは finalMessage() 成功後にのみ永続化する。
// 途中でエラーが起きた場合、直前のuser発言だけが残るため再送で復旧できる。
import type Anthropic from "@anthropic-ai/sdk";
import type { AiGmSession, AiGmSessionMember, Character } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  aiGmStateSchema,
  type MemberState,
} from "@/lib/coc6/types";
import { createClient, GM_MODEL } from "./client";
import { buildGmTools, executeGmTool, type MemberContext } from "./tools";
import type { Edition } from "@/lib/coc";
import { buildSystemPrompt } from "./system-prompt";

const MAX_ITERATIONS = 8;
const MAX_TOKENS = 16000;

export type SseEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool"; data: Record<string, unknown> }
  | { type: "state"; members: MemberState[] }
  | { type: "done" }
  | { type: "error"; message: string };

export type SessionWithMembers = AiGmSession & {
  members: (AiGmSessionMember & { character: Character })[];
};

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

function toMemberStates(
  session: SessionWithMembers,
  contexts: MemberContext[],
): MemberState[] {
  return contexts.map((c) => ({
    characterId: c.characterId,
    name: c.name,
    state: c.state,
  }));
}

export async function runGmTurn(opts: {
  session: SessionWithMembers;
  history: Anthropic.MessageParam[]; // 永続化済み履歴 (今回のuser発言を含む)
  nextSeq: number; // 次に保存するChatMessageのseq
  emit: (event: SseEvent) => void;
}): Promise<void> {
  const { session, emit } = opts;
  const client = createClient();

  const sortedMembers = [...session.members].sort(
    (a, b) => a.position - b.position,
  );
  // セッションの版はメンバーの版 (作成時に混在を拒否している)
  const edition: Edition =
    sortedMembers[0]?.character.edition === "7" ? "7" : "6";
  const gmTools = buildGmTools(edition);
  const memberContexts: MemberContext[] = sortedMembers.map((m) => ({
    memberId: m.id,
    characterId: m.characterId,
    name: m.character.name,
    state: aiGmStateSchema.parse(JSON.parse(m.stateJson)),
  }));

  const messages: Anthropic.MessageParam[] = [...opts.history];
  let seq = opts.nextSeq;
  let turnCompleted = false;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // Sonnet 5: temperature等は送らない(400になる)。thinkingは省略でadaptive。
    const stream = client.messages.stream({
      model: GM_MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(
        sortedMembers.map((m, i) => ({
          character: m.character,
          state: memberContexts[i].state,
        })),
        session.scenario,
        edition,
      ),
      tools: gmTools,
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
      turnCompleted = true;
      break; // end_turn等 — ターン完了
    }

    // すべてのツールを実行し、tool_resultを1つのuserメッセージに集約する
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      try {
        const result = await executeGmTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          { aiGmSessionId: session.id, edition, members: memberContexts },
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result.resultForModel,
          ...(result.isError && { is_error: true }),
        });
        if (!result.isError) {
          emit({ type: "tool", data: result.display });
        }
        if (result.newMemberState) {
          const ctx = memberContexts.find(
            (m) => m.memberId === result.newMemberState!.memberId,
          );
          if (ctx) ctx.state = result.newMemberState.state;
          await prisma.aiGmSessionMember.update({
            where: { id: result.newMemberState.memberId },
            data: { stateJson: JSON.stringify(result.newMemberState.state) },
          });
          emit({ type: "state", members: toMemberStates(session, memberContexts) });
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

  // 反復上限到達: 履歴末尾が未応答のtool_resultのまま終わらないよう、
  // ツールなしで締めのナレーションを1回だけ生成する
  if (!turnCompleted) {
    const stream = client.messages.stream({
      model: GM_MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(
        sortedMembers.map((m, i) => ({
          character: m.character,
          state: memberContexts[i].state,
        })),
        session.scenario,
        edition,
      ),
      messages,
    });
    stream.on("text", (delta) => emit({ type: "text_delta", text: delta }));
    const message = await stream.finalMessage();
    messages.push({ role: "assistant", content: message.content });
    await persistMessage(session.id, "assistant", message.content, seq++);
  }

  emit({ type: "done" });
}

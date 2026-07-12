// AI KP補佐: 人間がキーパーを務める卓のための相談チャット。
// 進行はせず、NPCのセリフ案・情景描写案・ルール裁定の相談に答える。
// runGmTurn(状態管理・AiGmSession密結合)とは別の軽量ループとして実装する。
import type Anthropic from "@anthropic-ai/sdk";
import type { Character, GameSession, Scenario, ScenarioAsset } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rollDice } from "@/lib/dice";
import { effectiveSkillsFor, editionLabel, type Edition } from "@/lib/coc";
import type { StatBlock } from "@/lib/coc6/types";
import { createClient, GM_MODEL } from "@/lib/ai-gm/client";
import type { SseEvent } from "@/lib/ai-gm/loop";

const MAX_ITERATIONS = 4;
const MAX_TOKENS = 8000;

const KP_TOOLS: Anthropic.Tool[] = [
  {
    name: "roll_dice",
    description:
      "任意のダイスをロールする。キーパーから判定やランダム表のロールを頼まれたときに使う。結果を勝手に決めず必ずこのツールを使う。",
    input_schema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "ダイス式 (例: 1d100, 3d6)" },
        reason: { type: "string", description: "何のためのロールか" },
      },
      required: ["expression", "reason"],
    },
  },
];

const KP_INSTRUCTIONS = `あなたはクトゥルフ神話TRPGのキーパー(KP)を務める人間の相談相手・補佐役です。日本語で簡潔に答えてください。

## 役割
- あなた自身はセッションを進行しない。判断は常に人間のKPに委ね、選択肢や案を提示する。
- 得意分野: NPCのセリフ案(口調付きで2〜3案)、情景描写の下書き、ルール裁定の相談(6版/7版の一般的な運用を根拠付きで)、シナリオ展開のアイデア出し、プレイヤーが予想外の行動をしたときのアドリブ案。
- 回答は短く実用的に。長い前置きは不要。案を出すときは箇条書きで。
- ネタバレ管理はKPの仕事。シナリオの真相に触れる相談にはそのまま答えてよい。
- ダイスロールを頼まれたら roll_dice ツールを使う。`;

export interface KpContext {
  session: GameSession;
  scenario: (Scenario & { assets: ScenarioAsset[] }) | null;
  characters: Character[];
}

function summarizeCharacter(character: Character): string {
  const stats: StatBlock = {
    str: character.str,
    con: character.con,
    pow: character.pow,
    dex: character.dex,
    app: character.app,
    siz: character.siz,
    int_: character.int_,
    edu: character.edu,
  };
  const edition: Edition = character.edition === "7" ? "7" : "6";
  let assigned: Record<string, number> = {};
  try {
    assigned = JSON.parse(character.skillsJson);
  } catch {
    // 壊れたJSONは無視
  }
  const topSkills = effectiveSkillsFor(edition, assigned, stats)
    .filter((s) => s.assigned)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map((s) => `${s.name}${s.value}`)
    .join("、");
  return `- ${character.name} (${editionLabel(edition)}${character.occupation ? `、${character.occupation}` : ""}) HP${character.currentHp} SAN${character.currentSan}${topSkills ? ` / 主要技能: ${topSkills}` : ""}`;
}

export function buildKpSystemPrompt(ctx: KpContext): Anthropic.TextBlockParam[] {
  const parts: string[] = [`# 卓の情報\n卓名: ${ctx.session.title}`];
  if (ctx.session.notes) parts.push(`## 卓メモ\n${ctx.session.notes}`);
  if (ctx.scenario) {
    parts.push(`## シナリオ「${ctx.scenario.title}」\n${ctx.scenario.content}`);
    const npcs = ctx.scenario.assets.filter((a) => a.kind === "NPC");
    if (npcs.length > 0) {
      parts.push(
        `## NPC資料\n${npcs.map((a) => `### ${a.name}\n${a.content}`).join("\n\n")}`,
      );
    }
    const handouts = ctx.scenario.assets.filter((a) => a.kind === "HANDOUT");
    if (handouts.length > 0) {
      parts.push(
        `## ハンドアウト\n${handouts.map((a) => `### ${a.name}\n${a.content}`).join("\n\n")}`,
      );
    }
  }
  if (ctx.characters.length > 0) {
    parts.push(`## 参加探索者\n${ctx.characters.map(summarizeCharacter).join("\n")}`);
  }

  return [
    {
      type: "text",
      text: KP_INSTRUCTIONS,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: parts.join("\n\n"),
      cache_control: { type: "ephemeral" },
    },
  ];
}

async function executeKpRollDice(
  input: Record<string, unknown>,
  gameSessionTitle: string,
): Promise<{ resultForModel: string; display: Record<string, unknown> }> {
  const expression = String(input.expression ?? "1d100");
  const reason = String(input.reason ?? "");
  const result = rollDice(expression);
  await prisma.diceRoll.create({
    data: {
      expression: result.expression,
      rolls: JSON.stringify(result.rolls),
      total: result.total,
      context: `${gameSessionTitle}: ${reason}`,
      source: "KP_ASSIST",
    },
  });
  const payload = {
    tool: "roll_dice",
    expression: result.expression,
    rolls: result.rolls,
    total: result.total,
    reason,
  };
  return { resultForModel: JSON.stringify(payload), display: payload };
}

export async function runKpTurn(opts: {
  ctx: KpContext;
  history: Anthropic.MessageParam[]; // 今回のuser発言を含む
  nextSeq: number;
  emit: (event: SseEvent) => void;
}): Promise<void> {
  const { ctx, emit } = opts;
  const client = createClient();
  const messages: Anthropic.MessageParam[] = [...opts.history];
  let seq = opts.nextSeq;

  const persist = async (role: "user" | "assistant", content: unknown) => {
    await prisma.sessionChatMessage.create({
      data: {
        gameSessionId: ctx.session.id,
        role,
        contentJson: JSON.stringify(content),
        seq: seq++,
      },
    });
  };

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const stream = client.messages.stream({
      model: GM_MODEL,
      max_tokens: MAX_TOKENS,
      system: buildKpSystemPrompt(ctx),
      tools: KP_TOOLS,
      messages,
    });
    stream.on("text", (delta) => emit({ type: "text_delta", text: delta }));
    const message = await stream.finalMessage();

    messages.push({ role: "assistant", content: message.content });
    await persist("assistant", message.content);

    if (message.stop_reason === "pause_turn") continue;

    const toolUses = message.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (message.stop_reason !== "tool_use" || toolUses.length === 0) break;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      try {
        const result = await executeKpRollDice(
          toolUse.input as Record<string, unknown>,
          ctx.session.title,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result.resultForModel,
        });
        emit({ type: "tool", data: result.display });
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
    await persist("user", toolResults);
  }

  emit({ type: "done" });
}

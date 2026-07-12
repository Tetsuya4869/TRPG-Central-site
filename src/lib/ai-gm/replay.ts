// AI GMセッションのログを読み物風Markdownに変換する。
// contentJsonの解釈はdisplay.tsのtoDisplayMessagesに一元化されているため、その出力を入力にとる。
import type { AiGmSession, Character } from "@prisma/client";
import { deriveStats } from "@/lib/coc6/stats";
import { OUTCOME_LABELS } from "@/lib/coc6/check";
import { aiGmStateSchema, type StatBlock, type CheckOutcome } from "@/lib/coc6/types";
import type { DisplayMessage } from "./display";

function formatToolLine(data: Record<string, unknown>): string {
  const tool = data.tool as string;
  if (tool === "request_skill_check") {
    const label = OUTCOME_LABELS[data.outcome as CheckOutcome] ?? String(data.outcome);
    return `> 🎲 **${data.skill_name}** — 出目 ${data.roll} / 目標 ${data.target} → **${label}**`;
  }
  if (tool === "san_check") {
    const result = data.success ? "成功" : "失敗";
    return `> 🧠 **SANチェック** — 出目 ${data.roll} / ${data.target} → ${result} (SAN ${data.san_before} → ${data.san_after}、減少 ${data.loss})`;
  }
  return `> 🎲 ${data.reason ? `**${data.reason}** — ` : ""}${data.expression} → **${data.total}**`;
}

export function buildReplayMarkdown(
  session: AiGmSession,
  character: Character,
  messages: DisplayMessage[],
): string {
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
  const derived = deriveStats(stats);
  const state = aiGmStateSchema.safeParse(JSON.parse(session.stateJson));

  const lines: string[] = [
    `# ${session.title}`,
    "",
    `クトゥルフ神話TRPG(6版) リプレイ — キーパー: Claude`,
    "",
    `## 探索者`,
    "",
    `**${character.name}**${character.occupation ? ` (${character.occupation})` : ""}`,
    "",
    `| STR | CON | POW | DEX | APP | SIZ | INT | EDU |`,
    `|-----|-----|-----|-----|-----|-----|-----|-----|`,
    `| ${stats.str} | ${stats.con} | ${stats.pow} | ${stats.dex} | ${stats.app} | ${stats.siz} | ${stats.int_} | ${stats.edu} |`,
    "",
    `HP ${derived.hp} / MP ${derived.mp} / SAN ${derived.san} / DB ${derived.damageBonus}`,
    "",
    `## 本編`,
    "",
  ];

  for (const message of messages) {
    if (message.kind === "assistant") {
      lines.push(message.text, "");
    } else if (message.kind === "user") {
      lines.push(`**${character.name}**: ${message.text}`, "");
    } else if (message.kind === "tool") {
      lines.push(formatToolLine(message.data), "");
    }
  }

  if (state.success) {
    lines.push(
      `---`,
      "",
      `## セッション終了時`,
      "",
      `HP ${state.data.hp}/${state.data.maxHp} / MP ${state.data.mp}/${state.data.maxMp} / SAN ${state.data.san}/${state.data.maxSan}`,
      "",
    );
  }

  return lines.join("\n");
}

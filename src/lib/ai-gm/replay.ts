// AI GMセッションのログを読み物風Markdownに変換する。
// contentJsonの解釈はdisplay.tsのtoDisplayMessagesに一元化されているため、その出力を入力にとる。
import type { AiGmSession, Character } from "@prisma/client";
import { deriveStatsFor, type Edition } from "@/lib/coc";
import { OUTCOME_LABELS } from "@/lib/coc6/check";
import { aiGmStateSchema, type StatBlock, type CheckOutcome, type AiGmState } from "@/lib/coc6/types";
import type { DisplayMessage } from "./display";

export interface ReplayMember {
  character: Character;
  stateJson: string;
}

function formatToolLine(data: Record<string, unknown>): string {
  const tool = data.tool as string;
  const who = data.character_name ? `${data.character_name}の` : "";
  if (tool === "request_skill_check") {
    const label = OUTCOME_LABELS[data.outcome as CheckOutcome] ?? String(data.outcome);
    return `> 🎲 ${who}**${data.skill_name}** — 出目 ${data.roll} / 目標 ${data.target} → **${label}**`;
  }
  if (tool === "san_check") {
    const result = data.success ? "成功" : "失敗";
    return `> 🧠 ${who}**SANチェック** — 出目 ${data.roll} / ${data.target} → ${result} (SAN ${data.san_before} → ${data.san_after}、減少 ${data.loss})`;
  }
  if (tool === "madness_roll") {
    return `> 🌀 ${who}**狂気表** — 出目 ${data.roll} → **${data.title}** (持続: ${data.duration})`;
  }
  return `> 🎲 ${who}${data.reason ? `**${data.reason}** — ` : ""}${data.expression} → **${data.total}**`;
}

function characterSection(character: Character, edition: Edition): string[] {
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
  const derived = deriveStatsFor(edition, stats);
  return [
    `**${character.name}**${character.occupation ? ` (${character.occupation})` : ""}`,
    "",
    `| STR | CON | POW | DEX | APP | SIZ | INT | EDU |`,
    `|-----|-----|-----|-----|-----|-----|-----|-----|`,
    `| ${stats.str} | ${stats.con} | ${stats.pow} | ${stats.dex} | ${stats.app} | ${stats.siz} | ${stats.int_} | ${stats.edu} |`,
    "",
    `HP ${derived.hp} / MP ${derived.mp} / SAN ${derived.san} / DB ${derived.damageBonus}`,
    "",
  ];
}

export function buildReplayMarkdown(
  session: AiGmSession,
  members: ReplayMember[],
  messages: DisplayMessage[],
): string {
  const edition = members[0]?.character.edition === "7" ? "7" : "6";
  const lines: string[] = [
    `# ${session.title}`,
    "",
    `${edition === "7" ? "新クトゥルフ神話TRPG(7版)" : "クトゥルフ神話TRPG(6版)"} リプレイ — キーパー: Claude`,
    "",
    `## 探索者${members.length > 1 ? ` (${members.length}人)` : ""}`,
    "",
  ];

  for (const member of members) {
    lines.push(...characterSection(member.character, edition));
  }

  lines.push(`## 本編`, "");

  // 複数人の場合、user発言がどの探索者のものかは特定できないため「プレイヤー」と表記
  const speakerName =
    members.length === 1 ? members[0].character.name : "プレイヤー";

  for (const message of messages) {
    if (message.kind === "assistant") {
      lines.push(message.text, "");
    } else if (message.kind === "user") {
      lines.push(`**${speakerName}**: ${message.text}`, "");
    } else if (message.kind === "tool") {
      lines.push(formatToolLine(message.data), "");
    }
  }

  const finalStates = members
    .map((m) => {
      const parsed = aiGmStateSchema.safeParse(JSON.parse(m.stateJson));
      if (!parsed.success) return null;
      const s: AiGmState = parsed.data;
      return `${m.character.name}: HP ${s.hp}/${s.maxHp} / MP ${s.mp}/${s.maxMp} / SAN ${s.san}/${s.maxSan}`;
    })
    .filter(Boolean);

  if (finalStates.length > 0) {
    lines.push(`---`, "", `## セッション終了時`, "", ...finalStates.map((s) => `- ${s}`), "");
  }

  return lines.join("\n");
}

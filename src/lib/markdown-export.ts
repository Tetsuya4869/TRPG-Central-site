// Markdownエクスポート (Discord等への共有向け)。
// - buildCharacterMarkdown: 探索者シートをテキスト化してクリップボードへ
// - buildSessionLogMarkdown: 人間卓の卓ログ+ダイス履歴を時系列Markdownへ
import type { Character } from "@prisma/client";
import { deriveStatsFor, effectiveSkillsFor, type Edition } from "@/lib/coc";
import { skillsSchema, type StatBlock } from "@/lib/coc6/types";
import { parseWeaponsJson } from "@/lib/weapons";
import type { TimelineDice, TimelineLog } from "@/lib/ai-gm/summary";

export function buildCharacterMarkdown(character: Character): string {
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
  let skills: Record<string, number> = {};
  try {
    skills = skillsSchema.catch({}).parse(JSON.parse(character.skillsJson));
  } catch {
    // 壊れたJSONは技能なし扱い (シート本体の表示は別途防御済み)
  }
  const edition: Edition = character.edition === "7" ? "7" : "6";
  const derived = deriveStatsFor(edition, stats, skills["クトゥルフ神話"] ?? 0);
  const weapons = parseWeaponsJson(character.weaponsJson);

  const lines: string[] = [];
  lines.push(`# ${character.name}`);
  const profile = [
    `CoC ${edition}版`,
    character.occupation && `職業: ${character.occupation}`,
    character.age != null && `年齢: ${character.age}`,
    character.sex && `性別: ${character.sex}`,
    character.playerName && `PL: ${character.playerName}`,
  ].filter(Boolean);
  lines.push(profile.join(" / "));
  lines.push("");

  lines.push("## 能力値");
  lines.push("| STR | CON | POW | DEX | APP | SIZ | INT | EDU |");
  lines.push("|---|---|---|---|---|---|---|---|");
  lines.push(
    `| ${stats.str} | ${stats.con} | ${stats.pow} | ${stats.dex} | ${stats.app} | ${stats.siz} | ${stats.int_} | ${stats.edu} |`,
  );
  lines.push("");

  const vitals = [
    `HP ${character.currentHp}/${derived.hp}`,
    `MP ${character.currentMp}/${derived.mp}`,
    `SAN ${character.currentSan}/${derived.maxSan}`,
    `DB ${derived.damageBonus}`,
  ];
  if (edition === "7") {
    vitals.push(`幸運 ${character.luck ?? 0}`);
  } else {
    vitals.push(`アイデア ${derived.idea}`, `幸運 ${derived.luck}`, `知識 ${derived.knowledge}`);
  }
  lines.push(`**${vitals.join(" ・ ")}**`);
  lines.push("");

  // 技能: 割り振り済みのみ (初期値だけの技能で埋め尽くさない)
  const assigned = effectiveSkillsFor(edition, skills, stats)
    .filter((s) => s.assigned)
    .sort((a, b) => b.value - a.value);
  if (assigned.length > 0) {
    lines.push("## 技能");
    lines.push(assigned.map((s) => `${s.name} ${s.value}%`).join("、"));
    lines.push("");
  }

  if (weapons.length > 0) {
    lines.push("## 武器");
    for (const w of weapons) {
      lines.push(`- ${w.name} (${w.skillName} ${skills[w.skillName] ?? "-"}%) ダメージ ${w.damage}`);
    }
    lines.push("");
  }

  if (character.memo?.trim()) {
    lines.push("## メモ");
    lines.push(character.memo.trim());
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export interface SessionLogExportMeta {
  title: string;
  scenarioName?: string | null;
  scheduledAt?: Date | null;
}

const OUTCOME_LABELS: Record<string, string> = {
  CRITICAL: "クリティカル",
  EXTREME: "イクストリーム",
  HARD: "ハード",
  SUCCESS: "成功",
  FAILURE: "失敗",
  FUMBLE: "ファンブル",
};

const timeFmt = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
});

// 卓ログ(出来事メモ+ダイス履歴)を読み物として保存できるMarkdownにする
export function buildSessionLogMarkdown(
  meta: SessionLogExportMeta,
  logs: TimelineLog[],
  rolls: TimelineDice[],
): string {
  const lines: string[] = [];
  lines.push(`# 卓ログ: ${meta.title}`);
  const sub = [
    meta.scenarioName && `シナリオ: ${meta.scenarioName}`,
    meta.scheduledAt &&
      `開催日: ${new Intl.DateTimeFormat("ja-JP", { dateStyle: "long" }).format(meta.scheduledAt)}`,
  ].filter(Boolean);
  if (sub.length > 0) lines.push(sub.join(" / "));
  lines.push("");

  const kindLabel: Record<string, string> = {
    EVENT: "📌",
    NOTE: "📝",
    SCENE: "🎬",
    SUMMARY: "📖",
  };

  const items: { at: number; line: string }[] = [
    ...logs.map((l) => ({
      at: l.createdAt.getTime(),
      line: `- ${timeFmt.format(l.createdAt)} ${kindLabel[l.kind] ?? "📌"} ${l.body}`,
    })),
    ...rolls.map((r) => {
      const outcome = r.outcome ? ` **${OUTCOME_LABELS[r.outcome] ?? r.outcome}**` : "";
      const who = r.characterName ? `${r.characterName} ` : "";
      const target = r.target != null ? `/${r.target}` : "";
      return {
        at: r.createdAt.getTime(),
        line: `- ${timeFmt.format(r.createdAt)} 🎲 ${who}${r.context ?? "ロール"} → ${r.total}${target}${outcome}`,
      };
    }),
  ].sort((a, b) => a.at - b.at);

  if (items.length === 0) {
    lines.push("(記録はありません)");
  } else {
    lines.push(...items.map((i) => i.line));
  }
  return lines.join("\n") + "\n";
}

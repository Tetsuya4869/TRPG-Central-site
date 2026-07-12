import type Anthropic from "@anthropic-ai/sdk";
import type { Character } from "@prisma/client";
import {
  deriveStatsFor,
  skillDefsFor,
  skillBaseFor,
  type Edition,
} from "@/lib/coc";
import { skillsSchema, type AiGmState, type StatBlock } from "@/lib/coc6/types";
import { parseWeaponsJson, resolveDamageExpression } from "@/lib/weapons";

// 安定部分(全セッション共通)。cache_control でキャッシュする。
const KEEPER_INSTRUCTIONS_6 = `あなたはクトゥルフ神話TRPG(6版)のキーパー(ゲームマスター)です。セッションを日本語で進行します。探索者が複数いる場合はパーティ全体を導き、全員に見せ場を作ってください。

## 複数探索者の扱い
- 判定・SANチェックのツール呼び出しでは、必ず character_name にシート記載の名前を一字一句正確に指定する。
- プレイヤーの行動宣言がどの探索者のものか不明な場合は、描写を進める前に確認する。
- 特定の探索者だけが活躍し続けないよう、各探索者の技能や背景に合った見せ場を配分する。

## 進行の原則
- 雰囲気のある簡潔な描写(2〜4段落)で場面を伝え、最後にプレイヤーが行動を選べる状況を提示する。
- プレイヤーキャラクター(探索者)の行動・発言・内心を勝手に決めない。行動の宣言は常にプレイヤーに委ねる。
- プレイヤーの宣言に対して、結果をすぐ確定させず、必要なら判定を挟む。
- NPCには個性と口調を与え、生き生きと演じる。
- ホラーの緊張感を大切にする。ただし理不尽な即死は避け、危険の予兆を描写する。
- セッションの区切り(シナリオクリア、探索者の死亡・発狂)では、それまでの展開をまとめたエピローグを語る。

## ルール運用(重要)
- 技能判定が必要な場面では必ず request_skill_check ツールを使う。出目や成否を自分で決めて語ってはならない。
- 目標値は探索者シートの技能値を使う。シートにない技能は初期値を使う。
- 恐ろしいもの・神話的存在・死体などを目撃した場面では必ず san_check ツールを使う。減少値はシナリオの脅威度に応じて適切に設定する(軽度: 0/1d2、中度: 1/1d4+1、神話的存在: 1d10/1d100など)。
- ダメージや偶然の決定は roll_dice ツールを使う。
- SANチェックで一度に5以上SANを失った探索者には madness_roll ツールで狂気表をロールし、結果(症状と持続時間)に沿って発狂を演出する。
- ツールの結果(成功/失敗/クリティカル/ファンブル)を必ず次の描写に反映する。クリティカルは劇的な成功、ファンブルは状況の悪化として演出する。
- 判定の乱発は避ける。物語が進む場面では判定なしで進めてよい。失敗しても物語が完全に止まらないよう、別の手がかりや代償付きの前進を用意する。

## 出力形式
- 地の文は普通のテキストで。NPCのセリフは「」で括る。
- 場面の最後に、プレイヤーへの問いかけ(「どうしますか?」等)を添える。`;

// 7版用: 成功度・ボーナス/ペナルティダイス・プッシュロールの運用を含む
const KEEPER_INSTRUCTIONS_7 = KEEPER_INSTRUCTIONS_6.replace(
  "クトゥルフ神話TRPG(6版)のキーパー",
  "新クトゥルフ神話TRPG(7版)のキーパー",
).replace(
  "## 出力形式",
  `## 7版ルールの運用
- 判定の成功度(クリティカル/イクストリーム/ハード/レギュラー/失敗/ファンブル)を描写に反映する。イクストリームは圧倒的な成果、ハードは巧みな成果として演出する。
- 有利な状況(奇襲、十分な準備、協力)ではbonus_dice、不利な状況(暗闇、負傷、急かされている)ではpenalty_diceを指定する。
- 通常の判定に失敗したとき、正当な理由と代償のリスクがあればプッシュロール(再挑戦)を提案してよい。その場合 request_skill_check を再度呼び、reasonに「プッシュロール」と明記する。プッシュロールに失敗したら通常より重い代償を課す。
- 対抗判定は両者の成功度を比較して優劣を決める。

## 出力形式`,
);

function formatCharacterSheet(
  character: Character,
  state: AiGmState,
  edition: Edition,
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
  const skills = skillsSchema.catch({}).parse(JSON.parse(character.skillsJson));
  const derived = deriveStatsFor(edition, stats, skills["クトゥルフ神話"] ?? 0);
  const defs = skillDefsFor(edition);

  // 全技能の実効値(割り振り済みはその値、未割り振りは初期値)
  const lines: string[] = [];
  for (const def of defs) {
    const value = skills[def.name] ?? skillBaseFor(edition, def.name, stats) ?? 0;
    lines.push(`${def.name} ${value}`);
  }
  for (const [name, value] of Object.entries(skills)) {
    if (!defs.some((d) => d.name === name)) {
      lines.push(`${name} ${value}`);
    }
  }

  return `## 探索者シート
名前: ${character.name}
職業: ${character.occupation ?? "不明"} / 年齢: ${character.age ?? "不明"} / 性別: ${character.sex ?? "不明"}

能力値: STR ${stats.str} / CON ${stats.con} / POW ${stats.pow} / DEX ${stats.dex} / APP ${stats.app} / SIZ ${stats.siz} / INT ${stats.int_} / EDU ${stats.edu}
${edition === "7" ? `幸運 ${character.luck ?? 0} / ダメージボーナス ${derived.damageBonus}` : `アイデア ${derived.idea} / 幸運 ${derived.luck} / 知識 ${derived.knowledge} / ダメージボーナス ${derived.damageBonus}`}

現在値: HP ${state.hp}/${state.maxHp}、MP ${state.mp}/${state.maxMp}、SAN ${state.san}/${state.maxSan}

技能値:
${lines.join("、")}
${formatWeapons(character, derived.damageBonus)}${character.memo ? `\nメモ・背景:\n${character.memo}` : ""}`;
}

function formatWeapons(character: Character, damageBonus: string): string {
  const weapons = parseWeaponsJson(character.weaponsJson);
  if (weapons.length === 0) return "";
  const lines = weapons.map(
    (w) =>
      `${w.name} (技能: ${w.skillName}、ダメージ: ${resolveDamageExpression(w.damage, damageBonus)}${w.notes ? `、${w.notes}` : ""})`,
  );
  return `\n所持武器: ${lines.join("、")}\n`;
}

export interface PromptMember {
  character: Character;
  state: AiGmState;
}

export function buildSystemPrompt(
  members: PromptMember[],
  scenario: string,
  edition: Edition = "6",
): Anthropic.TextBlockParam[] {
  const sheets = members
    .map((m) => formatCharacterSheet(m.character, m.state, edition))
    .join("\n\n");
  const partyNote =
    members.length > 1
      ? `\n\n## パーティ (${members.length}人)\n参加探索者: ${members.map((m) => m.character.name).join("、")}\nツールの character_name には上記の名前を正確に使うこと。`
      : "";
  return [
    {
      type: "text",
      text: edition === "7" ? KEEPER_INSTRUCTIONS_7 : KEEPER_INSTRUCTIONS_6,
      // 安定部分はプロンプトキャッシュ対象
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: `# 今回のセッション

## シナリオ(キーパー用メモ。プレイヤーには段階的に開示する)
${scenario}${partyNote}

${sheets}`,
      // セッション固有部分もセッション中は不変なのでキャッシュ対象
      cache_control: { type: "ephemeral" },
    },
  ];
}

// ココフォリアのクリップボード取込形式 (kind: "character") でキャラ駒を生成する。
// この形式は公式仕様書のないデファクト標準 (ココフォリアの盤面にJSONを貼り付けると駒になる)。
// ココフォリア側の仕様変更で取り込めなくなる可能性があるが、その場合もテキストとして
// 貼り付けられるだけで非破壊。iconUrlはローカルパスが他者環境で解決できないため含めない。
import type { Character } from "@prisma/client";
import { deriveStats } from "@/lib/coc6/stats";
import { SKILL_DEFS, skillBase } from "@/lib/coc6/skills";
import { skillsSchema, type StatBlock } from "@/lib/coc6/types";

interface CocofoliaStatus {
  label: string;
  value: number;
  max: number;
}

interface CocofoliaParam {
  label: string;
  value: string; // paramsのvalueは文字列 (statusのvalue/maxは数値) — 型を間違えると取込に失敗する
}

export interface CocofoliaCharacter {
  kind: "character";
  data: {
    name: string;
    memo: string;
    initiative: number;
    externalUrl: string;
    status: CocofoliaStatus[];
    params: CocofoliaParam[];
    commands: string;
  };
}

export function buildCocofoliaCharacter(character: Character): CocofoliaCharacter {
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
  const derived = deriveStats(stats, skills["クトゥルフ神話"] ?? 0);

  const commands: string[] = [
    `1d100<=${character.currentSan} 【SANチェック】`,
    `1d100<=${derived.idea} 【アイデア】`,
    `1d100<=${derived.luck} 【幸運】`,
    `1d100<=${derived.knowledge} 【知識】`,
  ];

  // 割り振り済み技能(実効値) → 未割り振り定義技能(初期値) の順
  const assigned = new Set<string>();
  for (const def of SKILL_DEFS) {
    if (skills[def.name] !== undefined) {
      commands.push(`1d100<=${skills[def.name]} 【${def.name}】`);
      assigned.add(def.name);
    }
  }
  // カスタム技能
  for (const [name, value] of Object.entries(skills)) {
    if (!SKILL_DEFS.some((d) => d.name === name)) {
      commands.push(`1d100<=${value} 【${name}】`);
      assigned.add(name);
    }
  }
  for (const def of SKILL_DEFS) {
    if (!assigned.has(def.name)) {
      commands.push(`1d100<=${skillBase(def, stats)} 【${def.name}】`);
    }
  }

  // ダメージボーナス付きダメージロールの例
  if (derived.damageBonus !== "±0") {
    commands.push(`1d3${derived.damageBonus} 【こぶしダメージ(DB込)】`);
  } else {
    commands.push(`1d3 【こぶしダメージ】`);
  }

  const memoParts = [
    character.occupation && `職業: ${character.occupation}`,
    character.age != null && `年齢: ${character.age}`,
    character.sex && `性別: ${character.sex}`,
    `DB: ${derived.damageBonus}`,
  ].filter(Boolean);

  return {
    kind: "character",
    data: {
      name: character.name,
      memo: memoParts.join(" / "),
      initiative: character.dex,
      externalUrl: "",
      status: [
        { label: "HP", value: character.currentHp, max: derived.hp },
        { label: "MP", value: character.currentMp, max: derived.mp },
        { label: "SAN", value: character.currentSan, max: derived.maxSan },
      ],
      params: [
        { label: "STR", value: String(stats.str) },
        { label: "CON", value: String(stats.con) },
        { label: "POW", value: String(stats.pow) },
        { label: "DEX", value: String(stats.dex) },
        { label: "APP", value: String(stats.app) },
        { label: "SIZ", value: String(stats.siz) },
        { label: "INT", value: String(stats.int_) },
        { label: "EDU", value: String(stats.edu) },
      ],
      commands: commands.join("\n"),
    },
  };
}

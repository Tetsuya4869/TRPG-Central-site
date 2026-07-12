// ココフォリアのクリップボード取込形式 (kind: "character") でキャラ駒を生成する。
// この形式は公式仕様書のないデファクト標準 (ココフォリアの盤面にJSONを貼り付けると駒になる)。
// ココフォリア側の仕様変更で取り込めなくなる可能性があるが、その場合もテキストとして
// 貼り付けられるだけで非破壊。iconUrlはローカルパスが他者環境で解決できないため含めない。
import type { Character } from "@prisma/client";
import {
  deriveStatsFor,
  skillDefsFor,
  skillBaseFor,
  effectiveSkillsFor,
  type Edition,
} from "@/lib/coc";
import { skillsSchema, type StatBlock } from "@/lib/coc6/types";
import { parseWeaponsJson, resolveDamageExpression } from "@/lib/weapons";

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
  const edition: Edition = character.edition === "7" ? "7" : "6";
  const derived = deriveStatsFor(edition, stats, skills["クトゥルフ神話"] ?? 0);

  // 7版はCC(1d100成功度判定)コマンド、6版は1d100<=
  const check = (value: number, label: string) =>
    edition === "7" ? `CC<=${value} 【${label}】` : `1d100<=${value} 【${label}】`;

  const commands: string[] =
    edition === "7"
      ? [
          check(character.currentSan, "SANチェック"),
          check(character.luck ?? 0, "幸運"),
          check(stats.int_, "アイデア"),
          check(stats.edu, "知識"),
        ]
      : [
          check(character.currentSan, "SANチェック"),
          check(derived.idea, "アイデア"),
          check(derived.luck, "幸運"),
          check(derived.knowledge, "知識"),
        ];

  // 割り振り済み技能(実効値) → 未割り振り定義技能(初期値) の順
  const effective = effectiveSkillsFor(edition, skills, stats);
  for (const s of effective.filter((s) => s.assigned)) {
    commands.push(check(s.value, s.name));
  }
  for (const def of skillDefsFor(edition)) {
    if (skills[def.name] === undefined) {
      commands.push(check(skillBaseFor(edition, def.name, stats) ?? 0, def.name));
    }
  }

  // 登録武器: 命中判定+ダメージ(DB解決済み)をセットで出す
  const weapons = parseWeaponsJson(character.weaponsJson);
  for (const w of weapons) {
    const skillValue =
      effective.find((s) => s.name === w.skillName)?.value ??
      skillBaseFor(edition, w.skillName, stats) ??
      0;
    commands.push(check(skillValue, `${w.name}攻撃`));
    commands.push(
      `${resolveDamageExpression(w.damage, derived.damageBonus)} 【${w.name}ダメージ】`,
    );
  }

  // ダメージボーナス付きダメージロールの例 (武器未登録時の素手)
  if (weapons.length === 0) {
    if (derived.damageBonus !== "±0") {
      commands.push(`1d3${derived.damageBonus} 【こぶしダメージ(DB込)】`);
    } else {
      commands.push(`1d3 【こぶしダメージ】`);
    }
  }

  const memoParts = [
    `CoC${edition}版`,
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
        ...(edition === "7"
          ? [{ label: "幸運", value: character.luck ?? 0, max: 99 }]
          : []),
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

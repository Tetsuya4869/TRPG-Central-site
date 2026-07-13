// Charaeno (新クトゥルフ神話TRPG=7版 のキャラ保管サイト) のエクスポートJSONを
// 当サイトの探索者データ (characterInputSchema 準拠) へ変換する。
// cocofolia.ts (内部→外部) の対称にあたる、外部→内部の変換。
//
// Charaeno JSON の構造 (Foundry VTT インポートマクロで確認):
//   { name, occupation, age, sex,
//     characteristics: { str, con, siz, dex, app, int, pow, edu },  // 7版は×5フルバリュー
//     attribute: { hp, mp, san: {value} | number, luck, db, build },
//     skills: [ { name, value }, ... ] }
// 武器は possessions に自由記述で入るため構造化されておらず、取り込まない。
import type { CharacterInput } from "@/lib/coc6/types";
import { SKILL_DEFS_7 } from "@/lib/coc7/skills";
import { SKILL_DEFS } from "@/lib/coc6/skills";

// number または { value: number } を数値にする
function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object" && "value" in v) {
    const inner = (v as { value: unknown }).value;
    if (typeof inner === "number" && Number.isFinite(inner)) return inner;
  }
  return NaN;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// Charaeno技能名 → 当サイトのマスタ名 の正規化。既知の表記ゆれのみ補正し、
// マッチしないものはカスタム技能としてそのまま保存する (skillsSchemaはキー名を検証しない)。
const SKILL_ALIASES: Record<string, string> = {
  拳銃: "射撃(拳銃)",
  マーシャルアーツ: "近接戦闘(格闘)",
  こぶし: "近接戦闘(格闘)",
  "こぶし(パンチ)": "近接戦闘(格闘)",
  キック: "近接戦闘(格闘)",
  組み付き: "近接戦闘(格闘)",
  忍び歩き: "隠密",
  隠れる: "隠密",
  写真術: "芸術/製作",
  芸術: "芸術/製作",
  博物学: "自然",
  生物学: "科学",
  化学: "科学",
  物理学: "科学",
  地質学: "科学",
  天文学: "科学",
  電子工学: "電気修理",
  薬学: "科学",
};

function normalizeSkillName(raw: string, edition: "6" | "7"): string {
  const name = raw.trim().replace(/\s+/g, "");
  const defs = edition === "7" ? SKILL_DEFS_7 : SKILL_DEFS;
  // 完全一致
  if (defs.some((d) => d.name === name)) return name;
  // 別名表 (7版のマスタに寄せる)
  if (edition === "7" && SKILL_ALIASES[name]) return SKILL_ALIASES[name];
  // 「母国語(日本語)」等の言語指定付きは母国語に寄せる
  if (name.startsWith("母国語")) return "母国語";
  return name; // カスタム技能として保存
}

export interface CharaenoParseResult {
  input: CharacterInput;
  // プレビュー・警告用のメタ情報
  detectedEdition: "6" | "7";
  skillCount: number;
  unknownSkills: string[]; // マスタにない技能名 (カスタム扱い)
}

export function parseCharaenoCharacter(raw: unknown): CharaenoParseResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("JSONオブジェクトではありません");
  }
  const data = raw as Record<string, unknown>;
  const chars = data.characteristics as Record<string, unknown> | undefined;
  if (!chars || typeof chars !== "object") {
    throw new Error("characteristics が見つかりません (Charaenoのエクスポートではない可能性があります)");
  }

  const rawStats = {
    str: num(chars.str),
    con: num(chars.con),
    pow: num(chars.pow),
    dex: num(chars.dex),
    app: num(chars.app),
    siz: num(chars.siz),
    int_: num(chars.int),
    edu: num(chars.edu),
  };
  const values = Object.values(rawStats);
  if (values.some((v) => Number.isNaN(v))) {
    throw new Error("能力値 (STR/CON/POW/DEX/APP/SIZ/INT/EDU) の一部が読み取れません");
  }

  // 版判別: Charaenoは7版(×5フルバリュー)。ただし全能力値が明らかに生値(≤24)なら6版とみなす
  // (7版で8能力値すべてが×5後24以下=平均5未満は事実上ありえない)。
  const detectedEdition: "6" | "7" = values.every((v) => v <= 24) ? "6" : "7";

  // 能力値は範囲[1,99]にクランプ (7版×5後の最大は90前後で収まる)
  const clamp99 = (n: number) => Math.max(1, Math.min(99, Math.round(n)));
  const stats = {
    str: clamp99(rawStats.str),
    con: clamp99(rawStats.con),
    pow: clamp99(rawStats.pow),
    dex: clamp99(rawStats.dex),
    app: clamp99(rawStats.app),
    siz: clamp99(rawStats.siz),
    int_: clamp99(rawStats.int_),
    edu: clamp99(rawStats.edu),
  };

  const attr = (data.attribute as Record<string, unknown> | undefined) ?? {};
  const luckVal = num(attr.luck);
  const sanVal = num(attr.san);
  const hpVal = num(attr.hp);
  const mpVal = num(attr.mp);

  // 技能: [{name, value}] を name→value マップへ (最終値をそのまま保存)
  const skills: Record<string, number> = {};
  const unknownSkills: string[] = [];
  const defs = detectedEdition === "7" ? SKILL_DEFS_7 : SKILL_DEFS;
  const rawSkills = Array.isArray(data.skills) ? data.skills : [];
  for (const s of rawSkills) {
    if (!s || typeof s !== "object") continue;
    const sname = str((s as Record<string, unknown>).name);
    const sval = num((s as Record<string, unknown>).value);
    if (!sname || Number.isNaN(sval)) continue;
    const normalized = normalizeSkillName(sname, detectedEdition);
    skills[normalized] = Math.max(0, Math.min(100, Math.round(sval)));
    if (!defs.some((d) => d.name === normalized)) unknownSkills.push(normalized);
  }

  // 年齢: number か string
  const ageRaw = data.age;
  let age: number | null = null;
  if (typeof ageRaw === "number" && Number.isFinite(ageRaw)) age = Math.round(ageRaw);
  else if (typeof ageRaw === "string" && /^\d+$/.test(ageRaw.trim())) age = parseInt(ageRaw, 10);
  if (age != null) age = Math.max(1, Math.min(999, age));

  const note = str(data.note);
  const residence = str(data.residence);
  const birthplace = str(data.birthplace);
  const memoParts = [
    note,
    residence && `居住地: ${residence}`,
    birthplace && `出身: ${birthplace}`,
    "(Charaenoからインポート。武器は取り込まれないため手動で登録してください)",
  ].filter(Boolean);

  const input: CharacterInput = {
    edition: detectedEdition,
    name: str(data.name) ?? "名称未設定",
    playerName: null,
    occupation: str(data.occupation),
    age,
    sex: str(data.sex),
    imageUrl: null,
    ...stats,
    luck: detectedEdition === "7" && !Number.isNaN(luckVal)
      ? Math.max(0, Math.min(99, Math.round(luckVal)))
      : null,
    skills,
    weapons: [],
    memo: memoParts.join("\n").slice(0, 10000),
    // 現在値はCharaenoの値があれば渡す (作成APIが派生上限でクランプする)
    ...(Number.isNaN(hpVal) ? {} : { currentHp: Math.max(0, Math.round(hpVal)) }),
    ...(Number.isNaN(mpVal) ? {} : { currentMp: Math.max(0, Math.round(mpVal)) }),
    ...(Number.isNaN(sanVal) ? {} : { currentSan: Math.max(0, Math.round(sanVal)) }),
  };

  return {
    input,
    detectedEdition,
    skillCount: Object.keys(skills).length,
    unknownSkills,
  };
}

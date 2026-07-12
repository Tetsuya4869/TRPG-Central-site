// CoC 6版 技能マスタ(日本語名+初期値)。
// 回避=DEX×2、母国語=EDU×5 は能力値依存のため関数で解決する。
import type { StatBlock, Skills } from "./types";

export interface SkillDef {
  name: string;
  category: "戦闘" | "探索" | "行動" | "交渉" | "知識";
  base: number | "DEX*2" | "EDU*5";
}

export const SKILL_DEFS: SkillDef[] = [
  // 戦闘系
  { name: "回避", category: "戦闘", base: "DEX*2" },
  { name: "キック", category: "戦闘", base: 25 },
  { name: "組み付き", category: "戦闘", base: 25 },
  { name: "こぶし(パンチ)", category: "戦闘", base: 50 },
  { name: "頭突き", category: "戦闘", base: 10 },
  { name: "投擲", category: "戦闘", base: 25 },
  { name: "マーシャルアーツ", category: "戦闘", base: 1 },
  { name: "拳銃", category: "戦闘", base: 20 },
  { name: "サブマシンガン", category: "戦闘", base: 15 },
  { name: "ショットガン", category: "戦闘", base: 30 },
  { name: "マシンガン", category: "戦闘", base: 15 },
  { name: "ライフル", category: "戦闘", base: 25 },
  // 探索系
  { name: "応急手当", category: "探索", base: 30 },
  { name: "鍵開け", category: "探索", base: 1 },
  { name: "隠す", category: "探索", base: 15 },
  { name: "隠れる", category: "探索", base: 10 },
  { name: "聞き耳", category: "探索", base: 25 },
  { name: "忍び歩き", category: "探索", base: 10 },
  { name: "写真術", category: "探索", base: 10 },
  { name: "精神分析", category: "探索", base: 1 },
  { name: "追跡", category: "探索", base: 10 },
  { name: "登攀", category: "探索", base: 40 },
  { name: "図書館", category: "探索", base: 25 },
  { name: "目星", category: "探索", base: 25 },
  // 行動系
  { name: "運転(自動車)", category: "行動", base: 20 },
  { name: "機械修理", category: "行動", base: 20 },
  { name: "重機械操作", category: "行動", base: 1 },
  { name: "乗馬", category: "行動", base: 5 },
  { name: "水泳", category: "行動", base: 25 },
  { name: "製作", category: "行動", base: 5 },
  { name: "操縦", category: "行動", base: 1 },
  { name: "跳躍", category: "行動", base: 25 },
  { name: "電気修理", category: "行動", base: 10 },
  { name: "ナビゲート", category: "行動", base: 10 },
  { name: "変装", category: "行動", base: 1 },
  // 交渉系
  { name: "言いくるめ", category: "交渉", base: 5 },
  { name: "信用", category: "交渉", base: 15 },
  { name: "説得", category: "交渉", base: 15 },
  { name: "値切り", category: "交渉", base: 5 },
  { name: "母国語", category: "交渉", base: "EDU*5" },
  { name: "ほかの言語", category: "交渉", base: 1 },
  // 知識系
  { name: "医学", category: "知識", base: 5 },
  { name: "オカルト", category: "知識", base: 5 },
  { name: "化学", category: "知識", base: 1 },
  { name: "クトゥルフ神話", category: "知識", base: 0 },
  { name: "芸術", category: "知識", base: 5 },
  { name: "経理", category: "知識", base: 10 },
  { name: "考古学", category: "知識", base: 1 },
  { name: "コンピューター", category: "知識", base: 1 },
  { name: "心理学", category: "知識", base: 5 },
  { name: "人類学", category: "知識", base: 1 },
  { name: "生物学", category: "知識", base: 1 },
  { name: "地質学", category: "知識", base: 1 },
  { name: "電子工学", category: "知識", base: 1 },
  { name: "天文学", category: "知識", base: 1 },
  { name: "博物学", category: "知識", base: 10 },
  { name: "物理学", category: "知識", base: 1 },
  { name: "法律", category: "知識", base: 5 },
  { name: "薬学", category: "知識", base: 1 },
  { name: "歴史", category: "知識", base: 20 },
];

export function skillBase(def: SkillDef, stats: StatBlock): number {
  if (def.base === "DEX*2") return stats.dex * 2;
  // EDU最大21 → 105。skillsSchemaの上限(100)と1d100判定に収まるよう99にクランプ
  if (def.base === "EDU*5") return Math.min(99, stats.edu * 5);
  return def.base;
}

// 全技能の初期値マップを返す
export function baseSkills(stats: StatBlock): Skills {
  const skills: Skills = {};
  for (const def of SKILL_DEFS) {
    skills[def.name] = skillBase(def, stats);
  }
  return skills;
}

// 割り振り済み技能値と初期値の差分合計 = 消費ポイント
export function spentPoints(skills: Skills, stats: StatBlock): number {
  let spent = 0;
  const defs = new Map(SKILL_DEFS.map((d) => [d.name, d]));
  for (const [name, value] of Object.entries(skills)) {
    const def = defs.get(name);
    const base = def ? skillBase(def, stats) : 0; // カスタム技能は初期値0扱い
    if (value > base) spent += value - base;
  }
  return spent;
}

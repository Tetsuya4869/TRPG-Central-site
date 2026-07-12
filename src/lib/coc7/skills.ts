// CoC 7版 技能マスタ(日本語名+初期値)。SkillDef型はcoc6と共用。
// 回避=floor(DEX/2)、母国語=EDU は能力値依存のため関数で解決する。
import type { StatBlock } from "@/lib/coc6/types";

export interface SkillDef7 {
  name: string;
  category: "戦闘" | "探索" | "行動" | "交渉" | "知識";
  base: number | "DEX/2" | "EDU";
}

export const SKILL_DEFS_7: SkillDef7[] = [
  // 戦闘系
  { name: "回避", category: "戦闘", base: "DEX/2" },
  { name: "近接戦闘(格闘)", category: "戦闘", base: 25 },
  { name: "近接戦闘(刀剣)", category: "戦闘", base: 20 },
  { name: "投擲", category: "戦闘", base: 20 },
  { name: "射撃(拳銃)", category: "戦闘", base: 20 },
  { name: "射撃(ライフル/ショットガン)", category: "戦闘", base: 25 },
  // 探索系
  { name: "応急手当", category: "探索", base: 30 },
  { name: "鍵開け", category: "探索", base: 1 },
  { name: "手さばき", category: "探索", base: 10 },
  { name: "聞き耳", category: "探索", base: 20 },
  { name: "隠密", category: "探索", base: 20 },
  { name: "精神分析", category: "探索", base: 1 },
  { name: "追跡", category: "探索", base: 10 },
  { name: "登攀", category: "探索", base: 20 },
  { name: "図書館", category: "探索", base: 20 },
  { name: "目星", category: "探索", base: 25 },
  { name: "鑑定", category: "探索", base: 5 },
  // 行動系
  { name: "運転(自動車)", category: "行動", base: 20 },
  { name: "機械修理", category: "行動", base: 10 },
  { name: "重機械操作", category: "行動", base: 1 },
  { name: "乗馬", category: "行動", base: 5 },
  { name: "水泳", category: "行動", base: 20 },
  { name: "製作", category: "行動", base: 5 },
  { name: "操縦", category: "行動", base: 1 },
  { name: "跳躍", category: "行動", base: 20 },
  { name: "電気修理", category: "行動", base: 10 },
  { name: "ナビゲート", category: "行動", base: 10 },
  { name: "変装", category: "行動", base: 5 },
  { name: "サバイバル", category: "行動", base: 10 },
  // 交渉系
  { name: "言いくるめ", category: "交渉", base: 5 },
  { name: "威圧", category: "交渉", base: 15 },
  { name: "信用", category: "交渉", base: 0 },
  { name: "説得", category: "交渉", base: 10 },
  { name: "魅惑", category: "交渉", base: 15 },
  { name: "母国語", category: "交渉", base: "EDU" },
  { name: "ほかの言語", category: "交渉", base: 1 },
  // 知識系
  { name: "医学", category: "知識", base: 1 },
  { name: "オカルト", category: "知識", base: 5 },
  { name: "科学", category: "知識", base: 1 },
  { name: "クトゥルフ神話", category: "知識", base: 0 },
  { name: "芸術/製作", category: "知識", base: 5 },
  { name: "経理", category: "知識", base: 5 },
  { name: "考古学", category: "知識", base: 1 },
  { name: "コンピューター", category: "知識", base: 5 },
  { name: "心理学", category: "知識", base: 10 },
  { name: "人類学", category: "知識", base: 1 },
  { name: "自然", category: "知識", base: 10 },
  { name: "法律", category: "知識", base: 5 },
  { name: "歴史", category: "知識", base: 5 },
];

export function skillBase7(def: SkillDef7, stats: StatBlock): number {
  if (def.base === "DEX/2") return Math.floor(stats.dex / 2);
  if (def.base === "EDU") return stats.edu;
  return def.base;
}

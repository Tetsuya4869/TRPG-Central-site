// CoC 6版の能力値ロールと派生値計算。純関数のみ。
import { rollDice, type Rng } from "@/lib/dice";
import type { StatBlock } from "./types";

export interface DerivedStats {
  san: number; // 正気度 = POW×5
  maxSan: number; // 最大正気度 = 99 - クトゥルフ神話技能 (簡易版では99)
  hp: number; // 耐久力 = ceil((CON+SIZ)/2)
  mp: number; // マジックポイント = POW
  idea: number; // アイデア = INT×5
  luck: number; // 幸運 = POW×5
  knowledge: number; // 知識 = EDU×5
  damageBonus: string; // ダメージボーナス
  occupationPoints: number; // 職業技能ポイント = EDU×20
  hobbyPoints: number; // 趣味技能ポイント = INT×10
}

// 6版の能力値決定: STR/CON/POW/DEX/APP=3d6, SIZ/INT=2d6+6, EDU=3d6+3
export function rollStats(rng: Rng = Math.random): StatBlock {
  return {
    str: rollDice("3d6", rng).total,
    con: rollDice("3d6", rng).total,
    pow: rollDice("3d6", rng).total,
    dex: rollDice("3d6", rng).total,
    app: rollDice("3d6", rng).total,
    siz: rollDice("2d6+6", rng).total,
    int_: rollDice("2d6+6", rng).total,
    edu: rollDice("3d6+3", rng).total,
  };
}

export const STAT_DICE: Record<keyof StatBlock, string> = {
  str: "3d6",
  con: "3d6",
  pow: "3d6",
  dex: "3d6",
  app: "3d6",
  siz: "2d6+6",
  int_: "2d6+6",
  edu: "3d6+3",
};

export function damageBonus(str: number, siz: number): string {
  const sum = str + siz;
  if (sum <= 12) return "-1d6";
  if (sum <= 16) return "-1d4";
  if (sum <= 24) return "±0";
  if (sum <= 32) return "+1d4";
  if (sum <= 40) return "+1d6";
  // 41以上は8ごとに+1d6 (6版ルール)
  const extra = Math.floor((sum - 41) / 16) + 2;
  return `+${extra}d6`;
}

export function deriveStats(stats: StatBlock, cthulhuMythos = 0): DerivedStats {
  return {
    san: stats.pow * 5,
    maxSan: 99 - cthulhuMythos,
    hp: Math.ceil((stats.con + stats.siz) / 2),
    mp: stats.pow,
    idea: stats.int_ * 5,
    luck: stats.pow * 5,
    knowledge: stats.edu * 5,
    damageBonus: damageBonus(stats.str, stats.siz),
    occupationPoints: stats.edu * 20,
    hobbyPoints: stats.int_ * 10,
  };
}

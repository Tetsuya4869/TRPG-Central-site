// CoC 7版の能力値ロールと派生値計算。能力値は×5後のフルバリュー(15〜90)を格納する。
import { rollDice, type Rng } from "@/lib/dice";
import type { StatBlock } from "@/lib/coc6/types";
import type { DerivedStats } from "@/lib/coc6/stats";

// 7版の能力値決定: STR/CON/DEX/APP/POW = 3d6×5、SIZ/INT/EDU = (2d6+6)×5
export function rollStats7(rng: Rng = Math.random): StatBlock {
  return {
    str: rollDice("3d6", rng).total * 5,
    con: rollDice("3d6", rng).total * 5,
    pow: rollDice("3d6", rng).total * 5,
    dex: rollDice("3d6", rng).total * 5,
    app: rollDice("3d6", rng).total * 5,
    siz: rollDice("2d6+6", rng).total * 5,
    int_: rollDice("2d6+6", rng).total * 5,
    edu: rollDice("2d6+6", rng).total * 5,
  };
}

export const STAT_DICE_7: Record<keyof StatBlock, string> = {
  str: "3d6×5",
  con: "3d6×5",
  pow: "3d6×5",
  dex: "3d6×5",
  app: "3d6×5",
  siz: "(2d6+6)×5",
  int_: "(2d6+6)×5",
  edu: "(2d6+6)×5",
};

// 幸運は独立ロール (3d6×5)
export function rollLuck7(rng: Rng = Math.random): number {
  return rollDice("3d6", rng).total * 5;
}

// 7版のダメージボーナス/ビルド (STR+SIZ、×5値のまま)
export function damageBonus7(str: number, siz: number): { db: string; build: number } {
  const sum = str + siz;
  if (sum <= 64) return { db: "-2", build: -2 };
  if (sum <= 84) return { db: "-1", build: -1 };
  if (sum <= 124) return { db: "±0", build: 0 };
  if (sum <= 164) return { db: "+1d4", build: 1 };
  if (sum <= 204) return { db: "+1d6", build: 2 };
  // 205以上は80ごとに+1d6/build+1 (簡易: 実用域のみ)
  return { db: "+2d6", build: 3 };
}

export function deriveStats7(stats: StatBlock, cthulhuMythos = 0): DerivedStats {
  const { db } = damageBonus7(stats.str, stats.siz);
  return {
    san: stats.pow, // 初期SAN = POW
    maxSan: 99 - cthulhuMythos,
    hp: Math.floor((stats.con + stats.siz) / 10),
    mp: Math.floor(stats.pow / 5),
    idea: stats.int_, // 7版はINTそのまま (アイデアロール)
    luck: 0, // 幸運は独立ロール (Character.luck を使う)
    knowledge: stats.edu, // EDUそのまま (知識ロール)
    damageBonus: db,
    occupationPoints: stats.edu * 4,
    hobbyPoints: stats.int_ * 2,
  };
}

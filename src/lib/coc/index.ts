// CoC 6版/7版の版分岐ファサード。
// 画面・API・AI GMはここを経由することで、if(edition)分岐の散在を防ぐ。
import { z } from "zod";
import { rollDice, type Rng } from "@/lib/dice";
import type { StatBlock, Skills, CheckOutcome } from "@/lib/coc6/types";
import {
  deriveStats as deriveStats6,
  rollStats as rollStats6,
  STAT_DICE as STAT_DICE_6,
  type DerivedStats,
} from "@/lib/coc6/stats";
import { SKILL_DEFS as SKILL_DEFS_6, skillBase as skillBase6 } from "@/lib/coc6/skills";
import { judgeOutcome as judgeOutcome6 } from "@/lib/coc6/check";
import {
  deriveStats7,
  rollStats7,
  rollLuck7,
  STAT_DICE_7,
} from "@/lib/coc7/stats";
import { SKILL_DEFS_7, skillBase7 } from "@/lib/coc7/skills";
import { judgeOutcome7 } from "@/lib/coc7/check";

export const editionSchema = z.enum(["6", "7"]);
export type Edition = z.infer<typeof editionSchema>;

export const SKILL_CATEGORIES = ["戦闘", "探索", "行動", "交渉", "知識"] as const;

export interface EditionSkillDef {
  name: string;
  category: (typeof SKILL_CATEGORIES)[number];
}

export function editionLabel(edition: string): string {
  return edition === "7" ? "7版" : "6版";
}

export function rollStatsFor(edition: Edition, rng: Rng = Math.random): StatBlock {
  return edition === "7" ? rollStats7(rng) : rollStats6(rng);
}

export function statDiceFor(edition: Edition): Record<keyof StatBlock, string> {
  return edition === "7" ? STAT_DICE_7 : STAT_DICE_6;
}

export function deriveStatsFor(
  edition: Edition,
  stats: StatBlock,
  cthulhuMythos = 0,
): DerivedStats {
  return edition === "7"
    ? deriveStats7(stats, cthulhuMythos)
    : deriveStats6(stats, cthulhuMythos);
}

export function skillDefsFor(edition: Edition): EditionSkillDef[] {
  return edition === "7" ? SKILL_DEFS_7 : SKILL_DEFS_6;
}

export function skillBaseFor(
  edition: Edition,
  name: string,
  stats: StatBlock,
): number | undefined {
  if (edition === "7") {
    const def = SKILL_DEFS_7.find((d) => d.name === name);
    return def ? skillBase7(def, stats) : undefined;
  }
  const def = SKILL_DEFS_6.find((d) => d.name === name);
  return def ? skillBase6(def, stats) : undefined;
}

export function baseSkillsFor(edition: Edition, stats: StatBlock): Skills {
  const skills: Skills = {};
  for (const def of skillDefsFor(edition)) {
    skills[def.name] = skillBaseFor(edition, def.name, stats) ?? 0;
  }
  return skills;
}

// 割り振り済み技能値と初期値の差分合計 = 消費ポイント (カスタム技能は初期値0扱い)
export function spentPointsFor(
  edition: Edition,
  skills: Skills,
  stats: StatBlock,
): number {
  let spent = 0;
  for (const [name, value] of Object.entries(skills)) {
    const base = skillBaseFor(edition, name, stats) ?? 0;
    if (value > base) spent += value - base;
  }
  return spent;
}

export function judgeOutcomeFor(
  edition: Edition,
  roll: number,
  target: number,
): CheckOutcome {
  return edition === "7" ? judgeOutcome7(roll, target) : judgeOutcome6(roll, target);
}

// 7版の幸運初期値 (6版はPOW×5派生なのでnull)
export function initialLuckFor(edition: Edition, rng: Rng = Math.random): number | null {
  return edition === "7" ? rollLuck7(rng) : null;
}

// キャラの実効技能値マップ (割り振り済み優先、未割り振りは初期値)
export function effectiveSkillsFor(
  edition: Edition,
  assigned: Skills,
  stats: StatBlock,
): { name: string; value: number; assigned: boolean; category: string }[] {
  const result: { name: string; value: number; assigned: boolean; category: string }[] = [];
  const defs = skillDefsFor(edition);
  for (const def of defs) {
    const value = assigned[def.name] ?? skillBaseFor(edition, def.name, stats) ?? 0;
    result.push({
      name: def.name,
      value,
      assigned: assigned[def.name] !== undefined,
      category: def.category,
    });
  }
  for (const [name, value] of Object.entries(assigned)) {
    if (!defs.some((d) => d.name === name)) {
      result.push({ name, value, assigned: true, category: "知識" });
    }
  }
  return result;
}

// 6版: 3d6等をそのまま / 7版: "3d6×5" 形式もロールできるようにする
export function rollStatValueFor(
  edition: Edition,
  key: keyof StatBlock,
  rng: Rng = Math.random,
): number {
  if (edition === "7") {
    const base =
      key === "siz" || key === "int_" || key === "edu" ? "2d6+6" : "3d6";
    return rollDice(base, rng).total * 5;
  }
  const dice = STAT_DICE_6[key];
  return rollDice(dice, rng).total;
}

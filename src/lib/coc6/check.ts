// CoC 6版の判定ロジック。1d100で 01-05クリティカル / 96-00ファンブル / roll≤目標値で成功。
import { rollDie, rollDice, type Rng } from "@/lib/dice";
import type { CheckOutcome } from "./types";

export interface SkillCheckResult {
  roll: number;
  target: number;
  outcome: CheckOutcome;
}

export function judgeOutcome(roll: number, target: number): CheckOutcome {
  if (roll <= 5) return "CRITICAL";
  if (roll >= 96) return "FUMBLE";
  return roll <= target ? "SUCCESS" : "FAILURE";
}

export function skillCheck(target: number, rng: Rng = Math.random): SkillCheckResult {
  const roll = rollDie(100, rng);
  return { roll, target, outcome: judgeOutcome(roll, target) };
}

export interface SanCheckResult {
  roll: number;
  target: number;
  success: boolean;
  lossExpression: string;
  loss: number;
  sanAfter: number;
}

// 減少値は "0" / "1" のような定数、または "1d4" のようなダイス式を受け付ける
function rollLoss(expression: string, rng: Rng): number {
  const trimmed = expression.trim();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  return Math.max(0, rollDice(trimmed, rng).total);
}

export function sanCheck(
  currentSan: number,
  lossOnSuccess: string,
  lossOnFailure: string,
  rng: Rng = Math.random,
): SanCheckResult {
  const roll = rollDie(100, rng);
  // 簡略化: roll ≦ 現在SAN で成功 (公式の「00は常に失敗」は採用しない。SAN≧100は実運用上ほぼ無い)
  const success = roll <= currentSan;
  const lossExpression = success ? lossOnSuccess : lossOnFailure;
  const loss = rollLoss(lossExpression, rng);
  return {
    roll,
    target: currentSan,
    success,
    lossExpression,
    loss,
    sanAfter: Math.max(0, currentSan - loss),
  };
}

export const OUTCOME_LABELS: Record<CheckOutcome, string> = {
  CRITICAL: "クリティカル!",
  EXTREME: "イクストリーム成功!",
  HARD: "ハード成功",
  SUCCESS: "成功",
  FAILURE: "失敗",
  FUMBLE: "ファンブル!",
};

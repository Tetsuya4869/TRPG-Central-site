// CoC 7版の判定ロジック。成功度: クリティカル(01) / イクストリーム(≤1/5) /
// ハード(≤1/2) / レギュラー(≤目標値) / 失敗 / ファンブル(目標値<50: 96-00、≥50: 00のみ)
import { rollDie, type Rng } from "@/lib/dice";
import type { CheckOutcome } from "@/lib/coc6/types";

export function judgeOutcome7(roll: number, target: number): CheckOutcome {
  if (roll === 1) return "CRITICAL";
  if (target < 50 ? roll >= 96 : roll === 100) return "FUMBLE";
  if (roll <= Math.floor(target / 5)) return "EXTREME";
  if (roll <= Math.floor(target / 2)) return "HARD";
  if (roll <= target) return "SUCCESS";
  return "FAILURE";
}

export interface BonusPenaltyRoll {
  roll: number;
  ones: number;
  tensCandidates: number[]; // 振った十の位の候補 (0〜90)
  bonus: number; // 適用したボーナスダイス数
  penalty: number; // 適用したペナルティダイス数
}

// ボーナス/ペナルティダイス付き1d100。相殺後の差分だけ十の位を追加で振り、
// ボーナスなら最小・ペナルティなら最大の十の位を採用する。00+0は100として扱う。
export function rollD100WithBonusPenalty(
  bonus: number,
  penalty: number,
  rng: Rng = Math.random,
): BonusPenaltyRoll {
  const net = Math.max(0, bonus) - Math.max(0, penalty);
  const extraCount = Math.abs(net);
  const ones = rollDie(10, rng) % 10; // 0〜9
  const tensCandidates: number[] = [];
  for (let i = 0; i < 1 + extraCount; i++) {
    tensCandidates.push((rollDie(10, rng) % 10) * 10); // 0,10,...,90
  }
  const toValue = (tens: number) => {
    const value = tens + ones;
    return value === 0 ? 100 : value;
  };
  const values = tensCandidates.map(toValue);
  const roll = net >= 0 ? Math.min(...values) : Math.max(...values);
  return {
    roll,
    ones,
    tensCandidates,
    bonus: net > 0 ? net : 0,
    penalty: net < 0 ? -net : 0,
  };
}

export interface SkillCheck7Result {
  roll: number;
  target: number;
  outcome: CheckOutcome;
  tensCandidates: number[];
}

export function skillCheck7(
  target: number,
  bonus = 0,
  penalty = 0,
  rng: Rng = Math.random,
): SkillCheck7Result {
  const rolled = rollD100WithBonusPenalty(bonus, penalty, rng);
  return {
    roll: rolled.roll,
    target,
    outcome: judgeOutcome7(rolled.roll, target),
    tensCandidates: rolled.tensCandidates,
  };
}

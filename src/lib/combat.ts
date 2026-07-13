// 戦闘トラッカーの状態と純関数。GameSession.combatJson に保存する。
import { z } from "zod";
import { weaponSchema, resolveDamageExpression } from "@/lib/weapons";
import { rollDie, rollDice, type Rng } from "@/lib/dice";
import { judgeOutcomeFor, type Edition } from "@/lib/coc";

// 戦闘員が持つ武器 (技能値スナップショット付き)。PCは登録武器から、NPCは手動で持たせる。
// weapon.skillName は表示用。実際の命中目標値は skillValue を使う (シート参照に依存しない)。
export const combatantWeaponSchema = weaponSchema.extend({
  skillValue: z.number().int().min(0).max(100),
});
export type CombatantWeapon = z.infer<typeof combatantWeaponSchema>;

export const combatantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  kind: z.enum(["PC", "NPC"]),
  characterId: z.string().optional().nullable(),
  dex: z.number().int().min(0).max(999),
  hp: z.number().int().min(-99).max(999),
  maxHp: z.number().int().min(0).max(999),
  memo: z.string().max(200).default(""),
  edition: z.enum(["6", "7"]).optional(), // 命中判定の版 (NPCは既定6)
  // ダメージボーナス (解決済みダメージ式に使う。例 "+1d4" / "±0")
  damageBonus: z.string().max(10).optional(),
  weapons: z.array(combatantWeaponSchema).max(20).optional(),
});
export type Combatant = z.infer<typeof combatantSchema>;

export const combatStateSchema = z.object({
  round: z.number().int().min(1),
  turnIndex: z.number().int().min(0),
  combatants: z.array(combatantSchema).max(30),
});
export type CombatState = z.infer<typeof combatStateSchema>;

export function emptyCombat(): CombatState {
  return { round: 1, turnIndex: 0, combatants: [] };
}

// DEX降順 (同値は配列順を維持する安定ソート)
export function sortByDex(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort((a, b) => b.dex - a.dex);
}

export function nextTurn(state: CombatState): CombatState {
  if (state.combatants.length === 0) return state;
  const next = state.turnIndex + 1;
  if (next >= state.combatants.length) {
    return { ...state, turnIndex: 0, round: state.round + 1 };
  }
  return { ...state, turnIndex: next };
}

export function prevTurn(state: CombatState): CombatState {
  if (state.combatants.length === 0) return state;
  if (state.turnIndex === 0) {
    return {
      ...state,
      turnIndex: state.combatants.length - 1,
      round: Math.max(1, state.round - 1),
    };
  }
  return { ...state, turnIndex: state.turnIndex - 1 };
}

// 命中判定でヒット扱いになる成功度 (attack APIと同一定義)
const HIT_OUTCOMES = new Set(["CRITICAL", "EXTREME", "HARD", "SUCCESS"]);

export interface AttackResult {
  roll: number;
  outcome: string;
  hit: boolean;
  damageExpression: string;
  damage: { expression: string; rolls: number[]; total: number } | null;
}

// NPC攻撃のクライアント計算。命中は judgeOutcomeFor、ダメージは resolveDamageExpression+rollDice
// を再利用し、サーバーの attack API (PC用) とロジックを一致させる。
export function resolveAttack(
  edition: Edition,
  skillValue: number,
  weaponDamage: string,
  damageBonus: string,
  rng: Rng = Math.random,
): AttackResult {
  const roll = rollDie(100, rng);
  const outcome = judgeOutcomeFor(edition, roll, skillValue);
  const hit = HIT_OUTCOMES.has(outcome);
  const damageExpression = resolveDamageExpression(weaponDamage, damageBonus);
  let damage: AttackResult["damage"] = null;
  if (hit) {
    const result = rollDice(damageExpression, rng);
    damage = {
      expression: result.expression,
      rolls: result.rolls,
      total: Math.max(0, result.total),
    };
  }
  return { roll, outcome, hit, damageExpression, damage };
}

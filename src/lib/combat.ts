// 戦闘トラッカーの状態と純関数。GameSession.combatJson に保存する。
import { z } from "zod";

export const combatantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  kind: z.enum(["PC", "NPC"]),
  characterId: z.string().optional().nullable(),
  dex: z.number().int().min(0).max(999),
  hp: z.number().int().min(-99).max(999),
  maxHp: z.number().int().min(0).max(999),
  memo: z.string().max(200).default(""),
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

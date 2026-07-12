import { describe, it, expect } from "vitest";
import {
  combatStateSchema,
  sortByDex,
  nextTurn,
  prevTurn,
  type CombatState,
  type Combatant,
} from "./combat";

const c = (id: string, dex: number): Combatant => ({
  id,
  name: id,
  kind: "NPC",
  characterId: null,
  dex,
  hp: 10,
  maxHp: 10,
  memo: "",
});

describe("sortByDex", () => {
  it("DEX降順、同値は元の順を維持", () => {
    const sorted = sortByDex([c("a", 10), c("b", 14), c("c", 10), c("d", 12)]);
    expect(sorted.map((x) => x.id)).toEqual(["b", "d", "a", "c"]);
  });
});

describe("nextTurn / prevTurn", () => {
  const state: CombatState = {
    round: 1,
    turnIndex: 0,
    combatants: [c("a", 14), c("b", 12), c("x", 10)],
  };
  it("手番を進める", () => {
    expect(nextTurn(state).turnIndex).toBe(1);
  });
  it("末尾で次ラウンドへ", () => {
    const last = { ...state, turnIndex: 2 };
    const next = nextTurn(last);
    expect(next.turnIndex).toBe(0);
    expect(next.round).toBe(2);
  });
  it("先頭で前ラウンド末尾へ (ラウンド1未満にはならない)", () => {
    const prev = prevTurn(state);
    expect(prev.turnIndex).toBe(2);
    expect(prev.round).toBe(1);
    const r2 = prevTurn({ ...state, round: 2 });
    expect(r2.round).toBe(1);
  });
  it("participantsが空なら何もしない", () => {
    const empty: CombatState = { round: 1, turnIndex: 0, combatants: [] };
    expect(nextTurn(empty)).toEqual(empty);
  });
});

describe("combatStateSchema round-trip", () => {
  it("JSON化して復元できる", () => {
    const state: CombatState = {
      round: 3,
      turnIndex: 1,
      combatants: [c("探索者A", 14), { ...c("食屍鬼", 13), memo: "装甲1" }],
    };
    const parsed = combatStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(parsed).toEqual(state);
  });
  it("不正データは拒否", () => {
    expect(combatStateSchema.safeParse({ round: 0, turnIndex: 0, combatants: [] }).success).toBe(false);
  });
});

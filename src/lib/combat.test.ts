import { describe, it, expect } from "vitest";
import {
  combatStateSchema,
  sortByDex,
  nextTurn,
  prevTurn,
  resolveAttack,
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
  it("武器付き戦闘員をround-tripできる", () => {
    const state: CombatState = {
      round: 1,
      turnIndex: 0,
      combatants: [
        {
          ...c("食屍鬼", 13),
          edition: "6",
          damageBonus: "±0",
          weapons: [{ name: "爪", skillName: "爪", damage: "1d6", skillValue: 30 }],
        },
      ],
    };
    const parsed = combatStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(parsed).toEqual(state);
  });
});

describe("resolveAttack", () => {
  // rollDie(100)は floor(rng*100)+1。命中判定→ダメージの順にrngを消費する
  const seqRng = (...values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it("命中(出目≦技能値)ならダメージを算出、DBを解決する", () => {
    // 命中1d100: 0.1→11 ≦60 SUCCESS、ダメージ1d6:0.5→4、+1d4(DB):0.5→3 = 7
    const r = resolveAttack("6", 60, "1d6+DB", "+1d4", seqRng(0.1, 0.5, 0.5));
    expect(r.hit).toBe(true);
    expect(r.outcome).toBe("SUCCESS");
    expect(r.damageExpression).toBe("1d6+1d4");
    expect(r.damage?.total).toBe(7);
  });

  it("失敗(出目>技能値)ならダメージなし", () => {
    // 1d100: 0.9→91 >60 FAILURE
    const r = resolveAttack("6", 60, "1d6", "±0", seqRng(0.9));
    expect(r.hit).toBe(false);
    expect(r.damage).toBeNull();
  });

  it("6版ファンブル(96-00)は高技能でも命中しない", () => {
    // 1d100: 0.96→97 → FUMBLE
    const r = resolveAttack("6", 90, "1d6", "±0", seqRng(0.96));
    expect(r.outcome).toBe("FUMBLE");
    expect(r.hit).toBe(false);
  });

  it("DB±0はダメージ式に足されない", () => {
    const r = resolveAttack("6", 80, "1d6+DB", "±0", seqRng(0.1, 0.5));
    expect(r.damageExpression).toBe("1d6");
  });
});

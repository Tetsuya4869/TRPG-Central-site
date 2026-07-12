import { describe, it, expect } from "vitest";
import { judgeOutcome7, rollD100WithBonusPenalty, skillCheck7 } from "./check";
import { deriveStats7, damageBonus7, rollStats7, rollLuck7 } from "./stats";
import { skillBase7, SKILL_DEFS_7 } from "./skills";
import type { StatBlock } from "@/lib/coc6/types";

function seqRng(...values: number[]): () => number {
  let i = 0;
  return () => values[i++] ?? 0;
}

describe("judgeOutcome7 (成功度)", () => {
  it("01は常にクリティカル", () => {
    expect(judgeOutcome7(1, 5)).toBe("CRITICAL");
    expect(judgeOutcome7(1, 90)).toBe("CRITICAL");
  });
  it("イクストリーム (≤1/5)", () => {
    expect(judgeOutcome7(14, 70)).toBe("EXTREME"); // 70/5=14
    expect(judgeOutcome7(15, 70)).toBe("HARD");
  });
  it("ハード (≤1/2)", () => {
    expect(judgeOutcome7(35, 70)).toBe("HARD"); // 70/2=35
    expect(judgeOutcome7(36, 70)).toBe("SUCCESS");
  });
  it("レギュラー成功と失敗", () => {
    expect(judgeOutcome7(70, 70)).toBe("SUCCESS");
    expect(judgeOutcome7(71, 70)).toBe("FAILURE");
  });
  it("ファンブル境界: 目標値49は96-00、50は00のみ", () => {
    expect(judgeOutcome7(96, 49)).toBe("FUMBLE");
    expect(judgeOutcome7(100, 49)).toBe("FUMBLE");
    expect(judgeOutcome7(96, 50)).toBe("FAILURE");
    expect(judgeOutcome7(100, 50)).toBe("FUMBLE");
  });
});

describe("rollD100WithBonusPenalty", () => {
  // rollDie(10)は floor(rng*10)+1 → %10 で 0..9 の十の位/一の位を作る
  it("ボーナスなしは通常の1d100", () => {
    // ones: rng 0.4 → die5 → 5、tens: rng 0.6 → die7 → 7 → 70
    const r = rollD100WithBonusPenalty(0, 0, seqRng(0.4, 0.6));
    expect(r.roll).toBe(75);
    expect(r.tensCandidates).toEqual([70]);
  });
  it("ボーナスダイスは小さい十の位を採用", () => {
    // ones=5、tens候補: 70, 20 → 25を採用
    const r = rollD100WithBonusPenalty(1, 0, seqRng(0.4, 0.6, 0.1));
    expect(r.roll).toBe(25);
    expect(r.tensCandidates).toEqual([70, 20]);
  });
  it("ペナルティダイスは大きい十の位を採用", () => {
    const r = rollD100WithBonusPenalty(0, 1, seqRng(0.4, 0.6, 0.1));
    expect(r.roll).toBe(75);
  });
  it("ボーナスとペナルティは相殺される", () => {
    const r = rollD100WithBonusPenalty(2, 2, seqRng(0.4, 0.6));
    expect(r.tensCandidates).toHaveLength(1);
  });
  it("00+0は100として扱う", () => {
    // ones: rng 0.9 → die10 → %10=0、tens: rng 0.9 → 0
    const r = rollD100WithBonusPenalty(0, 0, seqRng(0.9, 0.9));
    expect(r.roll).toBe(100);
  });
});

describe("deriveStats7", () => {
  const stats: StatBlock = {
    str: 65,
    con: 60,
    pow: 55,
    dex: 70,
    app: 50,
    siz: 65,
    int_: 75,
    edu: 80,
  };
  const d = deriveStats7(stats);
  it("HP = (CON+SIZ)/10 切り捨て", () => expect(d.hp).toBe(12));
  it("MP = POW/5", () => expect(d.mp).toBe(11));
  it("初期SAN = POW", () => expect(d.san).toBe(55));
  it("職業P = EDU×4", () => expect(d.occupationPoints).toBe(320));
  it("趣味P = INT×2", () => expect(d.hobbyPoints).toBe(150));
  it("DB: STR65+SIZ65=130 → +1d4", () => expect(d.damageBonus).toBe("+1d4"));
});

describe("damageBonus7", () => {
  it("2-64 → -2", () => expect(damageBonus7(15, 45).db).toBe("-2"));
  it("65-84 → -1", () => expect(damageBonus7(40, 40).db).toBe("-1"));
  it("85-124 → ±0", () => expect(damageBonus7(50, 50).db).toBe("±0"));
  it("125-164 → +1d4", () => expect(damageBonus7(80, 80).db).toBe("+1d4"));
  it("165-204 → +1d6", () => expect(damageBonus7(100, 100).db).toBe("+1d6"));
});

describe("rollStats7 / rollLuck7 値域", () => {
  it("STR 15-90 / SIZ 40-90 / 幸運 15-90", () => {
    for (let i = 0; i < 100; i++) {
      const s = rollStats7();
      expect(s.str).toBeGreaterThanOrEqual(15);
      expect(s.str).toBeLessThanOrEqual(90);
      expect(s.str % 5).toBe(0);
      expect(s.siz).toBeGreaterThanOrEqual(40);
      expect(s.siz).toBeLessThanOrEqual(90);
      const luck = rollLuck7();
      expect(luck).toBeGreaterThanOrEqual(15);
      expect(luck).toBeLessThanOrEqual(90);
    }
  });
});

describe("skillBase7", () => {
  const stats: StatBlock = {
    str: 65, con: 60, pow: 55, dex: 71, app: 50, siz: 65, int_: 75, edu: 80,
  };
  it("回避 = DEX/2 切り捨て", () => {
    const def = SKILL_DEFS_7.find((d) => d.name === "回避")!;
    expect(skillBase7(def, stats)).toBe(35);
  });
  it("母国語 = EDU", () => {
    const def = SKILL_DEFS_7.find((d) => d.name === "母国語")!;
    expect(skillBase7(def, stats)).toBe(80);
  });
});

describe("skillCheck7", () => {
  it("ボーナスダイス付きで成功度を返す", () => {
    // ones=5, tens: 70,20 → roll 25, target 70 → HARD (≤35)
    const r = skillCheck7(70, 1, 0, seqRng(0.4, 0.6, 0.1));
    expect(r.roll).toBe(25);
    expect(r.outcome).toBe("HARD");
  });
});

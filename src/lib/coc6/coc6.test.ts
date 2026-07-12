import { describe, it, expect } from "vitest";
import { deriveStats, damageBonus, rollStats } from "./stats";
import { judgeOutcome, skillCheck, sanCheck } from "./check";
import { baseSkills, spentPoints } from "./skills";
import type { StatBlock } from "./types";

const stats: StatBlock = {
  str: 13,
  con: 11,
  pow: 14,
  dex: 12,
  app: 10,
  siz: 15,
  int_: 16,
  edu: 17,
};

describe("deriveStats", () => {
  const d = deriveStats(stats);
  it("SAN = POW×5", () => expect(d.san).toBe(70));
  it("HP = ceil((CON+SIZ)/2)", () => expect(d.hp).toBe(13));
  it("MP = POW", () => expect(d.mp).toBe(14));
  it("アイデア = INT×5", () => expect(d.idea).toBe(80));
  it("幸運 = POW×5", () => expect(d.luck).toBe(70));
  it("知識 = EDU×5", () => expect(d.knowledge).toBe(85));
  it("職業P = EDU×20", () => expect(d.occupationPoints).toBe(340));
  it("趣味P = INT×10", () => expect(d.hobbyPoints).toBe(160));
  it("DB: STR13+SIZ15=28 → +1d4", () => expect(d.damageBonus).toBe("+1d4"));
});

describe("damageBonus", () => {
  it("2-12 → -1d6", () => expect(damageBonus(6, 6)).toBe("-1d6"));
  it("13-16 → -1d4", () => expect(damageBonus(8, 8)).toBe("-1d4"));
  it("17-24 → ±0", () => expect(damageBonus(12, 12)).toBe("±0"));
  it("25-32 → +1d4", () => expect(damageBonus(16, 16)).toBe("+1d4"));
  it("33-40 → +1d6", () => expect(damageBonus(20, 20)).toBe("+1d6"));
});

describe("rollStats", () => {
  it("値域: STR 3-18 / SIZ 8-18 / EDU 6-21", () => {
    for (let i = 0; i < 200; i++) {
      const s = rollStats();
      expect(s.str).toBeGreaterThanOrEqual(3);
      expect(s.str).toBeLessThanOrEqual(18);
      expect(s.siz).toBeGreaterThanOrEqual(8);
      expect(s.siz).toBeLessThanOrEqual(18);
      expect(s.edu).toBeGreaterThanOrEqual(6);
      expect(s.edu).toBeLessThanOrEqual(21);
    }
  });
});

describe("judgeOutcome (境界値)", () => {
  it("01-05 はクリティカル(目標値未満でも)", () => {
    expect(judgeOutcome(1, 50)).toBe("CRITICAL");
    expect(judgeOutcome(5, 3)).toBe("CRITICAL");
  });
  it("96-00 はファンブル(目標値が高くても)", () => {
    expect(judgeOutcome(96, 99)).toBe("FUMBLE");
    expect(judgeOutcome(100, 99)).toBe("FUMBLE");
  });
  it("roll≤target で成功", () => {
    expect(judgeOutcome(50, 50)).toBe("SUCCESS");
    expect(judgeOutcome(51, 50)).toBe("FAILURE");
    expect(judgeOutcome(6, 5)).toBe("FAILURE");
    expect(judgeOutcome(95, 95)).toBe("SUCCESS");
  });
});

describe("skillCheck", () => {
  it("roll値でoutcomeが決まる", () => {
    // rng=0 → roll=1 → CRITICAL
    expect(skillCheck(50, () => 0).outcome).toBe("CRITICAL");
    // rng=0.999 → roll=100 → FUMBLE
    expect(skillCheck(50, () => 0.999).outcome).toBe("FUMBLE");
  });
});

describe("sanCheck", () => {
  it("成功時は成功側の減少値を使う", () => {
    // roll=1 ≤ SAN50 → 成功、減少 "0"
    const r = sanCheck(50, "0", "1d4", () => 0);
    expect(r.success).toBe(true);
    expect(r.loss).toBe(0);
    expect(r.sanAfter).toBe(50);
  });
  it("失敗時はダイス式の減少値をロールする", () => {
    // roll=100 > SAN50 → 失敗、1d4 (rng=0.999 → 4)
    const r = sanCheck(50, "0", "1d4", () => 0.999);
    expect(r.success).toBe(false);
    expect(r.loss).toBe(4);
    expect(r.sanAfter).toBe(46);
  });
  it("SANは0未満にならない", () => {
    const r = sanCheck(2, "0", "1d4", () => 0.999);
    expect(r.sanAfter).toBe(0);
  });
});

describe("skills", () => {
  it("回避=DEX×2、母国語=EDU×5", () => {
    const skills = baseSkills(stats);
    expect(skills["回避"]).toBe(24);
    expect(skills["母国語"]).toBe(85);
    expect(skills["こぶし(パンチ)"]).toBe(50);
    expect(skills["クトゥルフ神話"]).toBe(0);
  });
  it("spentPoints は初期値からの上積みだけ数える", () => {
    const skills = { ...baseSkills(stats) };
    skills["目星"] = 75; // 25 → 75 で 50消費
    skills["図書館"] = 25; // 変更なし
    expect(spentPoints(skills, stats)).toBe(50);
  });
});

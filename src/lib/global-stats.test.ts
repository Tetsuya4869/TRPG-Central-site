import { describe, it, expect } from "vitest";
import { buildGlobalStats, type GlobalRollInput } from "./global-stats";

const NOW = new Date("2026-07-18T12:00:00Z");

const check = (over: Partial<GlobalRollInput> = {}): GlobalRollInput => ({
  expression: "1d100",
  total: 42,
  target: 60,
  outcome: "SUCCESS",
  skillName: null,
  characterName: null,
  source: "MANUAL",
  createdAt: NOW,
  ...over,
});

describe("buildGlobalStats", () => {
  it("空入力でも形が壊れない (12ヶ月ゼロ埋め)", () => {
    const s = buildGlobalStats([], NOW);
    expect(s.summary).toEqual({
      totalRolls: 0,
      totalChecks: 0,
      successes: 0,
      criticals: 0,
      fumbles: 0,
    });
    expect(s.monthly).toHaveLength(12);
    expect(s.monthly[11].month).toBe("2026-07");
    expect(s.monthly.every((m) => m.count === 0)).toBe(true);
  });

  it("判定は 1d100+target のみ。汎用ロールは totalRolls と monthly だけに入る", () => {
    const s = buildGlobalStats(
      [
        check(),
        check({ expression: "2d6", target: null, outcome: null }), // 汎用
        check({ target: null, outcome: null }), // targetなし1d100
      ],
      NOW,
    );
    expect(s.summary.totalRolls).toBe(3);
    expect(s.summary.totalChecks).toBe(1);
    expect(s.histogram.reduce((a, b) => a + b, 0)).toBe(1);
    expect(s.monthly[11].count).toBe(3);
  });

  it("byCharacter は判定数降順で、成功/クリ/ファンブルを数える", () => {
    const s = buildGlobalStats(
      [
        check({ characterName: "花子", outcome: "CRITICAL", total: 1 }),
        check({ characterName: "花子", outcome: "FAILURE", total: 90 }),
        check({ characterName: "太郎", outcome: "FUMBLE", total: 100 }),
      ],
      NOW,
    );
    expect(s.byCharacter[0]).toEqual({
      name: "花子",
      checks: 2,
      successes: 1,
      criticals: 1,
      fumbles: 0,
    });
    expect(s.byCharacter[1].fumbles).toBe(1);
  });

  it("skillStats は skillName があるものだけ集計し top10 に切る", () => {
    const rolls: GlobalRollInput[] = [];
    for (let i = 0; i < 12; i++) {
      rolls.push(check({ skillName: `技能${i}` }));
      rolls.push(check({ skillName: `技能${i}`, outcome: "FAILURE" }));
    }
    rolls.push(check({ skillName: null }));
    const s = buildGlobalStats(rolls, NOW);
    expect(s.skillStats).toHaveLength(10);
    expect(s.skillStats[0].tries).toBe(2);
    expect(s.skillStats[0].successes).toBe(1);
  });

  it("monthly は12ヶ月窓の外を捨て、月ごとに数える", () => {
    const s = buildGlobalStats(
      [
        check({ createdAt: new Date("2026-06-01T00:00:00Z") }),
        check({ createdAt: new Date("2026-06-30T00:00:00Z") }),
        check({ createdAt: new Date("2024-01-01T00:00:00Z") }), // 窓外
      ],
      NOW,
    );
    const june = s.monthly.find((m) => m.month === "2026-06");
    expect(june?.count).toBe(2);
    expect(s.monthly.reduce((a, m) => a + m.count, 0)).toBe(2);
  });

  it("出目の異常値はヒストグラム端にクランプされる", () => {
    const s = buildGlobalStats(
      [check({ total: 0 }), check({ total: 999 }), check({ total: 100 })],
      NOW,
    );
    expect(s.histogram[0]).toBe(1);
    expect(s.histogram[9]).toBe(2);
  });
});

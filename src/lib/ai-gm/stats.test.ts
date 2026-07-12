import { describe, it, expect } from "vitest";
import { buildSessionStats, type StatsRollInput } from "./stats";

const roll = (over: Partial<StatsRollInput>): StatsRollInput => ({
  expression: "1d100",
  total: 50,
  target: 60,
  outcome: "SUCCESS",
  skillName: null,
  characterId: null,
  characterName: null,
  sanAfter: null,
  createdAt: new Date("2026-01-01"),
  ...over,
});

const members = [{ characterId: "c1", name: "太郎" }];

describe("buildSessionStats", () => {
  it("空データでも壊れない", () => {
    const stats = buildSessionStats([], members);
    expect(stats.summary.totalChecks).toBe(0);
    expect(stats.histogram).toHaveLength(10);
    expect(stats.sanSeries[0].points).toEqual([]);
  });

  it("ヒストグラムのバケット境界 (1→[0], 10→[0], 11→[1], 100→[9])", () => {
    const stats = buildSessionStats(
      [
        roll({ total: 1 }),
        roll({ total: 10 }),
        roll({ total: 11 }),
        roll({ total: 100, outcome: "FUMBLE" }),
      ],
      members,
    );
    expect(stats.histogram[0]).toBe(2);
    expect(stats.histogram[1]).toBe(1);
    expect(stats.histogram[9]).toBe(1);
  });

  it("成功率はHARD/EXTREME/CRITICALも成功に含む", () => {
    const stats = buildSessionStats(
      [
        roll({ outcome: "SUCCESS" }),
        roll({ outcome: "HARD" }),
        roll({ outcome: "EXTREME" }),
        roll({ outcome: "CRITICAL", total: 1 }),
        roll({ outcome: "FAILURE", total: 90 }),
      ],
      members,
    );
    expect(stats.summary.successes).toBe(4);
    expect(stats.summary.criticals).toBe(1);
  });

  it("目標値なしのロール(ダメージ等)は判定に数えない", () => {
    const stats = buildSessionStats(
      [roll({ expression: "1d6", target: null, outcome: null, total: 4 })],
      members,
    );
    expect(stats.summary.totalChecks).toBe(0);
  });

  it("SAN推移: 旧データ(characterId=NULL)は1人セッションのみ帰属", () => {
    const rolls = [
      roll({ sanAfter: 65, createdAt: new Date("2026-01-01") }),
      roll({ sanAfter: 60, characterId: "c1", createdAt: new Date("2026-01-02") }),
    ];
    const solo = buildSessionStats(rolls, members);
    expect(solo.sanSeries[0].points.map((p) => p.san)).toEqual([65, 60]);

    const party = buildSessionStats(rolls, [
      ...members,
      { characterId: "c2", name: "花子" },
    ]);
    expect(party.sanSeries[0].points.map((p) => p.san)).toEqual([60]); // NULL行は除外
    expect(party.sanSeries[1].points).toEqual([]);
  });

  it("技能別成績は試行回数降順・上位10件", () => {
    const rolls: StatsRollInput[] = [];
    for (let i = 0; i < 12; i++) {
      rolls.push(roll({ skillName: `技能${i}`, outcome: "SUCCESS" }));
    }
    rolls.push(roll({ skillName: "技能0", outcome: "FAILURE", total: 90 }));
    const stats = buildSessionStats(rolls, members);
    expect(stats.skillStats).toHaveLength(10);
    expect(stats.skillStats[0]).toEqual({ name: "技能0", tries: 2, successes: 1 });
  });
});

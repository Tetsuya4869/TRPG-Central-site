import { describe, it, expect } from "vitest";
import { madnessTableFor, rollMadness } from "./madness";

// 指定した値を順に返す決定的RNG (rollDie(10)は floor(rng*10)+1)
const seqRng = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("madnessTableFor", () => {
  it("6版/7版とも10項目ある", () => {
    expect(madnessTableFor("6")).toHaveLength(10);
    expect(madnessTableFor("7")).toHaveLength(10);
  });
  it("全項目にタイトルと説明がある", () => {
    for (const edition of ["6", "7"] as const) {
      for (const entry of madnessTableFor(edition)) {
        expect(entry.title.length).toBeGreaterThan(0);
        expect(entry.description.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("rollMadness", () => {
  it("出目1で表の先頭、出目10で末尾を引く", () => {
    const first = rollMadness("6", seqRng(0, 0));
    expect(first.roll).toBe(1);
    expect(first.entry).toEqual(madnessTableFor("6")[0]);

    const last = rollMadness("6", seqRng(0.95, 0.95));
    expect(last.roll).toBe(10);
    expect(last.entry).toEqual(madnessTableFor("6")[9]);
  });
  it("持続時間ロールが1〜10に収まる", () => {
    for (let i = 0; i < 100; i++) {
      const r = rollMadness("7");
      expect(r.durationRoll).toBeGreaterThanOrEqual(1);
      expect(r.durationRoll).toBeLessThanOrEqual(10);
      expect(r.durationText).toContain("ラウンド");
    }
  });
  it("版ごとに持続時間の表現が異なる", () => {
    expect(rollMadness("6", seqRng(0)).durationText).toContain("分");
    expect(rollMadness("7", seqRng(0)).durationText).toContain("潜在的狂気");
  });
});

import { describe, it, expect } from "vitest";
import { parseDice, rollDice } from "./dice";

// 常に最小値/最大値を出す決定的RNG
const minRng = () => 0;
const maxRng = () => 0.999999;

describe("parseDice", () => {
  it("1d100 をパースできる", () => {
    expect(parseDice("1d100")).toEqual({ count: 1, sides: 100, modifier: 0 });
  });
  it("d6 は個数1として扱う", () => {
    expect(parseDice("d6")).toEqual({ count: 1, sides: 6, modifier: 0 });
  });
  it("2d6+6 の修正値を読める", () => {
    expect(parseDice("2d6+6")).toEqual({ count: 2, sides: 6, modifier: 6 });
  });
  it("3d6-2 の負の修正値を読める", () => {
    expect(parseDice("3d6-2")).toEqual({ count: 3, sides: 6, modifier: -2 });
  });
  it("大文字Dも受け付ける", () => {
    expect(parseDice("3D6")).toEqual({ count: 3, sides: 6, modifier: 0 });
  });
  it("不正な式は拒否する", () => {
    expect(() => parseDice("abc")).toThrow();
    expect(() => parseDice("1d")).toThrow();
    expect(() => parseDice("")).toThrow();
    expect(() => parseDice("1d6+1d4")).toThrow();
  });
  it("上限を超える個数・面数は拒否する", () => {
    expect(() => parseDice("101d6")).toThrow();
    expect(() => parseDice("1d1001")).toThrow();
    expect(() => parseDice("1d1")).toThrow();
  });
});

describe("rollDice", () => {
  it("最小値: 3d6 は 3", () => {
    const r = rollDice("3d6", minRng);
    expect(r.rolls).toEqual([1, 1, 1]);
    expect(r.total).toBe(3);
  });
  it("最大値: 3d6 は 18", () => {
    const r = rollDice("3d6", maxRng);
    expect(r.rolls).toEqual([6, 6, 6]);
    expect(r.total).toBe(18);
  });
  it("修正値が合計に反映される: 2d6+6", () => {
    expect(rollDice("2d6+6", minRng).total).toBe(8);
    expect(rollDice("2d6+6", maxRng).total).toBe(18);
  });
  it("式が正規化される", () => {
    expect(rollDice("D100", minRng).expression).toBe("1d100");
  });
  it("実RNGでも値域内に収まる", () => {
    for (let i = 0; i < 1000; i++) {
      const r = rollDice("1d100");
      expect(r.total).toBeGreaterThanOrEqual(1);
      expect(r.total).toBeLessThanOrEqual(100);
    }
  });
});

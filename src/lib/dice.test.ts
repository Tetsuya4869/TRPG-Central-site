import { describe, it, expect } from "vitest";
import { parseDice, parseExpression, rollDice } from "./dice";

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

describe("parseExpression (複合式)", () => {
  it("1d6+1d4+2 をパースできる", () => {
    expect(parseExpression("1d6+1d4+2")).toEqual({
      terms: [
        { count: 1, sides: 6, sign: 1 },
        { count: 1, sides: 4, sign: 1 },
      ],
      modifier: 2,
    });
  });
  it("マイナスのダイス項: 1d6-1d4", () => {
    expect(parseExpression("1d6-1d4")).toEqual({
      terms: [
        { count: 1, sides: 6, sign: 1 },
        { count: 1, sides: 4, sign: -1 },
      ],
      modifier: 0,
    });
  });
  it("定数は合算される: 1d6+3-1", () => {
    expect(parseExpression("1d6+3-1").modifier).toBe(2);
  });
  it("空白を無視する: ' 1d6 + 1d4 '", () => {
    expect(parseExpression(" 1d6 + 1d4 ").terms).toHaveLength(2);
  });
  it("ダイス項なし・不正な式は拒否する", () => {
    expect(() => parseExpression("5")).toThrow();
    expect(() => parseExpression("abc")).toThrow();
    expect(() => parseExpression("1d6 1d4")).toThrow(); // 符号なし連結
    expect(() => parseExpression("1d6+")).toThrow();
    expect(() => parseExpression("")).toThrow();
  });
  it("合計個数・項数の上限を守る", () => {
    expect(() => parseExpression("60d6+60d6")).toThrow(); // 計120個
    expect(() =>
      parseExpression("1d6+1d6+1d6+1d6+1d6+1d6+1d6+1d6+1d6+1d6+1d6"),
    ).toThrow(); // 11項
  });
});

describe("rollDice (複合式)", () => {
  it("1d6+1d4+2: 最小値4 / 最大値12", () => {
    expect(rollDice("1d6+1d4+2", minRng).total).toBe(4);
    expect(rollDice("1d6+1d4+2", maxRng).total).toBe(12);
  });
  it("マイナス項は負数で記録され合計から引かれる", () => {
    const r = rollDice("1d6-1d4", maxRng);
    expect(r.rolls).toEqual([6, -4]);
    expect(r.total).toBe(2);
  });
  it("複合式が正規化される", () => {
    expect(rollDice("1D6 + 1d4+2", minRng).expression).toBe("1d6+1d4+2");
  });
});

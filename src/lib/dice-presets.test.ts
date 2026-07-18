import { describe, it, expect } from "vitest";
import {
  parsePresets,
  upsertPreset,
  removePreset,
  presetToRollBody,
  MAX_PRESETS,
  type DicePreset,
} from "./dice-presets";

const p = (name: string, over: Partial<DicePreset> = {}): DicePreset => ({
  id: `id-${name}`,
  name,
  expression: "1d100",
  ...over,
});

describe("parsePresets", () => {
  it("null・壊れたJSON・型違反は空配列", () => {
    expect(parsePresets(null)).toEqual([]);
    expect(parsePresets("{{broken")).toEqual([]);
    expect(parsePresets(JSON.stringify([{ id: "x" }]))).toEqual([]); // name欠落
    expect(parsePresets(JSON.stringify([{ id: "x", name: "a" }]))).toEqual([]); // expression/target両方なし
  });

  it("正常データはそのまま返し、上限で切り詰める", () => {
    const many = Array.from({ length: MAX_PRESETS + 5 }, (_, i) => p(`p${i}`));
    expect(parsePresets(JSON.stringify(many))).toHaveLength(MAX_PRESETS);
    const one = [p("目星", { expression: undefined, target: 65, edition: "7" })];
    expect(parsePresets(JSON.stringify(one))).toEqual(one);
  });
});

describe("upsertPreset / removePreset", () => {
  it("同名は置換、新規は追加、上限では追加しない", () => {
    const list = [p("a"), p("b")];
    const replaced = upsertPreset(list, p("a", { expression: "3d6" }));
    expect(replaced).toHaveLength(2);
    expect(replaced[0].expression).toBe("3d6");
    expect(upsertPreset(list, p("c"))).toHaveLength(3);
    const full = Array.from({ length: MAX_PRESETS }, (_, i) => p(`p${i}`));
    expect(upsertPreset(full, p("overflow"))).toBe(full);
  });

  it("removePresetはidで消す", () => {
    expect(removePreset([p("a"), p("b")], "id-a").map((x) => x.name)).toEqual(["b"]);
  });
});

describe("presetToRollBody", () => {
  it("判定型は target+context+edition、式型は expression", () => {
    expect(
      presetToRollBody(p("目星", { expression: undefined, target: 65, edition: "7" })),
    ).toEqual({ target: 65, context: "目星", edition: "7" });
    expect(presetToRollBody(p("ダメージ", { expression: "1d6+2" }))).toEqual({
      expression: "1d6+2",
    });
    // edition未指定の判定型は6版扱い
    expect(presetToRollBody(p("聞き耳", { expression: undefined, target: 50 }))).toEqual({
      target: 50,
      context: "聞き耳",
      edition: "6",
    });
  });
});

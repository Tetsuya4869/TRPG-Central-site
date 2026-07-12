import { describe, it, expect } from "vitest";
import {
  resolveDamageExpression,
  isValidDamageExpression,
  weaponSchema,
  parseWeaponsJson,
} from "./weapons";

describe("resolveDamageExpression", () => {
  it("DBを+1d4に解決する", () => {
    expect(resolveDamageExpression("1d6+DB", "+1d4")).toBe("1d6+1d4");
  });
  it("DB ±0 は項ごと消える", () => {
    expect(resolveDamageExpression("1d6+DB", "±0")).toBe("1d6");
  });
  it("負のDB (7版 -1/-2) はマイナス定数になる", () => {
    expect(resolveDamageExpression("1d3+DB", "-2")).toBe("1d3-2");
  });
  it("負のダイスDB (6版 -1d4)", () => {
    expect(resolveDamageExpression("1d6+DB", "-1d4")).toBe("1d6-1d4");
  });
  it("小文字dbや空白も解決する", () => {
    expect(resolveDamageExpression("1d4 + db", "+1d6")).toBe("1d4+1d6");
  });
  it("DBなしの式はそのまま", () => {
    expect(resolveDamageExpression("2d6+1", "+1d4")).toBe("2d6+1");
  });
});

describe("isValidDamageExpression / weaponSchema", () => {
  it("妥当なダメージ式を受け付ける", () => {
    expect(isValidDamageExpression("1d6+DB")).toBe(true);
    expect(isValidDamageExpression("2d6")).toBe(true);
    expect(isValidDamageExpression("1d8+1")).toBe(true);
  });
  it("不正なダメージ式を拒否する", () => {
    expect(isValidDamageExpression("すごい威力")).toBe(false);
    expect(isValidDamageExpression("5")).toBe(false);
  });
  it("weaponSchema がダメージ式を検証する", () => {
    expect(
      weaponSchema.safeParse({ name: "ナイフ", skillName: "ナイフ", damage: "1d4+DB" })
        .success,
    ).toBe(true);
    expect(
      weaponSchema.safeParse({ name: "ナイフ", skillName: "ナイフ", damage: "???" })
        .success,
    ).toBe(false);
  });
});

describe("parseWeaponsJson", () => {
  it("正常なJSONをパースする", () => {
    const weapons = parseWeaponsJson(
      '[{"name":"ナイフ","skillName":"ナイフ","damage":"1d4+DB"}]',
    );
    expect(weapons).toHaveLength(1);
    expect(weapons[0].name).toBe("ナイフ");
  });
  it("壊れたJSONは空配列", () => {
    expect(parseWeaponsJson("{{{")).toEqual([]);
    expect(parseWeaponsJson('{"not":"array"}')).toEqual([]);
  });
});

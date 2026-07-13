import { describe, it, expect } from "vitest";
import { parseCharaenoCharacter } from "./charaeno";

// 代表的なCharaeno (7版) エクスポートJSON。能力値は×5フルバリュー。
const charaeno7 = {
  name: "田中太郎",
  occupation: "私立探偵",
  age: 34,
  sex: "男",
  residence: "東京",
  birthplace: "大阪",
  characteristics: { str: 60, con: 55, siz: 65, dex: 70, app: 50, int: 80, pow: 65, edu: 75 },
  attribute: {
    hp: 12,
    mp: 13,
    san: { value: 60 },
    luck: 55,
    db: "1D4",
    build: 1,
  },
  skills: [
    { name: "目星", value: 70 },
    { name: "図書館", value: 65 },
    { name: "拳銃", value: 50 }, // 別名 → 射撃(拳銃)
    { name: "母国語(日本語)", value: 75 }, // 言語指定 → 母国語
    { name: "経理", value: 30 },
  ],
  note: "調査メモ",
};

describe("parseCharaenoCharacter (7版)", () => {
  const { input, detectedEdition, unknownSkills } = parseCharaenoCharacter(charaeno7);

  it("7版として判定する (×5フルバリュー)", () => {
    expect(detectedEdition).toBe("7");
    expect(input.edition).toBe("7");
  });

  it("能力値をそのまま格納する", () => {
    expect(input.str).toBe(60);
    expect(input.int_).toBe(80);
    expect(input.edu).toBe(75);
  });

  it("基本情報を取り込む", () => {
    expect(input.name).toBe("田中太郎");
    expect(input.occupation).toBe("私立探偵");
    expect(input.age).toBe(34);
    expect(input.sex).toBe("男");
  });

  it("幸運・現在値を渡す", () => {
    expect(input.luck).toBe(55);
    expect(input.currentSan).toBe(60);
    expect(input.currentHp).toBe(12);
    expect(input.currentMp).toBe(13);
  });

  it("技能名を正規化する (拳銃→射撃(拳銃)、母国語(日本語)→母国語)", () => {
    expect(input.skills["目星"]).toBe(70);
    expect(input.skills["射撃(拳銃)"]).toBe(50);
    expect(input.skills["母国語"]).toBe(75);
    expect(input.skills["拳銃"]).toBeUndefined();
    expect(unknownSkills).toEqual([]); // 全て既知名に正規化された
  });

  it("武器は取り込まない (possessionsは非構造)", () => {
    expect(input.weapons).toEqual([]);
  });
});

describe("parseCharaenoCharacter (版判別・境界)", () => {
  it("全能力値が生値(≤24)なら6版として判定する", () => {
    const raw = {
      name: "旧版太郎",
      characteristics: { str: 12, con: 11, siz: 13, dex: 14, app: 10, int: 15, pow: 13, edu: 16 },
      skills: [{ name: "目星", value: 60 }],
    };
    const { detectedEdition, input } = parseCharaenoCharacter(raw);
    expect(detectedEdition).toBe("6");
    expect(input.str).toBe(12);
  });

  it("能力値がオブジェクト{value}形式でも読める", () => {
    const raw = {
      name: "x",
      characteristics: {
        str: { value: 55 }, con: { value: 50 }, siz: { value: 60 },
        dex: { value: 65 }, app: { value: 45 }, int: { value: 70 },
        pow: { value: 55 }, edu: { value: 60 },
      },
    };
    const { input } = parseCharaenoCharacter(raw);
    expect(input.str).toBe(55);
    expect(input.pow).toBe(55);
  });

  it("能力値90超は99にクランプ", () => {
    const raw = {
      name: "x",
      characteristics: { str: 120, con: 50, siz: 60, dex: 65, app: 45, int: 70, pow: 55, edu: 60 },
    };
    expect(parseCharaenoCharacter(raw).input.str).toBe(99);
  });
});

describe("parseCharaenoCharacter (異常系)", () => {
  it("オブジェクトでなければエラー", () => {
    expect(() => parseCharaenoCharacter("not json")).toThrow();
    expect(() => parseCharaenoCharacter(null)).toThrow();
  });
  it("characteristicsが無ければエラー", () => {
    expect(() => parseCharaenoCharacter({ name: "x" })).toThrow(/characteristics/);
  });
  it("能力値が欠けていればエラー", () => {
    const raw = { name: "x", characteristics: { str: 60, con: 55 } };
    expect(() => parseCharaenoCharacter(raw)).toThrow(/能力値/);
  });
  it("未知の技能名はカスタム技能として保存する", () => {
    const raw = {
      name: "x",
      characteristics: { str: 60, con: 55, siz: 60, dex: 65, app: 45, int: 70, pow: 55, edu: 60 },
      skills: [{ name: "料理", value: 40 }],
    };
    const { input, unknownSkills } = parseCharaenoCharacter(raw);
    expect(input.skills["料理"]).toBe(40);
    expect(unknownSkills).toContain("料理");
  });
});

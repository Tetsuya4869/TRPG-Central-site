import { describe, it, expect } from "vitest";
import { buildCocofoliaCharacter } from "./cocofolia";
import type { Character } from "@prisma/client";

const character: Character = {
  id: "test",
  name: "テスト太郎",
  playerName: null,
  occupation: "私立探偵",
  age: 28,
  sex: null,
  imageUrl: null,
  str: 13,
  con: 11,
  pow: 14,
  dex: 12,
  app: 10,
  siz: 15,
  int_: 16,
  edu: 17,
  currentHp: 10,
  currentMp: 14,
  currentSan: 65,
  skillsJson: "{}",
  memo: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("buildCocofoliaCharacter", () => {
  const result = buildCocofoliaCharacter({
    ...character,
    skillsJson: JSON.stringify({ 目星: 75, "運転(バイク)": 40 }),
  });

  it("kind と基本データ", () => {
    expect(result.kind).toBe("character");
    expect(result.data.name).toBe("テスト太郎");
    expect(result.data.initiative).toBe(12); // DEX
  });

  it("status は数値の value/max (HP/MP/SAN)", () => {
    expect(result.data.status).toEqual([
      { label: "HP", value: 10, max: 13 },
      { label: "MP", value: 14, max: 14 },
      { label: "SAN", value: 65, max: 99 },
    ]);
  });

  it("params は文字列の value (8能力値)", () => {
    expect(result.data.params).toHaveLength(8);
    expect(result.data.params[0]).toEqual({ label: "STR", value: "13" });
    for (const p of result.data.params) {
      expect(typeof p.value).toBe("string");
    }
  });

  it("commands に SANチェック・割り振り技能・カスタム技能・初期値技能を含む", () => {
    const commands = result.data.commands.split("\n");
    expect(commands).toContain("1d100<=65 【SANチェック】");
    expect(commands).toContain("1d100<=75 【目星】"); // 割り振り済み
    expect(commands).toContain("1d100<=40 【運転(バイク)】"); // カスタム
    expect(commands).toContain("1d100<=25 【聞き耳】"); // 初期値
    expect(commands).toContain("1d100<=24 【回避】"); // DEX×2
  });

  it("DB +1d4 がダメージコマンドに反映される", () => {
    // STR13+SIZ15=28 → +1d4
    expect(result.data.commands).toContain("1d3+1d4 【こぶしダメージ(DB込)】");
  });
});

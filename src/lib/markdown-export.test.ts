import { describe, it, expect } from "vitest";
import { buildCharacterMarkdown, buildSessionLogMarkdown } from "./markdown-export";
import type { Character } from "@prisma/client";

const baseCharacter: Character = {
  id: "c1",
  edition: "6",
  name: "山田 太郎",
  playerName: "PL山田",
  occupation: "私立探偵",
  age: 32,
  sex: "男",
  imageUrl: null,
  luck: null,
  str: 10,
  con: 12,
  pow: 14,
  dex: 11,
  app: 9,
  siz: 13,
  int_: 15,
  edu: 16,
  currentHp: 10,
  currentMp: 14,
  currentSan: 65,
  skillsJson: JSON.stringify({ 目星: 70, 図書館: 60 }),
  weaponsJson: JSON.stringify([
    { name: "ナイフ", skillName: "ナイフ", damage: "1d4+DB" },
  ]),
  memo: "帽子がトレードマーク",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("buildCharacterMarkdown", () => {
  it("6版: 名前・能力値・派生値・割り振り技能・武器・メモを含む", () => {
    const md = buildCharacterMarkdown(baseCharacter);
    expect(md).toContain("# 山田 太郎");
    expect(md).toContain("CoC 6版");
    expect(md).toContain("職業: 私立探偵");
    expect(md).toContain("| 10 | 12 | 14 | 11 | 9 | 13 | 15 | 16 |");
    // 6版派生: HP=ceil((12+13)/2)=13, MP=POW=14, アイデア=INT×5=75
    expect(md).toContain("HP 10/13");
    expect(md).toContain("MP 14/14");
    expect(md).toContain("アイデア 75");
    expect(md).toContain("目星 70%");
    // 割り振っていない初期値技能は含めない
    expect(md).not.toContain("経理");
    expect(md).toContain("ナイフ");
    expect(md).toContain("帽子がトレードマーク");
  });

  it("7版: 幸運を現在値で表示し、6版派生(アイデア)は出さない", () => {
    const md = buildCharacterMarkdown({
      ...baseCharacter,
      edition: "7",
      luck: 55,
      skillsJson: "{}",
      weaponsJson: "[]",
      memo: null,
    });
    expect(md).toContain("CoC 7版");
    expect(md).toContain("幸運 55");
    expect(md).not.toContain("アイデア");
    expect(md).not.toContain("## 技能"); // 割り振りゼロならセクションごと省略
    expect(md).not.toContain("## 武器");
  });

  it("壊れたskillsJsonでも落ちない", () => {
    const md = buildCharacterMarkdown({ ...baseCharacter, skillsJson: "{{broken" });
    expect(md).toContain("# 山田 太郎");
  });
});

describe("buildSessionLogMarkdown", () => {
  it("ログとダイスをcreatedAt順にマージし、成功度ラベルを付ける", () => {
    const md = buildSessionLogMarkdown(
      { title: "第1話", scenarioName: "悪霊の家" },
      [
        { kind: "EVENT", body: "館に到着", createdAt: new Date("2026-01-01T10:00:00Z") },
        { kind: "SUMMARY", body: "あらすじ本文", createdAt: new Date("2026-01-01T12:00:00Z") },
      ],
      [
        {
          context: "目星",
          total: 5,
          target: 70,
          outcome: "CRITICAL",
          characterName: "山田",
          createdAt: new Date("2026-01-01T11:00:00Z"),
        },
      ],
    );
    expect(md).toContain("# 卓ログ: 第1話");
    expect(md).toContain("シナリオ: 悪霊の家");
    const arrival = md.indexOf("館に到着");
    const dice = md.indexOf("山田 目星 → 5/70 **クリティカル**");
    const summary = md.indexOf("📖 あらすじ本文");
    expect(arrival).toBeGreaterThan(-1);
    expect(dice).toBeGreaterThan(arrival);
    expect(summary).toBeGreaterThan(dice);
  });

  it("空のログでもプレースホルダを出す", () => {
    const md = buildSessionLogMarkdown({ title: "空卓" }, [], []);
    expect(md).toContain("(記録はありません)");
  });
});

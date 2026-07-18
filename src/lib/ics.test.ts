import { describe, it, expect } from "vitest";
import { buildSessionIcs, escapeIcsText, toIcsUtc } from "./ics";

describe("escapeIcsText", () => {
  it("バックスラッシュ・セミコロン・カンマ・改行をエスケープする", () => {
    expect(escapeIcsText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });
});

describe("toIcsUtc", () => {
  it("UTC基本形式に変換する", () => {
    expect(toIcsUtc(new Date("2026-07-18T13:00:00Z"))).toBe("20260718T130000Z");
  });
});

describe("buildSessionIcs", () => {
  const base = {
    id: "abc123",
    title: "第1話, 悪霊の家",
    scenarioName: "悪霊の家",
    notes: "持ち物: キャラシ\n開始は21時",
    scheduledAt: new Date("2026-07-18T13:00:00Z"),
  };

  it("VEVENT一式を生成し、DTENDは既定4時間後になる", () => {
    const ics = buildSessionIcs(base);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("UID:session-abc123@trpg-central");
    expect(ics).toContain("DTSTART:20260718T130000Z");
    expect(ics).toContain("DTEND:20260718T170000Z");
    // SUMMARYのカンマはエスケープされる
    expect(ics).toContain("SUMMARY:🎲 第1話\\, 悪霊の家");
    // DESCRIPTIONに改行エスケープでシナリオ+メモが入る
    expect(ics).toContain("DESCRIPTION:シナリオ: 悪霊の家\\n持ち物: キャラシ\\n開始は21時");
    // 行区切りはCRLF
    expect(ics).toContain("\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("メモ・シナリオがなければDESCRIPTION行を出さない", () => {
    const ics = buildSessionIcs({
      id: "x",
      title: "卓",
      scheduledAt: new Date("2026-07-18T13:00:00Z"),
    });
    expect(ics).not.toContain("DESCRIPTION:");
  });

  it("durationHours指定でDTENDが変わる", () => {
    const ics = buildSessionIcs({ ...base, durationHours: 2 });
    expect(ics).toContain("DTEND:20260718T150000Z");
  });
});

import { describe, it, expect } from "vitest";
import {
  buildSummarySourceFromChat,
  buildSummarySourceFromSessionLog,
} from "./summary";

describe("buildSummarySourceFromChat", () => {
  it("会話とツール結果を平文タイムラインへ変換する", () => {
    const messages = [
      {
        role: "user",
        contentJson: JSON.stringify([{ type: "text", text: "扉を調べる" }]),
      },
      {
        role: "assistant",
        contentJson: JSON.stringify([
          { type: "text", text: "扉には奇妙な紋様が刻まれている。" },
        ]),
      },
      {
        role: "user",
        contentJson: JSON.stringify([
          {
            type: "tool_result",
            content: JSON.stringify({
              tool: "request_skill_check",
              character_name: "花子",
              skill_name: "目星",
              roll: 30,
              target: 60,
              outcome: "SUCCESS",
            }),
          },
        ]),
      },
      {
        role: "user",
        contentJson: JSON.stringify([
          {
            type: "tool_result",
            content: JSON.stringify({
              tool: "san_check",
              character_name: "花子",
              success: false,
              san_before: 60,
              san_after: 55,
            }),
          },
        ]),
      },
    ];
    const source = buildSummarySourceFromChat(messages);
    expect(source).toContain("プレイヤー: 扉を調べる");
    expect(source).toContain("キーパー: 扉には奇妙な紋様");
    expect(source).toContain("[判定] 花子 目星 出目30/60 → SUCCESS");
    expect(source).toContain("[SAN] 花子 失敗 SAN 60→55");
  });

  it("長大なログは末尾を優先して切り詰める", () => {
    const many = Array.from({ length: 3000 }, (_, i) => ({
      role: "user",
      contentJson: JSON.stringify([{ type: "text", text: `発言${i} ${"あ".repeat(20)}` }]),
    }));
    const source = buildSummarySourceFromChat(many);
    expect(source.length).toBeLessThanOrEqual(24000 + 20);
    expect(source.startsWith("(前半省略)")).toBe(true);
    expect(source).toContain("発言2999"); // 直近の展開は残る
  });
});

describe("buildSummarySourceFromSessionLog", () => {
  it("出来事とダイスをcreatedAt順にマージする", () => {
    const logs = [
      { kind: "EVENT", body: "館に到着", createdAt: new Date("2026-01-01T10:00:00Z") },
      { kind: "EVENT", body: "地下室を発見", createdAt: new Date("2026-01-01T12:00:00Z") },
    ];
    const rolls = [
      {
        context: "目星",
        total: 42,
        target: 60,
        outcome: "SUCCESS",
        characterName: "太郎",
        createdAt: new Date("2026-01-01T11:00:00Z"),
      },
    ];
    const source = buildSummarySourceFromSessionLog(logs, rolls);
    const lines = source.split("\n");
    expect(lines[0]).toContain("館に到着");
    expect(lines[1]).toContain("[判定] 太郎 目星 結果42/60 → SUCCESS");
    expect(lines[2]).toContain("地下室を発見");
  });
});

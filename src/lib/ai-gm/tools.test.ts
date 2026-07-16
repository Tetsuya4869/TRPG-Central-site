import { describe, it, expect, vi } from "vitest";

// executeGmToolのDB書き込みはモック (テストは判定ロジックとペイロードの検証に集中する)
vi.mock("@/lib/prisma", () => ({
  prisma: { diceRoll: { create: vi.fn().mockResolvedValue({}) } },
}));

import { resolveMember, executeGmTool, type MemberContext, type GmToolContext } from "./tools";

const state = { hp: 10, maxHp: 10, mp: 10, maxMp: 10, san: 50, maxSan: 99 };
const members: MemberContext[] = [
  { memberId: "m1", characterId: "c1", name: "田中太郎", state },
  { memberId: "m2", characterId: "c2", name: "花子", state },
];

describe("resolveMember (名前解決3段フォールバック)", () => {
  it("完全一致", () => {
    expect(resolveMember(members, "花子")?.memberId).toBe("m2");
  });
  it("部分一致 (AIが敬称等を付けた場合)", () => {
    expect(resolveMember(members, "田中太郎さん")?.memberId).toBe("m1");
    expect(resolveMember(members, "田中")?.memberId).toBe("m1");
  });
  it("部分一致が複数なら解決しない", () => {
    const dup: MemberContext[] = [
      { memberId: "a", characterId: "ca", name: "田中太郎", state },
      { memberId: "b", characterId: "cb", name: "田中次郎", state },
    ];
    expect(resolveMember(dup, "田中")).toBeNull();
  });
  it("1人セッションなら名前不一致でも無条件でその人 (旧セッション互換)", () => {
    const solo = [members[0]];
    expect(resolveMember(solo, "誰か")?.memberId).toBe("m1");
    expect(resolveMember(solo, undefined)?.memberId).toBe("m1");
  });
  it("複数人で名前なし/不明は解決しない", () => {
    expect(resolveMember(members, undefined)).toBeNull();
    expect(resolveMember(members, "存在しない人")).toBeNull();
  });
});

describe("executeGmTool", () => {
  const ctx: GmToolContext = { aiGmSessionId: "s1", edition: "6", members };

  it("request_skill_check: target_value=0 は50に化けず1にクランプされる (回帰テスト)", async () => {
    const result = await executeGmTool(
      "request_skill_check",
      { character_name: "花子", skill_name: "クトゥルフ神話", target_value: 0, reason: "" },
      ctx,
    );
    const payload = JSON.parse(result.resultForModel);
    expect(payload.target).toBe(1); // Math.max(1, 0)。50ではない
  });

  it("request_skill_check: target_value欠落時のみ50へフォールバック", async () => {
    const result = await executeGmTool(
      "request_skill_check",
      { character_name: "花子", skill_name: "目星", reason: "" },
      ctx,
    );
    expect(JSON.parse(result.resultForModel).target).toBe(50);
  });

  it("san_check: 状態を更新しnewMemberStateを返す", async () => {
    const result = await executeGmTool(
      "san_check",
      { character_name: "花子", loss_on_success: "0", loss_on_failure: "1d4", reason: "" },
      ctx,
    );
    const payload = JSON.parse(result.resultForModel);
    expect(payload.san_before).toBe(50);
    expect(payload.san_after).toBeLessThanOrEqual(50);
    expect(result.newMemberState?.memberId).toBe("m2");
    expect(result.newMemberState?.state.san).toBe(payload.san_after);
  });

  it("madness_roll: 狂気表の結果を返す", async () => {
    const result = await executeGmTool(
      "madness_roll",
      { character_name: "田中太郎", reason: "テスト" },
      ctx,
    );
    const payload = JSON.parse(result.resultForModel);
    expect(payload.tool).toBe("madness_roll");
    expect(payload.roll).toBeGreaterThanOrEqual(1);
    expect(payload.roll).toBeLessThanOrEqual(10);
    expect(payload.title.length).toBeGreaterThan(0);
    expect(result.isError).toBeUndefined();
  });

  it("spend_luck: 幸運を減算しnewMemberStateを返す (7版)", async () => {
    const luckyMembers: MemberContext[] = [
      { memberId: "m1", characterId: "c1", name: "花子", state: { ...state, luck: 40 } },
    ];
    const ctx7: GmToolContext = { aiGmSessionId: "s1", edition: "7", members: luckyMembers };
    const result = await executeGmTool(
      "spend_luck",
      { character_name: "花子", points: 12, reason: "目星を成功に" },
      ctx7,
    );
    const payload = JSON.parse(result.resultForModel);
    expect(payload.ok).toBe(true);
    expect(payload.luck_after).toBe(28);
    expect(result.newMemberState?.state.luck).toBe(28);
  });

  it("spend_luck: 幸運不足はエラーでなくok:falseで返す (状態は変えない)", async () => {
    const poorMembers: MemberContext[] = [
      { memberId: "m1", characterId: "c1", name: "花子", state: { ...state, luck: 5 } },
    ];
    const ctx7: GmToolContext = { aiGmSessionId: "s1", edition: "7", members: poorMembers };
    const result = await executeGmTool(
      "spend_luck",
      { character_name: "花子", points: 12, reason: "" },
      ctx7,
    );
    const payload = JSON.parse(result.resultForModel);
    expect(payload.ok).toBe(false);
    expect(result.newMemberState).toBeUndefined();
    expect(result.isError).toBeUndefined();
  });

  it("不明な探索者名は is_error で有効名一覧を返す", async () => {
    const result = await executeGmTool(
      "request_skill_check",
      { character_name: "誰そ彼", skill_name: "目星", target_value: 60, reason: "" },
      ctx,
    );
    expect(result.isError).toBe(true);
    expect(result.resultForModel).toContain("田中太郎");
    expect(result.resultForModel).toContain("花子");
  });
});

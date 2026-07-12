import { describe, it, expect } from "vitest";
import { resolveMember, type MemberContext } from "./tools";

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

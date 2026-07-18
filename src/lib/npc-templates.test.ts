import { describe, it, expect } from "vitest";
import { NPC_TEMPLATES, npcFromTemplate, uniqueNpcName } from "./npc-templates";
import { combatantSchema, nextNpcId, type Combatant } from "./combat";
import { parseExpression } from "./dice";

describe("NPC_TEMPLATES", () => {
  it("テンプレ名は重複しない", () => {
    const names = NPC_TEMPLATES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("全テンプレが combatantSchema を通る (武器・ダメージ式込み)", () => {
    for (const t of NPC_TEMPLATES) {
      const combatant = npcFromTemplate(t, "npc-1", t.name);
      const parsed = combatantSchema.safeParse(combatant);
      expect(parsed.success, `${t.name}: ${JSON.stringify(parsed)}`).toBe(true);
      for (const w of t.weapons) {
        // ダメージ式が実際にロール可能であること (DBは攻撃時に解決されるので式単体で検証)
        expect(() => parseExpression(w.damage), `${t.name}/${w.name}`).not.toThrow();
      }
    }
  });

  it("武器はコピーされ、テンプレ本体と共有参照にならない", () => {
    const t = NPC_TEMPLATES.find((x) => x.weapons.some((w) => w.ammo != null))!;
    const a = npcFromTemplate(t, "npc-1", "A");
    a.weapons![0].ammo = 0;
    expect(t.weapons[0].ammo).not.toBe(0);
  });
});

describe("uniqueNpcName", () => {
  it("重複がなければそのまま、あれば連番を付ける", () => {
    expect(uniqueNpcName("チンピラ", [])).toBe("チンピラ");
    expect(uniqueNpcName("チンピラ", ["チンピラ"])).toBe("チンピラ 2");
    expect(uniqueNpcName("チンピラ", ["チンピラ", "チンピラ 2"])).toBe("チンピラ 3");
  });
});

describe("nextNpcId", () => {
  const c = (id: string): Combatant => ({
    id,
    name: id,
    kind: "NPC",
    characterId: null,
    dex: 10,
    hp: 10,
    maxHp: 10,
    memo: "",
  });
  it("既存IDを避けて採番する", () => {
    expect(nextNpcId([])).toBe("npc-1");
    expect(nextNpcId([c("npc-1"), c("npc-3")])).toBe("npc-2");
    expect(nextNpcId([c("npc-1"), c("npc-2")])).toBe("npc-3");
  });
});

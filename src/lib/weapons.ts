// 武器データとダメージ式の解決。
// ダメージ式は "1d6+DB" のように DB(ダメージボーナス)プレースホルダを含められる。
import { z } from "zod";
import { parseExpression } from "@/lib/dice";

// "1d6+DB" の DB をキャラのダメージボーナス ("+1d4" / "-2" / "±0" 等) に置換する
export function resolveDamageExpression(damage: string, damageBonus: string): string {
  const db = damageBonus.trim().replace("±", "+");
  const isZero = /^[+-]?0$/.test(db) || db === "";
  const resolved = damage.replace(/\+?\s*DB/i, () => {
    if (isZero) return "";
    // "+1d4" / "-2" のように符号付きで連結する (符号なしなら+扱い)
    return /^[+-]/.test(db) ? db : `+${db}`;
  });
  return resolved.replace(/\s+/g, "");
}

// ダメージ式として妥当か (DBを仮に+1d4として解決してパースが通るか)
export function isValidDamageExpression(damage: string): boolean {
  try {
    parseExpression(resolveDamageExpression(damage, "+1d4"));
    return true;
  } catch {
    return false;
  }
}

export const weaponSchema = z.object({
  name: z.string().min(1, "武器名は必須です").max(50),
  skillName: z.string().min(1, "技能名は必須です").max(50),
  damage: z
    .string()
    .min(1, "ダメージ式は必須です")
    .max(30)
    .refine(isValidDamageExpression, {
      message: "ダメージ式が不正です (例: 1d6+DB, 2d6, 1d8+1)",
    }),
  notes: z.string().max(200).optional().nullable(),
});
export type Weapon = z.infer<typeof weaponSchema>;

export const weaponsSchema = z.array(weaponSchema).max(20);

export function parseWeaponsJson(json: string): Weapon[] {
  try {
    return weaponsSchema.catch([]).parse(JSON.parse(json));
  } catch {
    return [];
  }
}

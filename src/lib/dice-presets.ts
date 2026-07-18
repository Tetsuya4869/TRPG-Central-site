// カスタムロールプリセット (よく使うロールの保存)。
// 単一ユーザー前提なので localStorage に保存する (SessionTimer と同方式)。
import { z } from "zod";

export const DICE_PRESETS_KEY = "trpg-dice-presets";
export const MAX_PRESETS = 20;

export const dicePresetSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(30),
    // どちらか一方: expression = 汎用ロール型 / target = 技能判定型
    expression: z.string().min(1).max(30).optional(),
    target: z.number().int().min(1).max(100).optional(),
    edition: z.enum(["6", "7"]).optional(),
  })
  .refine((p) => p.expression != null || p.target != null, {
    message: "expression か target のどちらかが必要です",
  });
export type DicePreset = z.infer<typeof dicePresetSchema>;

// localStorageの生文字列から安全にパースする (壊れたJSON・型違反は空扱い)
export function parsePresets(raw: string | null): DicePreset[] {
  if (!raw) return [];
  try {
    const parsed = z.array(dicePresetSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.slice(0, MAX_PRESETS) : [];
  } catch {
    return [];
  }
}

// 同名は置き換え、新規は末尾に追加。上限超過なら元のリストを返す (呼び出し側でボタンをdisable)
export function upsertPreset(list: DicePreset[], preset: DicePreset): DicePreset[] {
  const idx = list.findIndex((p) => p.name === preset.name);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = preset;
    return next;
  }
  if (list.length >= MAX_PRESETS) return list;
  return [...list, preset];
}

export function removePreset(list: DicePreset[], id: string): DicePreset[] {
  return list.filter((p) => p.id !== id);
}

// /api/dice のPOSTボディへ変換する
export function presetToRollBody(preset: DicePreset): Record<string, unknown> {
  if (preset.target != null) {
    return {
      target: preset.target,
      context: preset.name,
      edition: preset.edition ?? "6",
    };
  }
  return { expression: preset.expression };
}

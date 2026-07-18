"use client";

// 保存済みカスタムロールプリセットのチップ列 (表示専用)。
import type { DicePreset } from "@/lib/dice-presets";

export function RollPresets({
  presets,
  busy,
  onRun,
  onRemove,
}: {
  presets: DicePreset[];
  busy: boolean;
  onRun: (preset: DicePreset) => void;
  onRemove: (id: string) => void;
}) {
  if (presets.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-zinc-600">マイプリセット:</span>
      {presets.map((p) => (
        <span
          key={p.id}
          className="inline-flex items-center gap-1 rounded-full border border-amber-800/60 bg-amber-950/20 pl-3 pr-1.5 py-0.5"
        >
          <button
            onClick={() => onRun(p)}
            disabled={busy}
            title={
              p.target != null
                ? `${p.edition ?? "6"}版判定 目標値${p.target}`
                : p.expression
            }
            className="text-xs text-amber-200 hover:text-amber-100 disabled:opacity-50"
          >
            ★ {p.name}
          </button>
          <button
            onClick={() => onRemove(p.id)}
            aria-label={`プリセット「${p.name}」を削除`}
            className="rounded-full px-1 text-xs text-zinc-600 hover:text-red-300"
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}

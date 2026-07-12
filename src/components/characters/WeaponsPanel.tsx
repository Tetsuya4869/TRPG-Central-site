"use client";

// キャラ詳細の武器一覧+ワンタップ攻撃ロール (命中判定→成功時ダメージ)。
import { useState } from "react";
import type { Weapon } from "@/lib/weapons";
import { OUTCOME_LABELS } from "@/lib/coc6/check";
import type { CheckOutcome } from "@/lib/coc6/types";

interface AttackResult {
  weapon: string;
  check: { roll: number; target: number; outcome: CheckOutcome };
  hit: boolean;
  damageExpression: string;
  damage: { expression: string; rolls: number[]; total: number } | null;
}

const OUTCOME_COLORS: Record<string, string> = {
  CRITICAL: "text-yellow-300",
  EXTREME: "text-yellow-300",
  HARD: "text-emerald-300",
  SUCCESS: "text-emerald-300",
  FAILURE: "text-zinc-400",
  FUMBLE: "text-red-400",
};

export function WeaponsPanel({
  characterId,
  weapons,
  damageBonus,
}: {
  characterId: string;
  weapons: Weapon[];
  damageBonus: string;
}) {
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [result, setResult] = useState<AttackResult | null>(null);
  const [error, setError] = useState("");

  if (weapons.length === 0) return null;

  async function attack(index: number) {
    setBusyIndex(index);
    setError("");
    try {
      const res = await fetch(`/api/characters/${characterId}/attack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weaponIndex: index }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "攻撃ロールに失敗しました");
        setResult(null);
        return;
      }
      setResult(data);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusyIndex(null);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-3">
      <h2 className="font-semibold text-zinc-300">
        武器
        <span className="ml-2 text-xs font-normal text-zinc-500">
          DB {damageBonus}
        </span>
      </h2>
      <div className="space-y-1.5">
        {weapons.map((w, i) => (
          <div
            key={i}
            className="flex flex-wrap items-center gap-2 rounded border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm"
          >
            <span className="font-semibold">{w.name}</span>
            <span className="text-xs text-zinc-500">
              {w.skillName} / {w.damage}
            </span>
            {w.notes && <span className="text-xs text-zinc-600">{w.notes}</span>}
            <button
              onClick={() => attack(i)}
              disabled={busyIndex !== null}
              className="ml-auto rounded bg-red-900/60 border border-red-800 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-800/60 disabled:opacity-50"
            >
              {busyIndex === i ? "⚔️ …" : "⚔️ 攻撃"}
            </button>
          </div>
        ))}
      </div>
      {result && (
        <div className="rounded border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm space-y-1">
          <div>
            <span className="text-zinc-400">{result.weapon}: </span>
            <span className="font-mono">
              {result.check.roll} / {result.check.target}
            </span>
            <span
              className={`ml-2 font-bold ${OUTCOME_COLORS[result.check.outcome] ?? ""}`}
            >
              {OUTCOME_LABELS[result.check.outcome] ?? result.check.outcome}
            </span>
          </div>
          {result.hit && result.damage ? (
            <div>
              <span className="text-zinc-400">ダメージ ({result.damage.expression}): </span>
              <span className="font-mono text-zinc-500">
                [{result.damage.rolls.join(", ")}]
              </span>
              <span className="ml-2 text-lg font-bold text-red-300">
                {result.damage.total}
              </span>
            </div>
          ) : (
            <div className="text-zinc-500">攻撃は外れた…</div>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-300">{error}</p>}
    </section>
  );
}

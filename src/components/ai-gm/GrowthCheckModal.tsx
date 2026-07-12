"use client";

import { useCallback, useEffect, useState } from "react";

interface Candidate {
  skillName: string;
  currentValue: number;
}

interface GrowthResult {
  skillName: string;
  currentValue: number;
  roll: number;
  improved: boolean;
  gain: number;
  after: number;
}

export function GrowthCheckModal({
  sessionId,
  onClose,
  onApplied,
}: {
  sessionId: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [growthApplied, setGrowthApplied] = useState(false);
  const [results, setResults] = useState<GrowthResult[] | null>(null);
  const [applyVitals, setApplyVitals] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/ai-gm/sessions/${sessionId}/growth`);
    if (!res.ok) {
      setError("成長候補の取得に失敗しました");
      return;
    }
    const data = await res.json();
    setCandidates(data.candidates);
    setGrowthApplied(data.growthApplied);
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function runChecks() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/ai-gm/sessions/${sessionId}/growth`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "経験チェックに失敗しました");
        return;
      }
      setResults(data.results);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!results) return;
    setBusy(true);
    setError("");
    try {
      const improvedSkills: Record<string, number> = {};
      for (const r of results) {
        if (r.improved) improvedSkills[r.skillName] = r.after;
      }
      const res = await fetch(`/api/ai-gm/sessions/${sessionId}/growth/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: improvedSkills, applyVitals }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "反映に失敗しました");
        return;
      }
      setDone(true);
      setGrowthApplied(true);
      onApplied();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">📈 技能成長チェック</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            ✕
          </button>
        </div>

        {growthApplied && !done && (
          <p className="rounded border border-amber-700 bg-amber-950/40 px-4 py-2 text-sm text-amber-200">
            このセッションの成長は既にマスターシートへ反映済みです
          </p>
        )}

        {candidates === null ? (
          <p className="text-sm text-zinc-500">読み込み中…</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-zinc-500">
            このセッションで成功した技能判定はありませんでした。
          </p>
        ) : !results ? (
          <>
            <p className="text-sm text-zinc-400">
              セッション中に成功した技能について経験チェックを行います。
              1d100で<strong>現在値を上回れば</strong> 1d10 成長します。
            </p>
            <ul className="space-y-1.5">
              {candidates.map((c) => (
                <li
                  key={c.skillName}
                  className="flex justify-between rounded border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm"
                >
                  <span>{c.skillName}</span>
                  <span className="font-mono text-zinc-400">現在値 {c.currentValue}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={runChecks}
              disabled={busy || growthApplied}
              className="w-full rounded bg-emerald-600 px-4 py-2.5 font-semibold hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? "ロール中…" : "🎲 経験チェックを実行"}
            </button>
          </>
        ) : (
          <>
            <ul className="space-y-1.5">
              {results.map((r) => (
                <li
                  key={r.skillName}
                  className={`flex items-center justify-between rounded border px-3 py-2 text-sm ${
                    r.improved
                      ? "border-emerald-700 bg-emerald-950/30"
                      : "border-zinc-800 bg-zinc-950/50"
                  }`}
                >
                  <span>{r.skillName}</span>
                  <span className="font-mono text-xs text-zinc-400">
                    出目 {r.roll} / {r.currentValue}
                  </span>
                  {r.improved ? (
                    <span className="font-semibold text-emerald-300">
                      +{r.gain} → {r.after}
                    </span>
                  ) : (
                    <span className="text-zinc-500">成長なし</span>
                  )}
                </li>
              ))}
            </ul>
            {done ? (
              <p className="rounded border border-emerald-700 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-200">
                ✓ マスターシートに反映しました
              </p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <input
                    type="checkbox"
                    checked={applyVitals}
                    onChange={(e) => setApplyVitals(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  セッション終了時のHP/MP/SANもシートに反映する
                </label>
                <button
                  onClick={apply}
                  disabled={busy || growthApplied}
                  className="w-full rounded bg-emerald-600 px-4 py-2.5 font-semibold hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busy ? "反映中…" : "マスターシートに反映する"}
                </button>
              </>
            )}
          </>
        )}

        {error && (
          <p className="rounded border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          onClick={onClose}
          className="w-full rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:border-zinc-500"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

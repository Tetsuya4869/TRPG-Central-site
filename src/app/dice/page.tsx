"use client";

import { useCallback, useEffect, useState } from "react";
import { OutcomeBadge } from "@/components/dice/OutcomeBadge";

interface DiceRollRecord {
  id: string;
  expression: string;
  rolls: string;
  total: number;
  target: number | null;
  outcome: string | null;
  context: string | null;
  source: string;
  createdAt: string;
}

const PRESETS = ["1d100", "1d10", "1d6", "2d6", "3d6", "1d4"];

export default function DicePage() {
  const [expression, setExpression] = useState("1d100");
  const [skillName, setSkillName] = useState("");
  const [target, setTarget] = useState("");
  const [history, setHistory] = useState<DiceRollRecord[]>([]);
  const [latest, setLatest] = useState<DiceRollRecord | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchHistory = useCallback(async () => {
    const res = await fetch("/api/dice");
    if (res.ok) setHistory(await res.json());
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  async function roll(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/dice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ロールに失敗しました");
        return;
      }
      setLatest(data);
      await fetchHistory();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  function rollExpression(expr: string) {
    setExpression(expr);
    roll({ expression: expr });
  }

  function rollSkillCheck() {
    const t = parseInt(target, 10);
    if (isNaN(t) || t < 1 || t > 100) {
      setError("目標値は1〜100で入力してください");
      return;
    }
    roll({ target: t, context: skillName || undefined });
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">🎲 ダイスローラー</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* 汎用ロール */}
          <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <h2 className="font-semibold text-zinc-300">ダイスロール</h2>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => rollExpression(p)}
                  disabled={busy}
                  className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && rollExpression(expression)}
                placeholder="例: 2d6+3"
                className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={() => rollExpression(expression)}
                disabled={busy}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                ロール
              </button>
            </div>
          </section>

          {/* 技能判定 */}
          <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <h2 className="font-semibold text-zinc-300">技能判定 (1d100)</h2>
            <div className="flex gap-2">
              <input
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="技能名 (例: 目星)"
                className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && rollSkillCheck()}
                placeholder="目標値"
                inputMode="numeric"
                className="w-24 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={rollSkillCheck}
                disabled={busy}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                判定
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              01–05 クリティカル / 96–00 ファンブル / 出目≦目標値で成功
            </p>
          </section>

          {error && (
            <p className="rounded border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          {/* 最新結果 */}
          {latest && (
            <section className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-5 text-center space-y-2">
              <p className="text-sm text-zinc-400">
                {latest.context && <span className="mr-2">{latest.context}</span>}
                {latest.expression}
                {latest.target != null && ` (目標値 ${latest.target})`}
              </p>
              <p className="text-4xl font-bold text-emerald-300">{latest.total}</p>
              <p className="text-xs text-zinc-500">
                出目: {JSON.parse(latest.rolls).join(", ")}
              </p>
              <OutcomeBadge outcome={latest.outcome} />
            </section>
          )}
        </div>

        {/* 履歴 */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-semibold text-zinc-300 mb-3">履歴 (最新50件)</h2>
          {history.length === 0 ? (
            <p className="text-sm text-zinc-500">まだロールがありません</p>
          ) : (
            <ul className="space-y-1.5 max-h-[32rem] overflow-y-auto pr-1">
              {history.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded border border-zinc-800/60 bg-zinc-950/50 px-3 py-1.5 text-sm"
                >
                  <span className="font-mono text-emerald-300 w-10 text-right">
                    {r.total}
                  </span>
                  <span className="text-zinc-400">{r.expression}</span>
                  {r.target != null && (
                    <span className="text-zinc-500 text-xs">/{r.target}</span>
                  )}
                  <OutcomeBadge outcome={r.outcome} />
                  <span className="ml-auto text-xs text-zinc-500 truncate max-w-[8rem]">
                    {r.context}
                  </span>
                  {r.source === "AI_GM" && (
                    <span className="text-xs text-purple-400">AI</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

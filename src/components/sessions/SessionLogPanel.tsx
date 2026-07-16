"use client";

// 卓ログ: ダイス履歴 (DiceRoll.gameSessionId) と出来事メモ (SessionLog) を
// createdAt でマージして時系列表示する。出来事メモの追加・削除も行う。
import { useCallback, useEffect, useState } from "react";
import { OutcomeBadge } from "@/components/dice/OutcomeBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface DiceRollRecord {
  id: string;
  expression: string;
  rolls: string;
  total: number;
  target: number | null;
  outcome: string | null;
  context: string | null;
  characterName: string | null;
  createdAt: string;
}

interface SessionLogRecord {
  id: string;
  kind: string;
  body: string;
  createdAt: string;
}

type TimelineItem =
  | { type: "dice"; at: number; data: DiceRollRecord }
  | { type: "log"; at: number; data: SessionLogRecord };

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionLogPanel({ sessionId }: { sessionId: string }) {
  const [rolls, setRolls] = useState<DiceRollRecord[]>([]);
  const [logs, setLogs] = useState<SessionLogRecord[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dRes, lRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}/dice`),
        fetch(`/api/sessions/${sessionId}/log`),
      ]);
      if (dRes.ok) setRolls(await dRes.json());
      if (lRes.ok) setLogs(await lRes.json());
    } catch {
      setError("卓ログの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addLog() {
    const trimmed = body.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "EVENT", body: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "追加に失敗しました");
        return;
      }
      const created: SessionLogRecord = await res.json();
      setLogs((prev) => [...prev, created]);
      setBody("");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  // 卓ログからAIで「これまでのあらすじ」を生成し、SUMMARYログとして残す
  async function generateSummary() {
    if (summarizing) return;
    setSummarizing(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/summary`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "あらすじの生成に失敗しました");
        return;
      }
      setLogs((prev) => [...prev, data.log]);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSummarizing(false);
    }
  }

  async function deleteLog(logId: string) {
    setDeleteTarget(null);
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/log?logId=${encodeURIComponent(logId)}`,
        { method: "DELETE" },
      );
      if (res.ok) setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch {
      setError("削除に失敗しました");
    }
  }

  // ダイスとログをマージして時系列 (昇順)
  const timeline: TimelineItem[] = [
    ...rolls.map((r): TimelineItem => ({ type: "dice", at: Date.parse(r.createdAt), data: r })),
    ...logs.map((l): TimelineItem => ({ type: "log", at: Date.parse(l.createdAt), data: l })),
  ].sort((a, b) => a.at - b.at);

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-zinc-300">📜 卓ログ</h2>
        <button
          onClick={generateSummary}
          disabled={summarizing || (rolls.length === 0 && logs.length === 0)}
          title="卓ログからAIで「これまでのあらすじ」を生成します (要APIキー)"
          className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-50"
        >
          {summarizing ? "生成中…" : "📝 あらすじ生成"}
        </button>
      </div>

      {/* 出来事メモ入力 */}
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addLog()}
          placeholder="出来事を記録 (例: 一行が館に到着。玄関で老人と遭遇)"
          maxLength={2000}
          className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <button
          onClick={addLog}
          disabled={busy || !body.trim()}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
        >
          記録
        </button>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}

      {/* 時系列 */}
      {loading ? (
        <p className="text-sm text-zinc-500">読み込み中…</p>
      ) : timeline.length === 0 ? (
        <p className="text-sm text-zinc-500">
          まだログがありません。ダイスロールや出来事がここに時系列で記録されます。
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-96 overflow-y-auto pr-1" aria-live="polite">
          {timeline.map((item) =>
            item.type === "dice" ? (
              <li
                key={`d-${item.data.id}`}
                className="flex items-center gap-2 rounded border border-zinc-800/60 bg-zinc-950/50 px-3 py-1.5 text-sm"
              >
                <span className="shrink-0 text-xs text-zinc-600">🎲</span>
                {item.data.characterName && (
                  <span className="shrink-0 text-xs text-zinc-400">
                    {item.data.characterName}
                  </span>
                )}
                <span className="text-zinc-400 truncate">{item.data.context}</span>
                <span className="ml-auto shrink-0 font-mono text-emerald-300">
                  {item.data.total}
                </span>
                {item.data.target != null && (
                  <span className="shrink-0 text-xs text-zinc-500">
                    /{item.data.target}
                  </span>
                )}
                <OutcomeBadge outcome={item.data.outcome} />
                <span className="shrink-0 text-xs text-zinc-600">
                  {formatTime(item.data.createdAt)}
                </span>
              </li>
            ) : (
              <li
                key={`l-${item.data.id}`}
                className={`flex items-start gap-2 rounded border px-3 py-1.5 text-sm ${
                  item.data.kind === "SUMMARY"
                    ? "border-purple-800/60 bg-purple-950/20"
                    : "border-emerald-900/50 bg-emerald-950/20"
                }`}
              >
                <span className="shrink-0 text-xs text-zinc-600">
                  {item.data.kind === "SUMMARY" ? "📖" : "📝"}
                </span>
                <span className="text-zinc-200 whitespace-pre-wrap flex-1">
                  {item.data.body}
                </span>
                <span className="shrink-0 text-xs text-zinc-600">
                  {formatTime(item.data.createdAt)}
                </span>
                <button
                  onClick={() => setDeleteTarget(item.data.id)}
                  aria-label="削除"
                  className="shrink-0 text-zinc-600 hover:text-red-400"
                >
                  ×
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="この出来事メモを削除しますか?"
        confirmLabel="削除する"
        danger
        onConfirm={() => deleteTarget && deleteLog(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}

"use client";

// キャンペーン続編の作成ダイアログ。
// 前回のあらすじをAIで生成 (編集可能) → 新セッションを作成し、メンバーの最終状態を引き継ぐ。
import { useState } from "react";
import { useRouter } from "next/navigation";

export function SequelDialog({
  open,
  onClose,
  sessionId,
  sessionTitle,
  scenario,
  characterIds,
  cachedSummary,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  sessionTitle: string;
  scenario: string;
  characterIds: string[];
  cachedSummary: string | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(`${sessionTitle} (続)`);
  const [summary, setSummary] = useState(cachedSummary ?? "");
  const [newScenario, setNewScenario] = useState(scenario);
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function generate() {
    if (generating) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(`/api/ai-gm/sessions/${sessionId}/summary`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "あらすじの生成に失敗しました");
        return;
      }
      setSummary(data.summary);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setGenerating(false);
    }
  }

  async function create() {
    if (busy || !title.trim() || !newScenario.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai-gm/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          scenario: newScenario,
          characterIds,
          previousSessionId: sessionId,
          summaryText: summary.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "続編の作成に失敗しました");
        return;
      }
      router.push(`/ai-gm/${data.id}`);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="続編セッションを作成"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-5 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-lg">▶ 続編セッションを作成</h2>
        <p className="text-xs text-zinc-400">
          参加探索者と現在のHP/MP/SAN(7版は幸運も)を引き継ぎます。あらすじは新セッションのキーパーに渡されます。
        </p>

        <label className="block text-sm space-y-1">
          <span className="text-zinc-400">新しいタイトル</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          />
        </label>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">前回のあらすじ (編集可)</span>
            <button
              onClick={generate}
              disabled={generating}
              className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-50"
            >
              {generating ? "生成中…" : "📝 AIで自動生成"}
            </button>
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={6}
            maxLength={5000}
            placeholder="前回の展開の要約。AIで生成するか手動で入力してください (空でも作成できます)"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <label className="block text-sm space-y-1">
          <span className="text-zinc-400">
            シナリオ (キーパー用。前回の内容が初期値。続章の展開を追記/差し替え可)
          </span>
          <textarea
            value={newScenario}
            onChange={(e) => setNewScenario(e.target.value)}
            rows={8}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </label>

        {error && (
          <p className="rounded border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded border border-zinc-700 px-4 py-2 text-sm hover:border-zinc-500 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={create}
            disabled={busy || !title.trim() || !newScenario.trim()}
            className="rounded bg-emerald-600 px-5 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? "作成中…" : "続編を開始する"}
          </button>
        </div>
      </div>
    </div>
  );
}

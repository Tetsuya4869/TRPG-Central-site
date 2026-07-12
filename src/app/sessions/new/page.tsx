"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ScenarioSummary {
  id: string;
  title: string;
}

export default function NewSessionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // 失敗時は空配列にフォールバック (紐付けセレクトを出さないだけで作成は可能)
    fetch("/api/scenarios")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setScenarios(Array.isArray(data) ? data : []))
      .catch(() => setScenarios([]));
  }, []);

  async function save() {
    if (!title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          scenarioName: scenarioName.trim() || null,
          scenarioId,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "作成に失敗しました");
        return;
      }
      router.push(`/sessions/${data.id}`);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">卓を立てる</h1>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <label className="block text-sm space-y-1">
          <span className="text-zinc-400">タイトル *</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 週末クトゥルフ卓"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-400">シナリオ名</span>
          <input
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder="例: 悪霊の家"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        {scenarios.length > 0 && (
          <label className="block text-sm space-y-1">
            <span className="text-zinc-400">📖 ライブラリのシナリオを紐付け (任意)</span>
            <select
              value={scenarioId ?? ""}
              onChange={(e) => {
                const id = e.target.value || null;
                setScenarioId(id);
                if (id) {
                  const found = scenarios.find((s) => s.id === id);
                  if (found && !scenarioName.trim()) setScenarioName(found.title);
                }
              }}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">紐付けない</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm space-y-1">
          <span className="text-zinc-400">開催日時</span>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-400">メモ</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="ハウスルール、持ち物、注意事項など"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          />
        </label>
      </div>
      {error && (
        <p className="rounded border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="rounded bg-emerald-600 px-6 py-2.5 font-semibold hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "作成中…" : "作成する"}
        </button>
        <button
          onClick={() => router.back()}
          className="rounded border border-zinc-700 px-6 py-2.5 hover:border-zinc-500"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

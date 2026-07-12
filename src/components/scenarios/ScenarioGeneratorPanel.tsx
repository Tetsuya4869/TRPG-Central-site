"use client";

import { useState } from "react";

export function ScenarioGeneratorPanel({
  onGenerated,
}: {
  onGenerated: (title: string, content: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("");
  const [setting, setSetting] = useState("");
  const [horrorLevel, setHorrorLevel] = useState<"低" | "中" | "高">("中");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    if (!theme.trim()) {
      setError("テーマを入力してください");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/scenarios/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: theme.trim(),
          setting: setting.trim() || undefined,
          horrorLevel,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "生成に失敗しました");
        return;
      }
      onGenerated(data.title, data.content);
      setOpen(false);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-purple-800/60 bg-purple-950/20 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-purple-200">
          🐙 AIでシナリオを生成
        </h2>
        <button
          onClick={() => setOpen(!open)}
          className="rounded border border-purple-700 px-3 py-1.5 text-xs text-purple-200 hover:bg-purple-900/40"
        >
          {open ? "閉じる" : "開く"}
        </button>
      </div>

      {open && (
        <div className="space-y-3">
          <label className="block text-sm space-y-1">
            <span className="text-zinc-400">テーマ *</span>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="例: 消えた友人を探す、曰く付きの骨董品"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-purple-500 focus:outline-none"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm space-y-1">
              <span className="text-zinc-400">舞台</span>
              <input
                value={setting}
                onChange={(e) => setSetting(e.target.value)}
                placeholder="例: 現代日本の廃病院"
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-purple-500 focus:outline-none"
              />
            </label>
            <label className="block text-sm space-y-1">
              <span className="text-zinc-400">ホラー度</span>
              <select
                value={horrorLevel}
                onChange={(e) => setHorrorLevel(e.target.value as "低" | "中" | "高")}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-purple-500 focus:outline-none"
              >
                <option value="低">低 (雰囲気重視)</option>
                <option value="中">中 (標準的な恐怖)</option>
                <option value="高">高 (容赦ないコズミックホラー)</option>
              </select>
            </label>
          </div>
          <label className="block text-sm space-y-1">
            <span className="text-zinc-400">追加要望</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例: 戦闘なし、NPCとの会話多め"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-purple-500 focus:outline-none"
            />
          </label>
          {error && (
            <p className="rounded border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <button
            onClick={generate}
            disabled={busy}
            className="rounded bg-purple-600 px-5 py-2 text-sm font-semibold hover:bg-purple-500 disabled:opacity-50"
          >
            {busy ? "生成中… (30秒ほどかかります)" : "生成する"}
          </button>
        </div>
      )}
    </section>
  );
}

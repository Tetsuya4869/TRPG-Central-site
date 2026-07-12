"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScenarioGeneratorPanel } from "./ScenarioGeneratorPanel";

export interface ScenarioFormValues {
  title: string;
  content: string;
  summary: string;
  tags: string; // カンマ区切り表示用
  source: string;
}

export function ScenarioForm({
  initial,
  scenarioId,
}: {
  initial?: ScenarioFormValues;
  scenarioId?: string; // 指定時は編集モード(PUT)
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [tags, setTags] = useState(initial?.tags ?? "");
  const [source, setSource] = useState(initial?.source ?? "MANUAL");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim() || !content.trim()) {
      setError("タイトルと本文を入力してください");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        scenarioId ? `/api/scenarios/${scenarioId}` : "/api/scenarios",
        {
          method: scenarioId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            content: content.trim(),
            summary: summary.trim() || null,
            tags: tags
              .split(/[,、]/)
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 10),
            source,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "保存に失敗しました");
        return;
      }
      router.push(`/scenarios/${data.id}`);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {!scenarioId && (
        <ScenarioGeneratorPanel
          onGenerated={(genTitle, genContent) => {
            if (!title.trim()) setTitle(genTitle);
            setContent(genContent);
            setSource("AI_GENERATED");
          }}
        />
      )}

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <label className="block text-sm space-y-1">
          <span className="text-zinc-400">タイトル *</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 開かずの地下室"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-400">概要 (一覧に表示)</span>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="例: 遺産相続で手に入れた屋敷を探索するクローズド"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-400">タグ (カンマ区切り、最大10個)</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="例: クローズド, ソロ向け, 短時間"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-400">
            本文 (導入・真相・NPC・手がかり・SANチェック・結末分岐) *
          </span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            placeholder="【導入】…&#10;【真相】(KPのみ)…&#10;【手がかり】…&#10;【結末分岐】…"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none font-mono text-sm"
          />
        </label>
      </section>

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
          {busy ? "保存中…" : scenarioId ? "更新する" : "保存する"}
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

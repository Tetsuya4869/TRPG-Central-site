"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface ScenarioRecord {
  id: string;
  title: string;
  summary: string | null;
  tags: string | null;
  source: string;
  updatedAt: string;
}

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"" | "MANUAL" | "AI_GENERATED">("");
  const [tagFilter, setTagFilter] = useState("");
  // 読み込みエラーは「まだシナリオがありません」と区別して表示する
  const [loadError, setLoadError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  // 削除確認ダイアログの対象シナリオ
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/scenarios");
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setScenarios(Array.isArray(data) ? data : []);
      setLoadError("");
    } catch {
      setLoadError("読み込みに失敗しました。再読み込みしてください");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const s of scenarios) {
      s.tags?.split(",").forEach((t) => t && tags.add(t));
    }
    return [...tags].sort();
  }, [scenarios]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scenarios.filter((s) => {
      if (sourceFilter && s.source !== sourceFilter) return false;
      if (tagFilter && !s.tags?.split(",").includes(tagFilter)) return false;
      if (
        q &&
        !s.title.toLowerCase().includes(q) &&
        !(s.summary ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [scenarios, query, sourceFilter, tagFilter]);

  async function remove() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setDeleteError("");
    try {
      const res = await fetch(`/api/scenarios/${target.id}`, { method: "DELETE" });
      if (!res.ok) {
        setDeleteError("削除に失敗しました");
        return;
      }
      await load();
    } catch {
      setDeleteError("通信エラーが発生しました");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📖 シナリオライブラリ</h1>
        <Link
          href="/scenarios/new"
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500"
        >
          + 新規作成
        </Link>
      </div>

      {/* 検索・フィルタ */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 タイトル・概要で検索"
          className="flex-1 min-w-48 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <div className="flex gap-1.5">
          {(
            [
              ["", "すべて"],
              ["MANUAL", "手動"],
              ["AI_GENERATED", "AI生成"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSourceFilter(value)}
              className={`rounded px-3 py-1.5 text-xs font-semibold border ${
                sourceFilter === value
                  ? "border-emerald-500 bg-emerald-600/30 text-emerald-200"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
              className={`rounded px-2 py-0.5 text-xs border ${
                tagFilter === tag
                  ? "border-emerald-500 bg-emerald-600/30 text-emerald-200"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {deleteError && (
        <p className="rounded border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">
          {deleteError}
        </p>
      )}

      {loading ? (
        <p className="text-zinc-500">読み込み中…</p>
      ) : loadError ? (
        <p className="rounded border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {loadError}
        </p>
      ) : scenarios.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-500">
          <p className="mb-4">まだシナリオがありません</p>
          <Link href="/scenarios/new" className="text-emerald-300 hover:underline">
            手書きまたはAI生成でシナリオを作る →
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
          条件に一致するシナリオがありません
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="flex items-start justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-emerald-600 transition-colors"
            >
              <Link href={`/scenarios/${s.id}`} className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{s.title}</h2>
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                      s.source === "AI_GENERATED"
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/50"
                        : "bg-zinc-500/20 text-zinc-400 border-zinc-500/50"
                    }`}
                  >
                    {s.source === "AI_GENERATED" ? "AI生成" : "手動"}
                  </span>
                  {s.tags?.split(",").map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
                {s.summary && (
                  <p className="text-sm text-zinc-500 mt-1">{s.summary}</p>
                )}
              </Link>
              <button
                onClick={() => setDeleteTarget({ id: s.id, title: s.title })}
                className="ml-4 text-xs text-zinc-600 hover:text-red-400"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`「${deleteTarget?.title ?? ""}」を削除しますか?`}
        message="使用中のセッションには影響しません。"
        confirmLabel="削除する"
        danger
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

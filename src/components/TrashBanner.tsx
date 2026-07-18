"use client";

// ゴミ箱にあるデータの詳細ページ上部に出す警告バナー (復元ボタン付き)。
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function TrashBanner({
  type,
  id,
  label,
}: {
  type: "character" | "scenario";
  id: string;
  label: string; // 例: "この探索者" / "このシナリオ"
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function restore() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, action: "restore" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "復元に失敗しました");
        return;
      }
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-700/60 bg-amber-950/20 px-4 py-3 text-sm">
      <span className="text-amber-200">
        🗑️ {label}はゴミ箱にあります。一覧や検索には表示されません。
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={restore}
          disabled={busy}
          className="rounded border border-emerald-700 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-950/50 disabled:opacity-50"
        >
          ♻️ 復元する
        </button>
        <Link href="/trash" className="text-xs text-zinc-400 hover:text-amber-300">
          ゴミ箱を開く →
        </Link>
      </div>
      {error && <p className="w-full text-xs text-red-300">{error}</p>}
    </div>
  );
}

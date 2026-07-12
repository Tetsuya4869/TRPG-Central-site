"use client";

import { useState } from "react";

export function CocofoliaExportButton({ json }: { json: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch {
      setError("クリップボードへのコピーに失敗しました");
    }
  }

  return (
    <div className="relative">
      <button
        onClick={copy}
        className="rounded border border-zinc-700 px-4 py-2 text-sm hover:border-emerald-500"
        title="ココフォリアの盤面に貼り付け(Ctrl+V)ると駒が作成されます。取り込めない場合はココフォリア側の仕様変更の可能性があります。"
      >
        {copied ? "✓ コピーしました" : "🎭 ココフォリア駒をコピー"}
      </button>
      {copied && (
        <p className="absolute top-full right-0 mt-1 w-64 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 z-10">
          ココフォリアの盤面で Ctrl+V (⌘+V) すると駒が作成されます
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}

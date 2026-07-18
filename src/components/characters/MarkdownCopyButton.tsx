"use client";

// キャラシートのMarkdownをクリップボードへコピーする (Discord等への共有向け)
import { useState } from "react";

export function MarkdownCopyButton({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError("クリップボードへのコピーに失敗しました");
    }
  }

  return (
    <div>
      <button
        onClick={copy}
        className="rounded border border-zinc-700 px-4 py-2 text-sm hover:border-emerald-500"
        title="能力値・技能・武器をMarkdownテキストでコピーします。Discordやメモアプリにそのまま貼り付けできます。"
      >
        {copied ? "✓ コピーしました" : "📋 Markdownコピー"}
      </button>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}

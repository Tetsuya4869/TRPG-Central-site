"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DuplicateCharacterButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    setBusy(true);
    const res = await fetch(`/api/characters/${id}/duplicate`, { method: "POST" });
    if (res.ok) {
      const copy = await res.json();
      router.push(`/characters/${copy.id}`);
      router.refresh();
    } else {
      alert("複製に失敗しました");
      setBusy(false);
    }
  }

  return (
    <button
      onClick={duplicate}
      disabled={busy}
      title="同じ内容の探索者を複製します (再プレイ用のバックアップに)"
      className="rounded border border-zinc-700 px-4 py-2 text-sm hover:border-emerald-500 disabled:opacity-50"
    >
      {busy ? "複製中…" : "⧉ 複製"}
    </button>
  );
}

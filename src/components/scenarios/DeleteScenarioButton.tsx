"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteScenarioButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`「${title}」を削除しますか? (使用中のセッションには影響しません)`))
      return;
    setBusy(true);
    const res = await fetch(`/api/scenarios/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      alert("削除に失敗しました");
    }
    setBusy(false);
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      className="ml-4 text-xs text-zinc-600 hover:text-red-400 disabled:opacity-50"
    >
      削除
    </button>
  );
}

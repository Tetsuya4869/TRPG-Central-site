"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteCharacterButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`「${name}」を削除しますか? この操作は取り消せません。`)) return;
    setBusy(true);
    const res = await fetch(`/api/characters/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/characters");
      router.refresh();
    } else {
      setBusy(false);
      alert("削除に失敗しました");
    }
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      className="rounded border border-red-900 px-4 py-2 text-sm text-red-400 hover:bg-red-950/50 disabled:opacity-50"
    >
      削除
    </button>
  );
}

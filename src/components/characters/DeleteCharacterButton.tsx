"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function DeleteCharacterButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setConfirming(false);
    setBusy(true);
    setError("");
    const res = await fetch(`/api/characters/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/characters");
      router.refresh();
    } else {
      setBusy(false);
      setError("削除に失敗しました");
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={() => setConfirming(true)}
        disabled={busy}
        className="rounded border border-red-900 px-4 py-2 text-sm text-red-400 hover:bg-red-950/50 disabled:opacity-50"
      >
        削除
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
      <ConfirmDialog
        open={confirming}
        title={`「${name}」を削除しますか?`}
        message="この操作は取り消せません。"
        confirmLabel="削除する"
        danger
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

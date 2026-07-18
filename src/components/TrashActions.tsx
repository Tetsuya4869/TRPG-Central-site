"use client";

// ゴミ箱の行アクション (復元 / 完全削除)。完全削除のみ確認ダイアログを挟む。
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function TrashActions({
  type,
  id,
  name,
}: {
  type: "character" | "scenario";
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  async function act(action: "restore" | "purge") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "操作に失敗しました");
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
    <div className="flex items-center gap-2">
      <button
        onClick={() => act("restore")}
        disabled={busy}
        className="rounded border border-emerald-700 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-950/50 disabled:opacity-50"
      >
        ♻️ 復元
      </button>
      <button
        onClick={() => setConfirming(true)}
        disabled={busy}
        className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-500 hover:border-red-600 hover:text-red-300 disabled:opacity-50"
      >
        完全削除
      </button>
      {error && <span className="text-xs text-red-300">{error}</span>}
      <ConfirmDialog
        open={confirming}
        title={`「${name}」を完全に削除しますか?`}
        message={
          type === "character"
            ? "この操作は取り消せません。卓への参加記録やプレイ履歴からも失われます。"
            : "この操作は取り消せません。添付のNPC・ハンドアウト資料も削除されます (卓との紐付けは外れます)。"
        }
        confirmLabel="完全に削除する"
        danger
        onConfirm={() => {
          setConfirming(false);
          act("purge");
        }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

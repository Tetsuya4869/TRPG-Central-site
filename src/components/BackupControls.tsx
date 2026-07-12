"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function BackupControls() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // 復元確認待ちのファイル (nullでなければダイアログ表示)
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  async function importFile(file: File) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const text = await file.text();
      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "復元に失敗しました");
        return;
      }
      setMessage(
        `✓ 復元しました (探索者${data.restored.characters} / シナリオ${data.restored.scenarios} / 卓${data.restored.gameSessions} / AI GM${data.restored.aiGmSessions})`,
      );
      router.refresh();
    } catch {
      setError("ファイルの読み込みに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-4">
        <a href="/api/backup" className="text-sm text-emerald-300 hover:underline">
          ダウンロード →
        </a>
        <label className="cursor-pointer text-sm text-zinc-400 hover:text-amber-300">
          {busy ? "復元中…" : "復元 (インポート)"}
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPendingFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {message && <p className="text-xs text-emerald-300">{message}</p>}
      {error && <p className="text-xs text-red-300">{error}</p>}
      <ConfirmDialog
        open={pendingFile !== null}
        title="バックアップから復元しますか?"
        message={
          "⚠️ 現在の全データ(探索者・シナリオ・卓・プレイログ)がバックアップの内容に置き換えられます。この操作は取り消せません。\n⚠️ 立ち絵などの画像ファイル(public/uploads)はバックアップに含まれません。"
        }
        confirmLabel="復元する"
        danger
        onConfirm={() => {
          const file = pendingFile;
          setPendingFile(null);
          if (file) importFile(file);
        }}
        onCancel={() => setPendingFile(null)}
      />
    </div>
  );
}

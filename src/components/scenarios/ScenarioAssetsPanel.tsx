"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export interface ScenarioAssetRecord {
  id: string;
  kind: "NPC" | "HANDOUT";
  name: string;
  content: string;
  imageUrl: string | null;
}

const KIND_LABELS = { NPC: "NPC", HANDOUT: "ハンドアウト" } as const;

export function ScenarioAssetsPanel({
  scenarioId,
  readOnly = false,
}: {
  scenarioId: string;
  readOnly?: boolean;
}) {
  const [assets, setAssets] = useState<ScenarioAssetRecord[]>([]);
  const [tab, setTab] = useState<"NPC" | "HANDOUT">("NPC");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 削除確認待ちの資料 (nullでなければダイアログ表示)
  const [deleteTarget, setDeleteTarget] = useState<ScenarioAssetRecord | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/scenarios/${scenarioId}/assets`);
    if (res.ok) setAssets(await res.json());
  }, [scenarioId]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadImage(file: File) {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "画像のアップロードに失敗しました");
        return;
      }
      setImageUrl(data.url);
    } finally {
      setUploading(false);
    }
  }

  async function add() {
    if (!name.trim() || !content.trim()) {
      setError("名前と内容を入力してください");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/scenarios/${scenarioId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: tab,
          name: name.trim(),
          content: content.trim(),
          imageUrl: imageUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "追加に失敗しました");
        return;
      }
      setName("");
      setContent("");
      setImageUrl("");
      setShowForm(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(asset: ScenarioAssetRecord) {
    setDeleteTarget(null);
    setDeleteError("");
    const res = await fetch(`/api/scenarios/${scenarioId}/assets/${asset.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setDeleteError(`「${asset.name}」の削除に失敗しました`);
      return;
    }
    await load();
  }

  const filtered = assets.filter((a) => a.kind === tab);

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-zinc-300">資料</h2>
          {(["NPC", "HANDOUT"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded px-3 py-1 text-xs font-semibold border ${
                tab === k
                  ? "border-emerald-500 bg-emerald-600/30 text-emerald-200"
                  : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
              }`}
            >
              {KIND_LABELS[k]} ({assets.filter((a) => a.kind === k).length})
            </button>
          ))}
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs text-emerald-300 hover:underline"
          >
            {showForm ? "閉じる" : `+ ${KIND_LABELS[tab]}を追加`}
          </button>
        )}
      </div>

      {!readOnly && showForm && (
        <div className="rounded border border-zinc-800 bg-zinc-950/50 p-3 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tab === "NPC" ? "NPC名 (例: 古書店主 佐伯)" : "資料名 (例: HO1 依頼書)"}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder={
              tab === "NPC"
                ? "立場・口調・知っていること・秘密など"
                : "プレイヤーに配布する内容"
            }
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <div className="flex items-center gap-3">
            <label className="cursor-pointer rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-emerald-500">
              {uploading ? "アップロード中…" : imageUrl ? "画像を変更" : "画像を添付"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadImage(file);
                  e.target.value = "";
                }}
              />
            </label>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
            )}
            <button
              onClick={add}
              disabled={busy}
              className="ml-auto rounded bg-emerald-600 px-4 py-1.5 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
            >
              追加
            </button>
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {KIND_LABELS[tab]}はまだありません
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((asset) => (
            <details
              key={asset.id}
              className="rounded border border-zinc-800 bg-zinc-950/50"
            >
              <summary className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                {asset.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.imageUrl}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover border border-zinc-700"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-sm">
                    {asset.kind === "NPC" ? "🧑" : "📄"}
                  </span>
                )}
                <span className="font-semibold">{asset.name}</span>
                {!readOnly && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setDeleteTarget(asset);
                    }}
                    aria-label="削除"
                    className="ml-auto text-xs text-zinc-600 hover:text-red-400"
                  >
                    削除
                  </button>
                )}
              </summary>
              <div className="border-t border-zinc-800 px-3 py-2">
                {asset.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.imageUrl}
                    alt={asset.name}
                    className="mb-2 max-h-48 rounded object-contain"
                  />
                )}
                <p className="whitespace-pre-wrap text-sm text-zinc-300">
                  {asset.content}
                </p>
              </div>
            </details>
          ))}
        </div>
      )}

      {deleteError && <p className="text-xs text-red-300">{deleteError}</p>}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`「${deleteTarget?.name ?? ""}」を削除しますか?`}
        message="この操作は取り消せません。"
        confirmLabel="削除する"
        danger
        onConfirm={() => {
          if (deleteTarget) remove(deleteTarget);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}

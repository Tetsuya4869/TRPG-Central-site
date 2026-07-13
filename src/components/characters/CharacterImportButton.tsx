"use client";

// Charaeno形式JSONから探索者をインポートする。ファイル選択 or 貼り付け → 送信 → 詳細へ。
import { useState } from "react";
import { useRouter } from "next/navigation";

export function CharacterImportButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(jsonText: string) {
    const trimmed = jsonText.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/characters/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: trimmed,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "インポートに失敗しました");
        return;
      }
      // 作成された探索者の詳細へ遷移
      router.push(`/characters/${data.character.id}`);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-zinc-700 px-4 py-2 text-sm font-semibold hover:border-emerald-500"
      >
        ⬇ インポート
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Charaenoからインポート"
            className="w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 p-5 space-y-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold">Charaenoからインポート</h2>
            <p className="text-xs text-zinc-400">
              Charaeno (新クトゥルフ7版) でエクスポートしたJSONを貼り付けるか、ファイルを選択してください。
              能力値・技能・基本情報を取り込みます (武器・立ち絵は取り込まれません)。
            </p>

            <label className="inline-block cursor-pointer rounded border border-zinc-700 px-3 py-1.5 text-sm hover:border-emerald-500">
              JSONファイルを選択
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                disabled={busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) {
                    const content = await file.text();
                    setText(content);
                    submit(content);
                  }
                }}
              />
            </label>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder='{ "name": "...", "characteristics": { "str": 60, ... }, "skills": [ ... ] }'
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none"
            />

            {error && (
              <p className="rounded border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded border border-zinc-700 px-4 py-1.5 text-sm hover:border-zinc-500 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={() => submit(text)}
                disabled={busy || !text.trim()}
                className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy ? "インポート中…" : "取り込む"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

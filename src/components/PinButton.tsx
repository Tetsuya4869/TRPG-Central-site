"use client";

// お気に入りピン留めのトグルボタン (探索者/シナリオ共用)。
// 一覧カードの上に置くため、クリックが親のLinkに伝播しないよう止める。
import { useState } from "react";
import { useRouter } from "next/navigation";

export function PinButton({
  type,
  id,
  pinned: initial,
  className = "",
  onToggled,
}: {
  type: "characters" | "scenarios";
  id: string;
  pinned: boolean;
  className?: string;
  /** クライアント一覧で使う場合の再読込コールバック (省略時は router.refresh) */
  onToggled?: () => void;
}) {
  const router = useRouter();
  const [pinned, setPinned] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !pinned;
    try {
      const res = await fetch(`/api/${type}/${id}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: next }),
      });
      if (res.ok) {
        setPinned(next);
        // 並び順 (ピン優先) を反映する
        if (onToggled) onToggled();
        else router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={pinned ? "ピン留めを外す" : "ピン留めする"}
      aria-pressed={pinned}
      title={pinned ? "ピン留めを外す" : "ピン留めして一覧の先頭に固定"}
      className={`text-lg leading-none transition-transform hover:scale-125 disabled:opacity-50 ${
        pinned ? "" : "opacity-30 grayscale hover:opacity-70"
      } ${className}`}
    >
      ⭐
    </button>
  );
}

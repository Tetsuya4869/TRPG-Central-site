"use client";

// ⌘K / Ctrl+K で開くコマンドパレット。
// 空入力ではページジャンプを表示し、入力するとサイト横断検索 (/api/search) の結果を出す。
// ↑↓で選択、Enterで移動、Escで閉じる。
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SearchResults {
  characters: { id: string; name: string; occupation: string | null; edition: string }[];
  sessions: { id: string; title: string; status: string; scheduledAt: string | null }[];
  scenarios: { id: string; title: string; tags: string | null; source: string }[];
  aiGmSessions: { id: string; title: string; status: string }[];
}

interface Item {
  key: string;
  icon: string;
  label: string;
  sub?: string;
  href: string;
  group: string;
}

// 空入力時に出すページジャンプ (検索語でも絞り込める)
const PAGES: Item[] = [
  { key: "p-home", icon: "🏠", label: "ダッシュボード", href: "/", group: "ページ" },
  { key: "p-char", icon: "📜", label: "探索者一覧", href: "/characters", group: "ページ" },
  { key: "p-char-new", icon: "✨", label: "探索者を新規作成", href: "/characters/new", group: "ページ" },
  { key: "p-sess", icon: "🕯️", label: "卓管理", href: "/sessions", group: "ページ" },
  { key: "p-sess-new", icon: "✨", label: "卓を立てる", href: "/sessions/new", group: "ページ" },
  { key: "p-scen", icon: "📖", label: "シナリオライブラリ", href: "/scenarios", group: "ページ" },
  { key: "p-dice", icon: "🎲", label: "ダイスローラー", href: "/dice", group: "ページ" },
  { key: "p-aigm", icon: "🐙", label: "AI GMプレイ", href: "/ai-gm", group: "ページ" },
  { key: "p-ref", icon: "📚", label: "ルール早見表", href: "/reference", group: "ページ" },
  { key: "p-manual", icon: "📘", label: "説明書", href: "/manual.html", group: "ページ" },
];

const SESSION_STATUS: Record<string, string> = {
  RECRUITING: "募集中",
  ONGOING: "進行中",
  FINISHED: "終了",
};

function toItems(q: string, results: SearchResults | null): Item[] {
  const pages = PAGES.filter(
    (p) => q === "" || p.label.toLowerCase().includes(q.toLowerCase()),
  );
  if (!results) return pages;
  const items: Item[] = [
    ...results.characters.map((c) => ({
      key: `c-${c.id}`,
      icon: "📜",
      label: c.name,
      sub: [c.edition === "7" ? "7版" : "6版", c.occupation].filter(Boolean).join(" / "),
      href: `/characters/${c.id}`,
      group: "探索者",
    })),
    ...results.sessions.map((s) => ({
      key: `s-${s.id}`,
      icon: "🕯️",
      label: s.title,
      sub: SESSION_STATUS[s.status] ?? s.status,
      href: `/sessions/${s.id}`,
      group: "卓",
    })),
    ...results.scenarios.map((s) => ({
      key: `n-${s.id}`,
      icon: "📖",
      label: s.title,
      sub: s.tags ?? undefined,
      href: `/scenarios/${s.id}`,
      group: "シナリオ",
    })),
    ...results.aiGmSessions.map((s) => ({
      key: `a-${s.id}`,
      icon: "🐙",
      label: s.title,
      sub: SESSION_STATUS[s.status] ?? s.status,
      href: `/ai-gm/${s.id}`,
      group: "AI GM",
    })),
  ];
  return [...items, ...pages];
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const items = toItems(query.trim(), query.trim() ? results : null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(null);
    setCursor(0);
  }, []);

  // ⌘K / Ctrl+K で開閉
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // 開いたら入力へフォーカス
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // 検索 (200msデバウンス、直前のリクエストは中断)
  useEffect(() => {
    const q = query.trim();
    if (!open || q === "") {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) {
          setResults(await res.json());
          setCursor(0);
        }
      } catch {
        // 中断・通信エラーは無視 (次の入力で再検索される)
      } finally {
        if (abortRef.current === ctrl) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open]);

  function go(item: Item) {
    close();
    if (item.href.endsWith(".html")) {
      window.location.href = item.href;
    } else {
      router.push(item.href);
    }
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && items[cursor]) {
      e.preventDefault();
      go(items[cursor]);
    }
  }

  // カーソル移動時に選択項目を見える位置へ
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  let lastGroup = "";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="検索 (Ctrl+K)"
        title="検索 (⌘K / Ctrl+K)"
        className="flex items-center gap-1.5 rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
      >
        🔍 <span className="hidden sm:inline">検索</span>
        <kbd className="hidden sm:inline rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
          ⌘K
        </kbd>
      </button>
      {open && (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh] px-4"
        onClick={close}
        role="dialog"
        aria-modal="true"
        aria-label="サイト内検索"
      >
        <div
          className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 border-b border-zinc-800 px-4">
            <span className="text-zinc-500">🔍</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              onKeyDown={onInputKey}
              placeholder="探索者・卓・シナリオを検索、またはページ名…"
              aria-label="検索キーワード"
              className="w-full bg-transparent py-3.5 text-sm focus:outline-none placeholder:text-zinc-600"
            />
            {loading && <span className="text-xs text-zinc-500 shrink-0">検索中…</span>}
            <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500 shrink-0">
              Esc
            </kbd>
          </div>
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-zinc-500">
                {loading ? "検索中…" : "見つかりませんでした"}
              </p>
            ) : (
              items.map((item, i) => {
                const header = item.group !== lastGroup ? item.group : null;
                lastGroup = item.group;
                return (
                  <div key={item.key}>
                    {header && (
                      <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-zinc-600">
                        {header}
                      </p>
                    )}
                    <button
                      data-index={i}
                      onClick={() => go(item)}
                      onMouseEnter={() => setCursor(i)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                        i === cursor ? "bg-emerald-600/20 text-emerald-200" : "text-zinc-300"
                      }`}
                    >
                      <span className="w-5 text-center">{item.icon}</span>
                      <span className="truncate font-medium">{item.label}</span>
                      {item.sub && (
                        <span className="ml-auto truncate text-xs text-zinc-500">{item.sub}</span>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex gap-3 border-t border-zinc-800 px-4 py-2 text-[11px] text-zinc-600">
            <span>↑↓ 選択</span>
            <span>Enter 移動</span>
            <span>Esc 閉じる</span>
          </div>
        </div>
      </div>
      )}
    </>
  );
}

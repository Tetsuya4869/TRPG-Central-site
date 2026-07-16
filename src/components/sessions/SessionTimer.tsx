"use client";

// 卓の経過時間タイマー + 休憩カウントダウン。
// 開始時刻・一時停止状態は localStorage に保存し、リロードしても継続する (単一ユーザー前提)。
import { useEffect, useState } from "react";

interface TimerState {
  startedAt: number | null; // 経過タイマーの開始エポックms
  pausedElapsed: number; // 一時停止までの累計ms (pause中のみ有効)
  paused: boolean;
  breakUntil: number | null; // 休憩終了エポックms
}

const EMPTY: TimerState = {
  startedAt: null,
  pausedElapsed: 0,
  paused: false,
  breakUntil: null,
};

function load(key: string): TimerState {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return EMPTY;
  }
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function SessionTimer({ sessionId }: { sessionId: string }) {
  const key = `trpg-timer-${sessionId}`;
  const [state, setState] = useState<TimerState>(EMPTY);
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);

  // localStorage はクライアントのみ。hydration後に読み込む
  useEffect(() => {
    setState(load(key));
    setNow(Date.now());
    setReady(true);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [key]);

  function save(next: TimerState) {
    setState(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // localStorage不可 (プライベートモード等) でもタイマー自体は動く
    }
  }

  if (!ready) return null;

  const running = state.startedAt != null && !state.paused;
  const elapsed = state.paused
    ? state.pausedElapsed
    : state.startedAt != null
      ? now - state.startedAt
      : 0;
  const breakLeft = state.breakUntil != null ? state.breakUntil - now : null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm">
      <span className="text-zinc-500">⏱️</span>
      <span className="font-mono text-lg font-semibold tabular-nums">
        {fmt(elapsed)}
      </span>
      {state.startedAt == null ? (
        <button
          onClick={() => save({ ...EMPTY, startedAt: Date.now() })}
          className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold hover:bg-emerald-500"
        >
          セッション開始
        </button>
      ) : (
        <>
          {running ? (
            <button
              onClick={() =>
                save({ ...state, paused: true, pausedElapsed: elapsed })
              }
              className="rounded border border-zinc-700 px-3 py-1 text-xs hover:border-zinc-500"
            >
              一時停止
            </button>
          ) : (
            <button
              onClick={() =>
                save({
                  ...state,
                  paused: false,
                  startedAt: Date.now() - state.pausedElapsed,
                })
              }
              className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold hover:bg-emerald-500"
            >
              再開
            </button>
          )}
          <button
            onClick={() => save(EMPTY)}
            className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-500 hover:border-zinc-500"
          >
            リセット
          </button>
        </>
      )}

      <span className="mx-1 text-zinc-700">|</span>
      {breakLeft != null && breakLeft > 0 ? (
        <>
          <span className="text-amber-300">
            ☕ 休憩あと <span className="font-mono tabular-nums">{fmt(breakLeft)}</span>
          </span>
          <button
            onClick={() => save({ ...state, breakUntil: null })}
            aria-label="休憩を終了"
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-500 hover:border-zinc-500"
          >
            終了
          </button>
        </>
      ) : breakLeft != null && breakLeft <= 0 ? (
        <>
          <span className="text-red-300 font-semibold">☕ 休憩終了!</span>
          <button
            onClick={() => save({ ...state, breakUntil: null })}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-500 hover:border-zinc-500"
          >
            OK
          </button>
        </>
      ) : (
        <span className="flex items-center gap-1">
          <span className="text-xs text-zinc-500">休憩:</span>
          {[10, 30, 60].map((min) => (
            <button
              key={min}
              onClick={() => save({ ...state, breakUntil: Date.now() + min * 60000 })}
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-amber-500 hover:text-amber-300"
            >
              {min}分
            </button>
          ))}
        </span>
      )}
    </div>
  );
}

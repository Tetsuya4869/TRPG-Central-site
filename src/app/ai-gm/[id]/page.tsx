"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { OutcomeBadge } from "@/components/dice/OutcomeBadge";
import { GrowthCheckModal } from "@/components/ai-gm/GrowthCheckModal";

interface DisplayMessage {
  kind: "user" | "assistant" | "tool";
  text?: string;
  data?: Record<string, unknown>;
}

interface GmState {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  san: number;
  maxSan: number;
}

interface SessionDetail {
  id: string;
  title: string;
  status: string;
  state: GmState;
  character: {
    id: string;
    name: string;
    occupation: string | null;
    imageUrl: string | null;
    skillsJson: string;
  };
  messages: DisplayMessage[];
  apiKeyConfigured: boolean;
}

function ToolCard({ data }: { data: Record<string, unknown> }) {
  const tool = data.tool as string;
  if (tool === "request_skill_check") {
    return (
      <div className="mx-auto flex items-center gap-3 rounded-lg border border-purple-800/60 bg-purple-950/30 px-4 py-2 text-sm">
        <span>🎲</span>
        <span className="text-zinc-300">{String(data.skill_name)}</span>
        <span className="font-mono text-lg font-bold text-purple-300">
          {String(data.roll)}
        </span>
        <span className="text-zinc-500">/ {String(data.target)}</span>
        <OutcomeBadge outcome={String(data.outcome)} />
      </div>
    );
  }
  if (tool === "san_check") {
    return (
      <div className="mx-auto flex items-center gap-3 rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-2 text-sm">
        <span>🧠</span>
        <span className="text-zinc-300">SANチェック</span>
        <span className="font-mono text-lg font-bold text-red-300">
          {String(data.roll)}
        </span>
        <span className="text-zinc-500">/ {String(data.target)}</span>
        <span className={data.success ? "text-emerald-300" : "text-red-300"}>
          {data.success ? "成功" : "失敗"}
        </span>
        <span className="text-zinc-400">
          SAN {String(data.san_before)} → {String(data.san_after)} (-
          {String(data.loss)})
        </span>
      </div>
    );
  }
  return (
    <div className="mx-auto flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-sm">
      <span>🎲</span>
      <span className="text-zinc-400">{String(data.reason ?? "")}</span>
      <span className="text-zinc-300">{String(data.expression)}</span>
      <span className="font-mono text-lg font-bold text-emerald-300">
        {String(data.total)}
      </span>
    </div>
  );
}

function StatBar({
  label,
  current,
  max,
  color,
}: {
  label: string;
  current: number;
  max: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="font-semibold">
          {current} / {max}
        </span>
      </div>
      <div className="h-1.5 rounded bg-zinc-800 overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{
            width: `${Math.min(100, Math.max(0, (current / Math.max(1, max)) * 100))}%`,
          }}
        />
      </div>
    </div>
  );
}

export default function AiGmPlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [state, setState] = useState<GmState | null>(null);
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showGrowthModal, setShowGrowthModal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/ai-gm/sessions/${id}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data: SessionDetail = await res.json();
    setSession(data);
    setMessages(data.messages);
    setState(data.state);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || busy || !session) return;
    setInput("");
    setBusy(true);
    setError("");
    setMessages((prev) => [...prev, { kind: "user", text: message }]);

    try {
      const res = await fetch(`/api/ai-gm/sessions/${id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "送信に失敗しました");
        setBusy(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentText = "";

      const flushText = () => {
        if (currentText) {
          const finished = currentText;
          setMessages((prev) => [...prev, { kind: "assistant", text: finished }]);
          currentText = "";
          setStreamingText("");
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          let event;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          switch (event.type) {
            case "text_delta":
              currentText += event.text;
              setStreamingText(currentText);
              break;
            case "tool":
              flushText();
              setMessages((prev) => [...prev, { kind: "tool", data: event.data }]);
              break;
            case "state":
              setState(event.state);
              break;
            case "error":
              flushText();
              setError(event.message);
              break;
            case "done":
              flushText();
              break;
          }
        }
      }
      flushText();
    } catch {
      setError("通信エラーが発生しました。再送信してください。");
    } finally {
      setStreamingText("");
      setBusy(false);
    }
  }

  async function finishSession() {
    if (!confirm("セッションを終了しますか? 終了後に技能成長チェックができます。")) return;
    await fetch(`/api/ai-gm/sessions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "FINISHED" }),
    });
    await load();
    setShowGrowthModal(true);
  }

  if (loading) return <p className="text-zinc-500">読み込み中…</p>;
  if (!session)
    return (
      <div className="space-y-4">
        <p className="text-red-300">セッションが見つかりません</p>
        <Link href="/ai-gm" className="text-emerald-300 hover:underline">
          ← AI GM一覧へ戻る
        </Link>
      </div>
    );

  const skills: Record<string, number> = (() => {
    try {
      return JSON.parse(session.character.skillsJson);
    } catch {
      return {};
    }
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_16rem] gap-6">
      {/* メイン: チャット */}
      <div className="flex flex-col h-[calc(100vh-12rem)]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold">{session.title}</h1>
            <p className="text-xs text-zinc-500">
              探索者: {session.character.name} / キーパー: Claude
            </p>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <a
                href={`/api/ai-gm/sessions/${id}/replay`}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-emerald-500 hover:text-emerald-300"
              >
                📄 リプレイをDL
              </a>
            )}
            {session.status === "ONGOING" ? (
              <button
                onClick={finishSession}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500"
              >
                セッションを終了
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowGrowthModal(true)}
                  className="rounded border border-emerald-800 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-950/50"
                >
                  📈 成長チェック
                </button>
                <span className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
                  終了済み
                </span>
              </>
            )}
          </div>
        </div>

        {!session.apiKeyConfigured && (
          <div className="mb-3 rounded border border-amber-700 bg-amber-950/40 px-4 py-2 text-sm text-amber-200">
            ⚠️ ANTHROPIC_API_KEY が未設定のため発言できません。.env
            にキーを設定してサーバーを再起動してください。
          </div>
        )}

        <div className="flex-1 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 space-y-4">
          {messages.length === 0 && !streamingText && (
            <div className="text-center text-zinc-500 py-10 space-y-3">
              <p>セッション開始の準備ができました。</p>
              <button
                onClick={() => send("セッションを開始してください。導入から語ってください。")}
                disabled={busy || !session.apiKeyConfigured || session.status !== "ONGOING"}
                className="rounded bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                ▶ セッションを開始する
              </button>
            </div>
          )}
          {messages.map((m, i) => {
            if (m.kind === "tool" && m.data) return <ToolCard key={i} data={m.data} />;
            if (m.kind === "user")
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] rounded-lg bg-emerald-900/40 border border-emerald-800/50 px-4 py-2 text-sm whitespace-pre-wrap">
                    {m.text}
                  </div>
                </div>
              );
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[85%] rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed">
                  {m.text}
                </div>
              </div>
            );
          })}
          {streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed">
                {streamingText}
                <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-0.5 align-text-bottom" />
              </div>
            </div>
          )}
          {busy && !streamingText && (
            <p className="text-center text-xs text-zinc-500 animate-pulse">
              キーパーが考えています…
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <p className="mt-2 rounded border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder={
              session.status !== "ONGOING"
                ? "このセッションは終了しています"
                : "行動を宣言する (例: 書斎の机を目星で調べます)"
            }
            disabled={busy || session.status !== "ONGOING" || !session.apiKeyConfigured}
            className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none disabled:opacity-50 resize-none"
          />
          <button
            onClick={() => send()}
            disabled={busy || !input.trim() || session.status !== "ONGOING" || !session.apiKeyConfigured}
            className="rounded bg-emerald-600 px-5 font-semibold hover:bg-emerald-500 disabled:opacity-50"
          >
            送信
          </button>
        </div>
      </div>

      {/* サイドバー */}
      <aside className="space-y-4 lg:sticky lg:top-20 self-start">
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          {session.character.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.character.imageUrl}
              alt={session.character.name}
              className="w-full rounded-lg object-cover border border-zinc-800 max-h-48"
            />
          )}
          <h2 className="text-sm font-semibold text-zinc-300">
            {session.character.name}
          </h2>
          {state && (
            <>
              <StatBar label="HP" current={state.hp} max={state.maxHp} color="bg-red-500" />
              <StatBar label="MP" current={state.mp} max={state.maxMp} color="bg-blue-500" />
              <StatBar label="SAN" current={state.san} max={state.maxSan} color="bg-purple-500" />
            </>
          )}
        </section>
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="text-sm font-semibold text-zinc-300 mb-2">主な技能</h2>
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {Object.entries(skills)
              .sort(([, a], [, b]) => b - a)
              .map(([name, value]) => (
                <div key={name} className="flex justify-between text-xs">
                  <span className="text-zinc-400 truncate">{name}</span>
                  <span className="font-mono text-emerald-300">{value}</span>
                </div>
              ))}
            {Object.keys(skills).length === 0 && (
              <p className="text-xs text-zinc-600">割り振り済み技能なし</p>
            )}
          </div>
        </section>
        <Link
          href="/ai-gm"
          className="block text-center text-xs text-zinc-500 hover:text-emerald-300"
        >
          ← セッション一覧へ
        </Link>
      </aside>

      {showGrowthModal && (
        <GrowthCheckModal
          sessionId={id}
          onClose={() => setShowGrowthModal(false)}
          onApplied={() => load()}
        />
      )}
    </div>
  );
}

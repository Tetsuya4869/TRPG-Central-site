"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DisplayMessage {
  kind: "user" | "assistant" | "tool";
  text?: string;
  data?: Record<string, unknown>;
}

export function KpAssistantPanel({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(true);
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}/assistant`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages);
    setApiKeyConfigured(data.apiKeyConfigured);
  }, [sessionId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setError("");
    setMessages((prev) => [...prev, { kind: "user", text: message }]);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/assistant/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "送信に失敗しました");
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
      setError("通信エラーが発生しました");
    } finally {
      setStreamingText("");
      setBusy(false);
    }
  }

  async function clearHistory() {
    if (!confirm("相談履歴をクリアしますか?")) return;
    await fetch(`/api/sessions/${sessionId}/assistant`, { method: "DELETE" });
    setMessages([]);
  }

  return (
    <section className="rounded-lg border border-purple-800/60 bg-purple-950/10 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-purple-200">🐙 AI KP補佐に相談</h2>
        <div className="flex gap-3">
          {open && messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs text-zinc-600 hover:text-red-400"
            >
              履歴クリア
            </button>
          )}
          <button
            onClick={() => setOpen(!open)}
            className="rounded border border-purple-700 px-3 py-1.5 text-xs text-purple-200 hover:bg-purple-900/40"
          >
            {open ? "閉じる" : "開く"}
          </button>
        </div>
      </div>

      {open && (
        <>
          <p className="text-xs text-zinc-500">
            NPCのセリフ案・情景描写・ルール裁定などを、卓のシナリオと参加探索者を踏まえて相談できます。進行はあなた(KP)が行います。
          </p>
          {!apiKeyConfigured && (
            <p className="rounded border border-amber-700 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
              ⚠️ ANTHROPIC_API_KEY が未設定のため利用できません
            </p>
          )}
          <div className="max-h-80 overflow-y-auto rounded border border-zinc-800 bg-zinc-950/70 p-3 space-y-3">
            {messages.length === 0 && !streamingText && (
              <p className="text-center text-xs text-zinc-600 py-4">
                例: 「古書店主のセリフを3案ください」「回避と応急手当、どちらを先に処理すべき?」
              </p>
            )}
            {messages.map((m, i) => {
              if (m.kind === "tool" && m.data)
                return (
                  <div
                    key={i}
                    className="mx-auto w-fit rounded border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs"
                  >
                    🎲 {String(m.data.reason ?? "")} {String(m.data.expression)} →{" "}
                    <span className="font-bold text-emerald-300">
                      {String(m.data.total)}
                    </span>
                  </div>
                );
              return (
                <div
                  key={i}
                  className={`flex ${m.kind === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.kind === "user"
                        ? "bg-purple-900/40 border border-purple-800/50"
                        : "bg-zinc-900 border border-zinc-800"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}
            {streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm whitespace-pre-wrap">
                  {streamingText}
                  <span className="inline-block w-1.5 h-3.5 bg-purple-400 animate-pulse ml-0.5 align-text-bottom" />
                </div>
              </div>
            )}
            {busy && !streamingText && (
              <p className="text-center text-xs text-zinc-500 animate-pulse">
                考えています…
              </p>
            )}
            <div ref={bottomRef} />
          </div>
          {error && (
            <p className="rounded border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
          <div className="flex gap-2">
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
              placeholder="KPとしての相談を入力…"
              disabled={busy || !apiKeyConfigured}
              className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none disabled:opacity-50 resize-none"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim() || !apiKeyConfigured}
              className="rounded bg-purple-600 px-4 text-sm font-semibold hover:bg-purple-500 disabled:opacity-50"
            >
              送信
            </button>
          </div>
        </>
      )}
    </section>
  );
}

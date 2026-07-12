"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScenarioGeneratorPanel } from "@/components/scenarios/ScenarioGeneratorPanel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface ScenarioSummary {
  id: string;
  title: string;
  content: string;
  summary: string | null;
}

interface AiGmSessionSummary {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  members: {
    id: string;
    character: { id: string; name: string; imageUrl: string | null };
  }[];
}

interface CharacterSummary {
  id: string;
  name: string;
  occupation: string | null;
}

const SAMPLE_SCENARIO = `【導入】探索者は、疎遠だった叔父の訃報を受け取る。叔父は郊外の古い屋敷で孤独死しており、遺言により屋敷は探索者に遺された。屋敷を訪れた探索者は、書斎で叔父の日記を見つける。日記の最後のページにはこう書かれていた——「地下室の扉を、決して開けてはならない」。

【真相(キーパー用)】叔父は地下室に封じられた「何か」を監視し続けていた。日記や書斎の手がかり(叔父の研究ノート、奇妙な石版、古い写真)から真相に近づける。地下室の扉を開けると神話的存在との遭遇が待つ。封印をやり直す・逃げる・立ち向かうなど複数の結末を用意する。`;

export default function AiGmPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<AiGmSessionSummary[]>([]);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [scenario, setScenario] = useState("");
  const [characterIds, setCharacterIds] = useState<string[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [generatedByAi, setGeneratedByAi] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  // 一覧の読み込み・削除エラー (フォーム内エラーとは別枠で表示)
  const [listError, setListError] = useState("");
  // 削除確認ダイアログの対象セッション
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const load = useCallback(async () => {
    setListError("");
    try {
      const [sRes, cRes, scRes] = await Promise.all([
        fetch("/api/ai-gm/sessions"),
        fetch("/api/characters"),
        fetch("/api/scenarios"),
      ]);
      if (!sRes.ok || !cRes.ok || !scRes.ok) throw new Error("load failed");
      const sData = await sRes.json();
      setSessions(Array.isArray(sData.sessions) ? sData.sessions : []);
      setApiKeyConfigured(sData.apiKeyConfigured);
      const characterList = await cRes.json();
      setCharacters(Array.isArray(characterList) ? characterList : []);
      const scenarioList: ScenarioSummary[] = await scRes.json();
      setScenarios(Array.isArray(scenarioList) ? scenarioList : []);
      // /scenarios/[id] の「このシナリオでAI GMプレイ」リンクからの遷移に対応
      const preselect = new URLSearchParams(window.location.search).get("scenarioId");
      if (preselect && Array.isArray(scenarioList)) {
        const found = scenarioList.find((sc) => sc.id === preselect);
        if (found) {
          setScenarioId(found.id);
          setScenario(found.content);
          setTitle((prev) => prev || found.title);
          setShowForm(true);
        }
      }
    } catch {
      // 読み込み失敗時は空一覧にフォールバックしてエラーを表示
      setSessions([]);
      setCharacters([]);
      setScenarios([]);
      setListError("読み込みに失敗しました。再読み込みしてください");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function selectFromLibrary(id: string) {
    if (!id) {
      setScenarioId(null);
      return;
    }
    const found = scenarios.find((sc) => sc.id === id);
    if (!found) return;
    setScenarioId(found.id);
    setScenario(found.content);
    setGeneratedByAi(false);
    setTitle((prev) => prev || found.title);
  }

  async function saveToLibrary() {
    if (!scenario.trim()) return;
    setSavingToLibrary(true);
    setError("");
    try {
      const res = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "無題のシナリオ",
          content: scenario.trim(),
          tags: [],
          source: generatedByAi ? "AI_GENERATED" : "MANUAL",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ライブラリへの保存に失敗しました");
        return;
      }
      setScenarioId(data.id);
      setScenarios((prev) => [data, ...prev]);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSavingToLibrary(false);
    }
  }

  async function create() {
    if (!title.trim() || !scenario.trim() || characterIds.length === 0) {
      setError("タイトル・シナリオ・探索者(1人以上)をすべて入力してください");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai-gm/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          scenario: scenario.trim(),
          characterIds,
          scenarioId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "作成に失敗しました");
        return;
      }
      router.push(`/ai-gm/${data.id}`);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setListError("");
    try {
      const res = await fetch(`/api/ai-gm/sessions/${target.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setListError("削除に失敗しました");
        return;
      }
      await load();
    } catch {
      setListError("通信エラーが発生しました");
    }
  }

  if (loading) return <p className="text-zinc-500">読み込み中…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🐙 AI GMプレイ</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500"
        >
          {showForm ? "閉じる" : "+ 新しいセッション"}
        </button>
      </div>

      {!apiKeyConfigured && (
        <div className="rounded border border-amber-700 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
          <p className="font-semibold mb-1">⚠️ ANTHROPIC_API_KEY が未設定です</p>
          <p className="text-amber-300/80">
            AI GM機能を使うには <code className="bg-zinc-900 px-1 rounded">.env</code> に
            Anthropic APIキーを設定し、サーバーを再起動してください。
            キーは <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" className="underline">console.anthropic.com</a> で取得できます。
            セッションの作成・閲覧はキーなしでも可能です。
          </p>
        </div>
      )}

      {characters.length === 0 && (
        <div className="rounded border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
          AI GMプレイには探索者が必要です。まず
          <Link href="/characters/new" className="text-emerald-300 hover:underline mx-1">
            探索者を作成
          </Link>
          してください。
        </div>
      )}

      {showForm && (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <h2 className="font-semibold text-zinc-300">新しいセッション</h2>
          <label className="block text-sm space-y-1">
            <span className="text-zinc-400">セッションタイトル *</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 開かずの地下室"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <div className="text-sm space-y-1">
            <span className="text-zinc-400">
              参加探索者 * (1〜4人、{characterIds.length}人選択中)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {characters.map((c) => {
                const checked = characterIds.includes(c.id);
                const full = !checked && characterIds.length >= 4;
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 rounded border px-3 py-2 cursor-pointer ${
                      checked
                        ? "border-emerald-600 bg-emerald-950/30"
                        : full
                          ? "border-zinc-800 opacity-40 cursor-not-allowed"
                          : "border-zinc-800 bg-zinc-950/50 hover:border-zinc-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={full}
                      onChange={(e) =>
                        setCharacterIds((prev) =>
                          e.target.checked
                            ? [...prev, c.id]
                            : prev.filter((id) => id !== c.id),
                        )
                      }
                      className="accent-emerald-500"
                    />
                    <span className="truncate">
                      {c.name}
                      {c.occupation && (
                        <span className="text-zinc-500 ml-1 text-xs">
                          {c.occupation}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          {scenarios.length > 0 && (
            <label className="block text-sm space-y-1">
              <span className="text-zinc-400">📖 ライブラリから選択</span>
              <select
                value={scenarioId ?? ""}
                onChange={(e) => selectFromLibrary(e.target.value)}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
              >
                <option value="">選択しない (下に直接入力)</option>
                {scenarios.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.title}
                    {sc.summary ? ` — ${sc.summary}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <ScenarioGeneratorPanel
            onGenerated={(genTitle, genContent) => {
              setScenario(genContent);
              setTitle((prev) => prev || genTitle);
              setScenarioId(null);
              setGeneratedByAi(true);
            }}
          />

          <label className="block text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">
                シナリオ (導入+キーパー用の真相メモ) *
              </span>
              <span className="flex gap-3">
                {scenario.trim() && !scenarioId && (
                  <button
                    onClick={saveToLibrary}
                    disabled={savingToLibrary}
                    className="text-xs text-purple-300 hover:underline disabled:opacity-50"
                  >
                    {savingToLibrary ? "保存中…" : "📖 ライブラリに保存"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setScenario(SAMPLE_SCENARIO);
                    setScenarioId(null);
                    setGeneratedByAi(false);
                  }}
                  className="text-xs text-emerald-300 hover:underline"
                >
                  サンプルを挿入
                </button>
              </span>
            </div>
            <textarea
              value={scenario}
              onChange={(e) => {
                setScenario(e.target.value);
                if (scenarioId) setScenarioId(null); // 編集したらライブラリ紐付けを外す
              }}
              rows={8}
              placeholder="シナリオの導入と、AIキーパーだけが知る真相・手がかり・結末の分岐を書いてください"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
            />
          </label>
          {error && (
            <p className="rounded border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <button
            onClick={create}
            disabled={busy}
            className="rounded bg-emerald-600 px-6 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? "作成中…" : "セッションを開始"}
          </button>
        </section>
      )}

      {listError && (
        <p className="rounded border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">
          {listError}
        </p>
      )}

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-500">
          まだAI GMセッションがありません
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-emerald-600 transition-colors"
            >
              <Link href={`/ai-gm/${s.id}`} className="flex flex-1 items-center gap-3">
                <span className="flex -space-x-2 shrink-0">
                  {s.members.slice(0, 4).map((m) =>
                    m.character.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={m.id}
                        src={m.character.imageUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover border border-zinc-700"
                      />
                    ) : (
                      <span
                        key={m.id}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-lg"
                      >
                        🐙
                      </span>
                    ),
                  )}
                </span>
                <span className="min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold">{s.title}</h2>
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                      s.status === "ONGOING"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                        : "bg-zinc-500/20 text-zinc-400 border-zinc-500/50"
                    }`}
                  >
                    {s.status === "ONGOING" ? "進行中" : "終了"}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 mt-1 truncate">
                  探索者: {s.members.map((m) => m.character.name).join("、")}
                </p>
                </span>
              </Link>
              <button
                onClick={() => setDeleteTarget({ id: s.id, title: s.title })}
                className="text-xs text-zinc-600 hover:text-red-400 ml-4"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`「${deleteTarget?.title ?? ""}」を削除しますか?`}
        message="プレイログも削除されます。"
        confirmLabel="削除する"
        danger
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

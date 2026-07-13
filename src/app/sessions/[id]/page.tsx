"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge, STATUS_LABELS } from "@/components/sessions/StatusBadge";
import { ScenarioAssetsPanel } from "@/components/scenarios/ScenarioAssetsPanel";
import { KpAssistantPanel } from "@/components/sessions/KpAssistantPanel";
import { CombatTracker, type CombatPc } from "@/components/sessions/CombatTracker";
import { SessionLogPanel } from "@/components/sessions/SessionLogPanel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface CharacterSummary {
  id: string;
  name: string;
  occupation: string | null;
  edition: string;
  currentHp: number;
  str: number;
  con: number;
  pow: number;
  dex: number;
  app: number;
  siz: number;
  int_: number;
  edu: number;
  skillsJson: string; // 戦闘トラッカーの武器命中判定に使う技能値
  weaponsJson: string; // 戦闘トラッカーの武器連携に使う
}

interface SessionDetail {
  id: string;
  title: string;
  scenarioName: string | null;
  scenario: { id: string; title: string } | null;
  scheduledAt: string | null;
  notes: string | null;
  status: string;
  combatJson: string | null;
  characters: { id: string; character: CharacterSummary }[];
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [allCharacters, setAllCharacters] = useState<CharacterSummary[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState("");
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  // 卓削除の確認ダイアログ
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(false);
  // 「外す」確認ダイアログの対象探索者
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  // ステータス変更の二重送信防止
  const [statusBusy, setStatusBusy] = useState(false);
  // 保存成功フィードバック (2秒で消える)
  const [statusSaved, setStatusSaved] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const load = useCallback(async () => {
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/sessions/${id}`),
      fetch("/api/characters"),
    ]);
    if (sRes.status === 404) {
      setError("卓が見つかりません");
      setLoading(false);
      return;
    }
    const s = await sRes.json();
    setSession(s);
    setNotes(s.notes ?? "");
    setAllCharacters(await cRes.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function update(patch: Record<string, unknown>): Promise<boolean> {
    setError("");
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "更新に失敗しました");
        return false;
      }
      setSession(data);
      return true;
    } catch {
      setError("通信エラーが発生しました");
      return false;
    }
  }

  async function changeStatus(status: string) {
    if (statusBusy) return;
    setStatusBusy(true);
    try {
      const ok = await update({ status });
      if (ok) {
        setStatusSaved(true);
        setTimeout(() => setStatusSaved(false), 2000);
      }
    } finally {
      setStatusBusy(false);
    }
  }

  async function saveNotes() {
    const ok = await update({ notes });
    if (ok) {
      setNotesDirty(false);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    }
  }

  async function addCharacter() {
    if (!selectedCharacter) return;
    setError("");
    const res = await fetch(`/api/sessions/${id}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: selectedCharacter }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "追加に失敗しました");
      return;
    }
    setSelectedCharacter("");
    await load();
  }

  async function removeCharacter() {
    if (!removeTarget) return;
    const target = removeTarget;
    setRemoveTarget(null);
    setError("");
    const res = await fetch(
      `/api/sessions/${id}/characters?characterId=${target.id}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      setError("参加探索者を外せませんでした");
      return;
    }
    await load();
  }

  async function removeSession() {
    setConfirmDeleteSession(false);
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/sessions");
      router.refresh();
    } else {
      setError("削除に失敗しました");
    }
  }

  if (loading) return <p className="text-zinc-500">読み込み中…</p>;
  if (!session)
    return (
      <div className="space-y-4">
        <p className="text-red-300">{error || "卓が見つかりません"}</p>
        <Link href="/sessions" className="text-emerald-300 hover:underline">
          ← 卓一覧へ戻る
        </Link>
      </div>
    );

  const memberIds = new Set(session.characters.map((sc) => sc.character.id));
  const addable = allCharacters.filter((c) => !memberIds.has(c.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{session.title}</h1>
          <StatusBadge status={session.status} />
        </div>
        <button
          onClick={() => setConfirmDeleteSession(true)}
          className="rounded border border-red-900 px-4 py-2 text-sm text-red-400 hover:bg-red-950/50"
        >
          削除
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* 基本情報+ステータス遷移 */}
          <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-3">
            <h2 className="font-semibold text-zinc-300">卓情報</h2>
            <dl className="text-sm space-y-2">
              <div className="flex gap-2">
                <dt className="text-zinc-500 w-24">シナリオ</dt>
                <dd>
                  {session.scenario ? (
                    <Link
                      href={`/scenarios/${session.scenario.id}`}
                      className="text-emerald-300 hover:underline"
                    >
                      📖 {session.scenarioName ?? session.scenario.title}
                    </Link>
                  ) : (
                    (session.scenarioName ?? "未定")
                  )}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-zinc-500 w-24">開催日時</dt>
                <dd>
                  {session.scheduledAt
                    ? new Date(session.scheduledAt).toLocaleString("ja-JP", {
                        dateStyle: "full",
                        timeStyle: "short",
                      })
                    : "未定"}
                </dd>
              </div>
            </dl>
            <div className="flex items-center gap-2 pt-2">
              <span className="text-sm text-zinc-500">ステータス:</span>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => changeStatus(value)}
                  disabled={statusBusy}
                  className={`rounded px-3 py-1 text-xs font-semibold border disabled:opacity-50 ${
                    session.status === value
                      ? "border-emerald-500 bg-emerald-600/30 text-emerald-200"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}
                >
                  {label}
                </button>
              ))}
              {statusSaved && (
                <span className="text-xs text-emerald-300">✓ 保存しました</span>
              )}
            </div>
          </section>

          {/* メモ */}
          <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-3">
            <h2 className="font-semibold text-zinc-300">メモ</h2>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setNotesDirty(true);
              }}
              rows={6}
              placeholder="シナリオメモ、進行状況など"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <div className="flex items-center gap-3">
              {notesDirty && (
                <button
                  onClick={saveNotes}
                  className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-semibold hover:bg-emerald-500"
                >
                  メモを保存
                </button>
              )}
              {notesSaved && (
                <span className="text-sm text-emerald-300">✓ 保存しました</span>
              )}
            </div>
          </section>
        </div>

        {/* 参加探索者 */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <h2 className="font-semibold text-zinc-300">
            参加探索者 ({session.characters.length}名)
          </h2>
          {session.characters.length === 0 ? (
            <p className="text-sm text-zinc-500">まだ参加者がいません</p>
          ) : (
            <ul className="space-y-2">
              {session.characters.map((sc) => (
                <li
                  key={sc.id}
                  className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/50 px-3 py-2"
                >
                  <Link
                    href={`/characters/${sc.character.id}`}
                    className="text-sm text-emerald-300 hover:underline"
                  >
                    {sc.character.name}
                    {sc.character.occupation && (
                      <span className="text-zinc-500 ml-2 text-xs">
                        {sc.character.occupation}
                      </span>
                    )}
                  </Link>
                  <button
                    onClick={() =>
                      setRemoveTarget({
                        id: sc.character.id,
                        name: sc.character.name,
                      })
                    }
                    className="text-xs text-zinc-600 hover:text-red-400"
                  >
                    外す
                  </button>
                </li>
              ))}
            </ul>
          )}
          {addable.length > 0 && (
            <div className="flex gap-2">
              <select
                value={selectedCharacter}
                onChange={(e) => setSelectedCharacter(e.target.value)}
                className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="">探索者を選択…</option>
                {addable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.occupation ? ` (${c.occupation})` : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={addCharacter}
                disabled={!selectedCharacter}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                追加
              </button>
            </div>
          )}
        </section>
      </div>

      {/* 戦闘トラッカー */}
      <CombatTracker
        sessionId={session.id}
        initialCombatJson={session.combatJson}
        pcs={session.characters.map((sc): CombatPc => ({
          characterId: sc.character.id,
          name: sc.character.name,
          edition: sc.character.edition,
          currentHp: sc.character.currentHp,
          stats: {
            str: sc.character.str,
            con: sc.character.con,
            pow: sc.character.pow,
            dex: sc.character.dex,
            app: sc.character.app,
            siz: sc.character.siz,
            int_: sc.character.int_,
            edu: sc.character.edu,
          },
          skillsJson: sc.character.skillsJson,
          weaponsJson: sc.character.weaponsJson,
        }))}
      />

      {/* 卓ログ (ダイス履歴 + 出来事メモの時系列) */}
      <SessionLogPanel sessionId={session.id} />

      {/* 紐付きシナリオのNPC・ハンドアウト (読み取り専用) */}
      {session.scenario && (
        <ScenarioAssetsPanel scenarioId={session.scenario.id} readOnly />
      )}

      {/* AI KP補佐 */}
      <KpAssistantPanel sessionId={session.id} />

      {error && (
        <p className="rounded border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirmDeleteSession}
        title={`「${session.title}」を削除しますか?`}
        confirmLabel="削除する"
        danger
        onConfirm={removeSession}
        onCancel={() => setConfirmDeleteSession(false)}
      />
      <ConfirmDialog
        open={removeTarget !== null}
        title={`${removeTarget?.name ?? ""} を参加者から外しますか?`}
        message="探索者データ自体は削除されません。"
        confirmLabel="外す"
        danger
        onConfirm={removeCharacter}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}

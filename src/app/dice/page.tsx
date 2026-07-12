"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OutcomeBadge } from "@/components/dice/OutcomeBadge";
import { deriveStatsFor, effectiveSkillsFor, type Edition } from "@/lib/coc";
import type { StatBlock } from "@/lib/coc6/types";

interface CharacterRecord {
  id: string;
  name: string;
  edition: string;
  luck: number | null;
  currentSan: number;
  str: number;
  con: number;
  pow: number;
  dex: number;
  app: number;
  siz: number;
  int_: number;
  edu: number;
  skillsJson: string;
}

interface DiceRollRecord {
  id: string;
  expression: string;
  rolls: string;
  total: number;
  target: number | null;
  outcome: string | null;
  context: string | null;
  source: string;
  createdAt: string;
}

const PRESETS = ["1d100", "1d10", "1d6", "2d6", "3d6", "1d4"];

export default function DicePage() {
  const [expression, setExpression] = useState("1d100");
  const [skillName, setSkillName] = useState("");
  const [target, setTarget] = useState("");
  const [history, setHistory] = useState<DiceRollRecord[]>([]);
  const [latest, setLatest] = useState<DiceRollRecord | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [checkEdition, setCheckEdition] = useState<Edition>("6");
  const [bonusDice, setBonusDice] = useState(0); // 7版: 正=ボーナス、負=ペナルティ
  const [madnessEdition, setMadnessEdition] = useState<Edition>("6");
  const [madness, setMadness] = useState<{
    roll: number;
    title: string;
    description: string;
    duration: string;
  } | null>(null);

  const fetchHistory = useCallback(async () => {
    const res = await fetch("/api/dice");
    if (res.ok) setHistory(await res.json());
  }, []);

  useEffect(() => {
    fetchHistory();
    fetch("/api/characters")
      .then((res) => res.json())
      .then(setCharacters)
      .catch(() => {});
  }, [fetchHistory]);

  // 選択中の探索者の判定ボタン一覧 (特殊判定+実効技能値)
  const characterChecks = useMemo(() => {
    const character = characters.find((c) => c.id === selectedCharacterId);
    if (!character) return null;
    const stats: StatBlock = {
      str: character.str,
      con: character.con,
      pow: character.pow,
      dex: character.dex,
      app: character.app,
      siz: character.siz,
      int_: character.int_,
      edu: character.edu,
    };
    let assigned: Record<string, number> = {};
    try {
      assigned = JSON.parse(character.skillsJson);
    } catch {
      // 壊れたJSONは無視して初期値のみで表示
    }
    const charEdition: Edition = character.edition === "7" ? "7" : "6";
    const derived = deriveStatsFor(charEdition, stats, assigned["クトゥルフ神話"] ?? 0);
    const special =
      charEdition === "7"
        ? [
            { name: "SANチェック", value: character.currentSan },
            { name: "幸運", value: character.luck ?? 0 },
            { name: "アイデア", value: stats.int_ },
            { name: "知識", value: stats.edu },
          ]
        : [
            { name: "SANチェック", value: character.currentSan },
            { name: "アイデア", value: derived.idea },
            { name: "幸運", value: derived.luck },
            { name: "知識", value: derived.knowledge },
          ];
    const skills = effectiveSkillsFor(charEdition, assigned, stats).map((s) => ({
      name: s.name,
      value: s.value,
      assigned: s.assigned,
    }));
    // 割り振り済みを先に、値の高い順
    skills.sort((a, b) =>
      a.assigned === b.assigned ? b.value - a.value : a.assigned ? -1 : 1,
    );
    return { character, edition: charEdition, special, skills };
  }, [characters, selectedCharacterId]);

  async function roll(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/dice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ロールに失敗しました");
        return;
      }
      setLatest(data);
      await fetchHistory();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  function rollExpression(expr: string) {
    setExpression(expr);
    roll({ expression: expr });
  }

  async function rollMadnessTable() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/madness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edition: madnessEdition }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "狂気表のロールに失敗しました");
        return;
      }
      setMadness(data);
      await fetchHistory();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  function rollSkillCheck() {
    const t = parseInt(target, 10);
    if (isNaN(t) || t < 1 || t > 100) {
      setError("目標値は1〜100で入力してください");
      return;
    }
    roll({
      target: t,
      context: skillName || undefined,
      edition: checkEdition,
      bonus: checkEdition === "7" && bonusDice > 0 ? bonusDice : 0,
      penalty: checkEdition === "7" && bonusDice < 0 ? -bonusDice : 0,
    });
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">🎲 ダイスローラー</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* 汎用ロール */}
          <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <h2 className="font-semibold text-zinc-300">ダイスロール</h2>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => rollExpression(p)}
                  disabled={busy}
                  className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && rollExpression(expression)}
                placeholder="例: 2d6+3"
                className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={() => rollExpression(expression)}
                disabled={busy}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                ロール
              </button>
            </div>
          </section>

          {/* 技能判定 */}
          <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-zinc-300">技能判定 (1d100)</h2>
              <div className="flex gap-1">
                {(["6", "7"] as const).map((ed) => (
                  <button
                    key={ed}
                    onClick={() => setCheckEdition(ed)}
                    className={`rounded px-2.5 py-1 text-xs font-semibold border ${
                      checkEdition === ed
                        ? "border-emerald-500 bg-emerald-600/30 text-emerald-200"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
                    }`}
                  >
                    {ed}版
                  </button>
                ))}
              </div>
            </div>
            {checkEdition === "7" && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-500">ボーナス/ペナルティ:</span>
                {[-2, -1, 0, 1, 2].map((n) => (
                  <button
                    key={n}
                    onClick={() => setBonusDice(n)}
                    className={`rounded px-2 py-1 border font-mono ${
                      bonusDice === n
                        ? "border-emerald-500 bg-emerald-600/30 text-emerald-200"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
                    }`}
                  >
                    {n > 0 ? `B${n}` : n < 0 ? `P${-n}` : "なし"}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="技能名 (例: 目星)"
                className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && rollSkillCheck()}
                placeholder="目標値"
                inputMode="numeric"
                className="w-24 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={rollSkillCheck}
                disabled={busy}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                判定
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              {checkEdition === "7"
                ? "01クリティカル / ≦1/5イクストリーム / ≦1/2ハード / 目標値<50は96–00・≧50は00ファンブル"
                : "01–05 クリティカル / 96–00 ファンブル / 出目≦目標値で成功"}
            </p>
          </section>

          {/* 探索者で判定 */}
          {characters.length > 0 && (
            <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-zinc-300">探索者で判定</h2>
                <select
                  value={selectedCharacterId}
                  onChange={(e) => setSelectedCharacterId(e.target.value)}
                  className="rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">探索者を選択…</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {characterChecks && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {characterChecks.special.map((s) => (
                      <button
                        key={s.name}
                        onClick={() =>
                          roll({
                            target: s.value,
                            context: `${characterChecks.character.name}/${s.name}`,
                            edition: characterChecks.edition,
                          })
                        }
                        disabled={busy}
                        className="rounded border border-purple-800 bg-purple-950/30 px-2.5 py-1 text-xs text-purple-200 hover:border-purple-500 disabled:opacity-50"
                      >
                        {s.name} {s.value}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {characterChecks.skills.map((s) => (
                      <button
                        key={s.name}
                        onClick={() =>
                          roll({
                            target: s.value,
                            context: `${characterChecks.character.name}/${s.name}`,
                            edition: characterChecks.edition,
                          })
                        }
                        disabled={busy}
                        className={`rounded border px-2.5 py-1 text-xs disabled:opacity-50 ${
                          s.assigned
                            ? "border-emerald-800 bg-emerald-950/30 text-emerald-200 hover:border-emerald-500"
                            : "border-zinc-800 text-zinc-500 hover:border-zinc-600"
                        }`}
                      >
                        {s.name} {s.value}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {error && (
            <p className="rounded border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          {/* 狂気表 */}
          <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-zinc-300">
                🌀 狂気表
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  SANを一度に5以上失ったら
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <div className="flex rounded border border-zinc-700 overflow-hidden text-xs">
                  {(["6", "7"] as const).map((ed) => (
                    <button
                      key={ed}
                      onClick={() => setMadnessEdition(ed)}
                      className={`px-2.5 py-1 ${
                        madnessEdition === ed
                          ? "bg-fuchsia-900/60 text-fuchsia-200"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {ed}版
                    </button>
                  ))}
                </div>
                <button
                  onClick={rollMadnessTable}
                  disabled={busy}
                  className="rounded bg-fuchsia-800/80 px-3 py-1.5 text-sm font-semibold text-fuchsia-100 hover:bg-fuchsia-700/80 disabled:opacity-50"
                >
                  1d10 ロール
                </button>
              </div>
            </div>
            {madness && (
              <div className="rounded border border-fuchsia-800/60 bg-fuchsia-950/30 px-4 py-3 space-y-1">
                <p className="text-sm">
                  <span className="font-mono font-bold text-fuchsia-300 mr-2">
                    {madness.roll}
                  </span>
                  <span className="font-bold text-fuchsia-200">{madness.title}</span>
                </p>
                <p className="text-xs text-zinc-400">{madness.description}</p>
                <p className="text-xs text-zinc-500">持続: {madness.duration}</p>
              </div>
            )}
          </section>

          {/* 最新結果 */}
          {latest && (
            <section className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-5 text-center space-y-2">
              <p className="text-sm text-zinc-400">
                {latest.context && <span className="mr-2">{latest.context}</span>}
                {latest.expression}
                {latest.target != null && ` (目標値 ${latest.target})`}
              </p>
              <p className="text-4xl font-bold text-emerald-300">{latest.total}</p>
              <p className="text-xs text-zinc-500">
                出目: {JSON.parse(latest.rolls).join(", ")}
              </p>
              <OutcomeBadge outcome={latest.outcome} />
            </section>
          )}
        </div>

        {/* 履歴 */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-semibold text-zinc-300 mb-3">履歴 (最新50件)</h2>
          {history.length === 0 ? (
            <p className="text-sm text-zinc-500">まだロールがありません</p>
          ) : (
            <ul className="space-y-1.5 max-h-[32rem] overflow-y-auto pr-1">
              {history.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded border border-zinc-800/60 bg-zinc-950/50 px-3 py-1.5 text-sm"
                >
                  <span className="font-mono text-emerald-300 w-10 text-right">
                    {r.total}
                  </span>
                  <span className="text-zinc-400">{r.expression}</span>
                  {r.target != null && (
                    <span className="text-zinc-500 text-xs">/{r.target}</span>
                  )}
                  <OutcomeBadge outcome={r.outcome} />
                  <span className="ml-auto text-xs text-zinc-500 truncate max-w-[8rem]">
                    {r.context}
                  </span>
                  {r.source === "AI_GM" && (
                    <span className="text-xs text-purple-400">AI</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

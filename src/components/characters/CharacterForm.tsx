"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { rollDice } from "@/lib/dice";
import { deriveStats, STAT_DICE } from "@/lib/coc6/stats";
import { SKILL_DEFS, skillBase, spentPoints } from "@/lib/coc6/skills";
import type { StatBlock, Skills } from "@/lib/coc6/types";

const STAT_LABELS: Record<keyof StatBlock, string> = {
  str: "STR",
  con: "CON",
  pow: "POW",
  dex: "DEX",
  app: "APP",
  siz: "SIZ",
  int_: "INT",
  edu: "EDU",
};

const STAT_KEYS = Object.keys(STAT_LABELS) as (keyof StatBlock)[];

export interface CharacterFormValues {
  name: string;
  playerName: string;
  occupation: string;
  age: string;
  sex: string;
  stats: StatBlock;
  skills: Skills;
  memo: string;
}

const defaultStats: StatBlock = {
  str: 10,
  con: 10,
  pow: 10,
  dex: 10,
  app: 10,
  siz: 13,
  int_: 13,
  edu: 13,
};

export function CharacterForm({
  initial,
  characterId,
}: {
  initial?: CharacterFormValues;
  characterId?: string; // 指定時は編集モード(PUT)
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [playerName, setPlayerName] = useState(initial?.playerName ?? "");
  const [occupation, setOccupation] = useState(initial?.occupation ?? "");
  const [age, setAge] = useState(initial?.age ?? "");
  const [sex, setSex] = useState(initial?.sex ?? "");
  const [stats, setStats] = useState<StatBlock>(initial?.stats ?? defaultStats);
  const [skills, setSkills] = useState<Skills>(initial?.skills ?? {});
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [customSkill, setCustomSkill] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const derived = useMemo(
    () => deriveStats(stats, skills["クトゥルフ神話"] ?? 0),
    [stats, skills],
  );
  const spent = useMemo(() => spentPoints(skills, stats), [skills, stats]);
  const totalPoints = derived.occupationPoints + derived.hobbyPoints;
  const remaining = totalPoints - spent;

  function rollAll() {
    const next = {} as StatBlock;
    for (const key of STAT_KEYS) {
      next[key] = rollDice(STAT_DICE[key]).total;
    }
    setStats(next);
  }

  function rollOne(key: keyof StatBlock) {
    setStats((prev) => ({ ...prev, [key]: rollDice(STAT_DICE[key]).total }));
  }

  function setStat(key: keyof StatBlock, value: string) {
    const n = parseInt(value, 10);
    setStats((prev) => ({ ...prev, [key]: isNaN(n) ? 0 : n }));
  }

  function setSkill(skillName: string, value: string, base: number) {
    const n = parseInt(value, 10);
    setSkills((prev) => {
      const next = { ...prev };
      if (value === "" || isNaN(n) || n === base) {
        // 初期値に戻したら明示的な割り振りを消す(カスタム技能は残す)
        if (SKILL_DEFS.some((d) => d.name === skillName)) {
          delete next[skillName];
          return next;
        }
      }
      next[skillName] = isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
      return next;
    });
  }

  function addCustomSkill() {
    const trimmed = customSkill.trim();
    if (!trimmed || skills[trimmed] !== undefined) return;
    setSkills((prev) => ({ ...prev, [trimmed]: 1 }));
    setCustomSkill("");
  }

  async function save() {
    if (!name.trim()) {
      setError("探索者名を入力してください");
      return;
    }
    setBusy(true);
    setError("");
    const payload = {
      name: name.trim(),
      playerName: playerName.trim() || null,
      occupation: occupation.trim() || null,
      age: age ? parseInt(age, 10) : null,
      sex: sex.trim() || null,
      ...stats,
      skills,
      memo: memo.trim() || null,
    };
    try {
      const res = await fetch(
        characterId ? `/api/characters/${characterId}` : "/api/characters",
        {
          method: characterId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "保存に失敗しました");
        return;
      }
      router.push(`/characters/${data.id}`);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  const customSkills = Object.keys(skills).filter(
    (n) => !SKILL_DEFS.some((d) => d.name === n),
  );

  return (
    <div className="space-y-8">
      {/* 基本情報 */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <h2 className="font-semibold text-zinc-300">基本情報</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-sm space-y-1">
            <span className="text-zinc-400">探索者名 *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-zinc-400">プレイヤー名</span>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-zinc-400">職業</span>
            <input
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm space-y-1">
              <span className="text-zinc-400">年齢</span>
              <input
                value={age}
                onChange={(e) => setAge(e.target.value)}
                inputMode="numeric"
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-zinc-400">性別</span>
              <input
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-emerald-500 focus:outline-none"
              />
            </label>
          </div>
        </div>
      </section>

      {/* 能力値 */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-300">能力値</h2>
          <button
            onClick={rollAll}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-500"
          >
            🎲 全部ロール
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STAT_KEYS.map((key) => (
            <div
              key={key}
              className="rounded border border-zinc-800 bg-zinc-950 p-3 text-center space-y-1"
            >
              <div className="text-xs text-zinc-500">
                {STAT_LABELS[key]}{" "}
                <span className="text-zinc-600">({STAT_DICE[key]})</span>
              </div>
              <input
                value={stats[key] || ""}
                onChange={(e) => setStat(key, e.target.value)}
                inputMode="numeric"
                className="w-full bg-transparent text-center text-xl font-bold focus:outline-none"
              />
              <button
                onClick={() => rollOne(key)}
                className="text-xs text-zinc-500 hover:text-emerald-300"
              >
                ロール
              </button>
            </div>
          ))}
        </div>
        {/* 派生値 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          {[
            ["SAN", derived.san],
            ["耐久力 (HP)", derived.hp],
            ["MP", derived.mp],
            ["アイデア", derived.idea],
            ["幸運", derived.luck],
            ["知識", derived.knowledge],
            ["DB", derived.damageBonus],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between rounded border border-zinc-800/60 bg-zinc-950/60 px-3 py-1.5"
            >
              <span className="text-zinc-500">{label}</span>
              <span className="font-semibold text-emerald-300">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 技能 */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-zinc-300">技能割り振り</h2>
          <div className="text-sm">
            <span className="text-zinc-500">
              職業P {derived.occupationPoints} + 趣味P {derived.hobbyPoints} ={" "}
              {totalPoints} / 消費 {spent} / 残り{" "}
            </span>
            <span
              className={`font-bold ${remaining < 0 ? "text-red-400" : "text-emerald-300"}`}
            >
              {remaining}
            </span>
          </div>
        </div>
        {(["戦闘", "探索", "行動", "交渉", "知識"] as const).map((cat) => (
          <div key={cat}>
            <h3 className="text-xs text-zinc-500 mb-1.5">{cat}系</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {SKILL_DEFS.filter((d) => d.category === cat).map((def) => {
                const base = skillBase(def, stats);
                const value = skills[def.name] ?? base;
                const modified = value !== base;
                return (
                  <label
                    key={def.name}
                    className={`flex items-center justify-between gap-1 rounded border px-2 py-1 text-xs ${
                      modified
                        ? "border-emerald-700 bg-emerald-950/30"
                        : "border-zinc-800 bg-zinc-950/50"
                    }`}
                  >
                    <span className="truncate text-zinc-300">
                      {def.name}
                      <span className="text-zinc-600 ml-1">{base}</span>
                    </span>
                    <input
                      value={value}
                      onChange={(e) => setSkill(def.name, e.target.value, base)}
                      inputMode="numeric"
                      className="w-10 bg-transparent text-right font-mono focus:outline-none text-emerald-200"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        {/* カスタム技能 */}
        <div>
          <h3 className="text-xs text-zinc-500 mb-1.5">カスタム技能</h3>
          {customSkills.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 mb-2">
              {customSkills.map((n) => (
                <label
                  key={n}
                  className="flex items-center justify-between gap-1 rounded border border-emerald-700 bg-emerald-950/30 px-2 py-1 text-xs"
                >
                  <span className="truncate text-zinc-300">{n}</span>
                  <input
                    value={skills[n]}
                    onChange={(e) => setSkill(n, e.target.value, 0)}
                    inputMode="numeric"
                    className="w-10 bg-transparent text-right font-mono focus:outline-none text-emerald-200"
                  />
                  <button
                    onClick={() =>
                      setSkills((prev) => {
                        const next = { ...prev };
                        delete next[n];
                        return next;
                      })
                    }
                    className="text-zinc-600 hover:text-red-400"
                  >
                    ×
                  </button>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={customSkill}
              onChange={(e) => setCustomSkill(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomSkill()}
              placeholder="技能名を追加 (例: 運転(バイク))"
              className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <button
              onClick={addCustomSkill}
              className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:border-emerald-500"
            >
              追加
            </button>
          </div>
        </div>
      </section>

      {/* メモ */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-2">
        <h2 className="font-semibold text-zinc-300">メモ</h2>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={4}
          placeholder="持ち物、背景設定など"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
      </section>

      {error && (
        <p className="rounded border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="rounded bg-emerald-600 px-6 py-2.5 font-semibold hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "保存中…" : characterId ? "更新する" : "作成する"}
        </button>
        <button
          onClick={() => router.back()}
          className="rounded border border-zinc-700 px-6 py-2.5 hover:border-zinc-500"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

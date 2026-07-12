"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deriveStatsFor,
  statDiceFor,
  skillDefsFor,
  skillBaseFor,
  spentPointsFor,
  rollStatValueFor,
  rollStatsFor,
  initialLuckFor,
  SKILL_CATEGORIES,
  type Edition,
} from "@/lib/coc";
import type { StatBlock, Skills } from "@/lib/coc6/types";
import type { Weapon } from "@/lib/weapons";

// 版ごとのよく使う武器プリセット
const WEAPON_PRESETS: Record<Edition, Weapon[]> = {
  "6": [
    { name: "こぶし", skillName: "こぶし(パンチ)", damage: "1d3+DB" },
    { name: "ナイフ", skillName: "ナイフ", damage: "1d4+DB" },
    { name: "拳銃 (.38)", skillName: "拳銃", damage: "1d10" },
  ],
  "7": [
    { name: "素手", skillName: "近接戦闘(格闘)", damage: "1d3+DB" },
    { name: "ナイフ", skillName: "近接戦闘(刀剣)", damage: "1d4+DB" },
    { name: "拳銃 (.38)", skillName: "射撃(拳銃)", damage: "1d10" },
  ],
};

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
  edition: Edition;
  luck: number | null;
  name: string;
  playerName: string;
  occupation: string;
  age: string;
  sex: string;
  imageUrl: string;
  stats: StatBlock;
  skills: Skills;
  weapons: Weapon[];
  memo: string;
}

const defaultStats6: StatBlock = {
  str: 10,
  con: 10,
  pow: 10,
  dex: 10,
  app: 10,
  siz: 13,
  int_: 13,
  edu: 13,
};

const defaultStats7: StatBlock = {
  str: 50,
  con: 50,
  pow: 50,
  dex: 50,
  app: 50,
  siz: 65,
  int_: 65,
  edu: 65,
};

export function CharacterForm({
  initial,
  characterId,
}: {
  initial?: CharacterFormValues;
  characterId?: string; // 指定時は編集モード(PUT)
}) {
  const router = useRouter();
  const [edition, setEdition] = useState<Edition>(initial?.edition ?? "6");
  const [luck, setLuck] = useState<number | null>(initial?.luck ?? null);
  const [name, setName] = useState(initial?.name ?? "");
  const [playerName, setPlayerName] = useState(initial?.playerName ?? "");
  const [occupation, setOccupation] = useState(initial?.occupation ?? "");
  const [age, setAge] = useState(initial?.age ?? "");
  const [sex, setSex] = useState(initial?.sex ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<StatBlock>(initial?.stats ?? defaultStats6);
  const [skills, setSkills] = useState<Skills>(initial?.skills ?? {});
  const [weapons, setWeapons] = useState<Weapon[]>(initial?.weapons ?? []);
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [customSkill, setCustomSkill] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const skillDefs = useMemo(() => skillDefsFor(edition), [edition]);
  const derived = useMemo(
    () => deriveStatsFor(edition, stats, skills["クトゥルフ神話"] ?? 0),
    [edition, stats, skills],
  );
  const spent = useMemo(
    () => spentPointsFor(edition, skills, stats),
    [edition, skills, stats],
  );
  const totalPoints = derived.occupationPoints + derived.hobbyPoints;
  const remaining = totalPoints - spent;
  const statDice = statDiceFor(edition);

  // 版切替は新規作成時のみ。技能初期値・派生値が全て変わるため割り振りはリセットする
  function switchEdition(next: Edition) {
    if (characterId || next === edition) return;
    setEdition(next);
    setStats(next === "7" ? defaultStats7 : defaultStats6);
    setSkills({});
    setLuck(next === "7" ? initialLuckFor("7") : null);
  }

  function rollAll() {
    setStats(rollStatsFor(edition));
    if (edition === "7") setLuck(initialLuckFor("7"));
  }

  function rollOne(key: keyof StatBlock) {
    setStats((prev) => ({ ...prev, [key]: rollStatValueFor(edition, key) }));
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
        if (skillDefs.some((d) => d.name === skillName)) {
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

  async function uploadImage(file: File) {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "画像のアップロードに失敗しました");
        return;
      }
      setImageUrl(data.url);
    } catch {
      setError("画像のアップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      setError("探索者名を入力してください");
      return;
    }
    setBusy(true);
    setError("");
    const payload = {
      edition,
      luck,
      name: name.trim(),
      playerName: playerName.trim() || null,
      occupation: occupation.trim() || null,
      age: age ? parseInt(age, 10) : null,
      sex: sex.trim() || null,
      imageUrl: imageUrl || null,
      ...stats,
      skills,
      weapons: weapons.filter((w) => w.name.trim() && w.skillName.trim() && w.damage.trim()),
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
    (n) => !skillDefs.some((d) => d.name === n),
  );

  return (
    <div className="space-y-8">
      {/* 版選択 (新規作成時のみ) */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-3">
        <h2 className="font-semibold text-zinc-300">ルール版</h2>
        {characterId ? (
          <p className="text-sm text-zinc-400">
            クトゥルフ神話TRPG <strong>{edition === "7" ? "7版" : "6版"}</strong>
            <span className="text-xs text-zinc-400 ml-2">(作成後は変更できません)</span>
          </p>
        ) : (
          <div className="flex gap-2">
            {(["6", "7"] as const).map((ed) => (
              <button
                key={ed}
                onClick={() => switchEdition(ed)}
                className={`rounded px-4 py-2 text-sm font-semibold border ${
                  edition === ed
                    ? "border-emerald-500 bg-emerald-600/30 text-emerald-200"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                {ed}版{ed === "7" && " (×5表記・成功度)"}
              </button>
            ))}
          </div>
        )}
      </section>

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
          <div className="sm:col-span-2 space-y-2">
            <span className="text-sm text-zinc-400">立ち絵</span>
            <div className="flex items-center gap-4">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="立ち絵"
                  className="h-24 w-24 rounded object-cover border border-zinc-700"
                />
              ) : (
                <div className="h-24 w-24 rounded border border-dashed border-zinc-700 flex items-center justify-center text-2xl text-zinc-600">
                  👤
                </div>
              )}
              <div className="space-y-2">
                <label className="inline-block cursor-pointer rounded border border-zinc-700 px-3 py-1.5 text-sm hover:border-emerald-500">
                  {uploading ? "アップロード中…" : "画像を選択"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadImage(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {imageUrl && (
                  <button
                    onClick={() => setImageUrl("")}
                    className="block text-xs text-zinc-500 hover:text-red-400"
                  >
                    画像を外す
                  </button>
                )}
                <p className="text-xs text-zinc-400">PNG/JPEG/WebP/GIF、5MBまで</p>
              </div>
            </div>
          </div>
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
                <span className="text-zinc-600">({statDice[key]})</span>
              </div>
              <input
                value={stats[key] || ""}
                onChange={(e) => setStat(key, e.target.value)}
                aria-label={STAT_LABELS[key]}
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
        {/* 7版: 幸運 (独立ロール) */}
        {edition === "7" && (
          <div className="flex items-center gap-3 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
            <span className="text-zinc-400">幸運 (3d6×5)</span>
            <input
              value={luck ?? ""}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setLuck(isNaN(n) ? null : Math.max(0, Math.min(99, n)));
              }}
              inputMode="numeric"
              className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-center font-bold focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => setLuck(initialLuckFor("7"))}
              className="text-xs text-zinc-500 hover:text-emerald-300"
            >
              ロール
            </button>
          </div>
        )}
        {/* 派生値 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          {(edition === "7"
            ? ([
                ["SAN (=POW)", derived.san],
                ["耐久力 (HP)", derived.hp],
                ["MP", derived.mp],
                ["DB", derived.damageBonus],
              ] as [string, number | string][])
            : ([
                ["SAN", derived.san],
                ["耐久力 (HP)", derived.hp],
                ["MP", derived.mp],
                ["アイデア", derived.idea],
                ["幸運", derived.luck],
                ["知識", derived.knowledge],
                ["DB", derived.damageBonus],
              ] as [string, number | string][])
          ).map(([label, value]) => (
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
        {SKILL_CATEGORIES.map((cat) => (
          <div key={cat}>
            <h3 className="text-xs text-zinc-500 mb-1.5">{cat}系</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {skillDefs.filter((d) => d.category === cat).map((def) => {
                const base = skillBaseFor(edition, def.name, stats) ?? 0;
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
                    aria-label="削除"
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

      {/* 武器 */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-zinc-300">武器</h2>
          <div className="flex flex-wrap gap-1.5">
            {WEAPON_PRESETS[edition].map((preset) => (
              <button
                key={preset.name}
                onClick={() =>
                  weapons.length < 20 && setWeapons((prev) => [...prev, { ...preset }])
                }
                className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-emerald-500 hover:text-emerald-300"
              >
                + {preset.name}
              </button>
            ))}
            <button
              onClick={() =>
                weapons.length < 20 &&
                setWeapons((prev) => [...prev, { name: "", skillName: "", damage: "" }])
              }
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-emerald-500 hover:text-emerald-300"
            >
              + 空欄で追加
            </button>
          </div>
        </div>
        {weapons.length === 0 ? (
          <p className="text-xs text-zinc-400">
            武器を登録すると、詳細画面から命中判定+ダメージロールをワンタップで行えます。ダメージ式の
            <code className="mx-1 rounded bg-zinc-950 px-1">DB</code>
            はダメージボーナス ({derived.damageBonus}) に自動で置き換わります。
          </p>
        ) : (
          <div className="space-y-1.5">
            <div className="hidden sm:grid grid-cols-[1fr_1fr_120px_1fr_28px] gap-1.5 text-xs text-zinc-400 px-1">
              <span>武器名</span>
              <span>技能</span>
              <span>ダメージ</span>
              <span>メモ</span>
              <span />
            </div>
            {weapons.map((w, i) => (
              <div
                key={i}
                className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_120px_1fr_28px] gap-1.5"
              >
                <input
                  value={w.name}
                  onChange={(e) =>
                    setWeapons((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                    )
                  }
                  placeholder="武器名"
                  className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                />
                <input
                  value={w.skillName}
                  onChange={(e) =>
                    setWeapons((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, skillName: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder="技能 (例: 拳銃)"
                  list="weapon-skill-options"
                  className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                />
                <input
                  value={w.damage}
                  onChange={(e) =>
                    setWeapons((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, damage: e.target.value } : x)),
                    )
                  }
                  placeholder="1d6+DB"
                  className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm font-mono focus:border-emerald-500 focus:outline-none"
                />
                <input
                  value={w.notes ?? ""}
                  onChange={(e) =>
                    setWeapons((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, notes: e.target.value || null } : x,
                      ),
                    )
                  }
                  placeholder="装弾数など"
                  className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                />
                <button
                  onClick={() => setWeapons((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="削除"
                  className="text-zinc-600 hover:text-red-400"
                  title="削除"
                >
                  ×
                </button>
              </div>
            ))}
            <datalist id="weapon-skill-options">
              {skillDefs
                .filter((d) => d.category === "戦闘")
                .map((d) => (
                  <option key={d.name} value={d.name} />
                ))}
              {customSkills.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
        )}
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

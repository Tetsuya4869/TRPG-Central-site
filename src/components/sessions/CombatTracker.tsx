"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  combatStateSchema,
  sortByDex,
  nextTurn,
  prevTurn,
  emptyCombat,
  type CombatState,
  type Combatant,
} from "@/lib/combat";
import { deriveStatsFor, type Edition } from "@/lib/coc";
import type { StatBlock } from "@/lib/coc6/types";

export interface CombatPc {
  characterId: string;
  name: string;
  edition: string;
  currentHp: number;
  stats: StatBlock;
}

function parseCombat(json: string | null): CombatState | null {
  if (!json) return null;
  try {
    return combatStateSchema.parse(JSON.parse(json));
  } catch {
    return null;
  }
}

export function CombatTracker({
  sessionId,
  initialCombatJson,
  pcs,
}: {
  sessionId: string;
  initialCombatJson: string | null;
  pcs: CombatPc[];
}) {
  const [combat, setCombat] = useState<CombatState | null>(
    parseCombat(initialCombatJson),
  );
  const [npcName, setNpcName] = useState("");
  const [npcDex, setNpcDex] = useState("");
  const [npcHp, setNpcHp] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // 最新のcombatを参照するためのref (debounce保存が古いstateを送らないように)
  const combatRef = useRef<CombatState | null>(combat);
  useEffect(() => {
    combatRef.current = combat;
  }, [combat]);
  // HP増減のdebounce保存タイマー
  const hpSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 「✓ 保存」表示を消すタイマー
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // アンマウント時にタイマーを破棄
  useEffect(() => {
    return () => {
      if (hpSaveTimer.current) clearTimeout(hpSaveTimer.current);
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    };
  }, []);

  // サーバーへの保存のみ行う (ローカルstateは呼び出し側で更新済み)
  async function persistRemote(state: CombatState | null) {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          combatJson: state ? JSON.stringify(state) : null,
        }),
      });
      if (!res.ok) {
        setSaveError("保存に失敗しました");
        return;
      }
      // 保存成功を短時間だけ表示
      setSavedFlash(true);
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 1500);
    } catch {
      setSaveError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function persist(state: CombatState | null) {
    // 保留中のHP保存があれば破棄 (この保存に最新stateが含まれる)
    if (hpSaveTimer.current) {
      clearTimeout(hpSaveTimer.current);
      hpSaveTimer.current = null;
    }
    setCombat(state);
    combatRef.current = state;
    await persistRemote(state);
  }

  // HP増減: ローカルへ即時反映し、保存はdebounceでまとめて1回のPUTにする
  // (連続クリックでPUTが並走し、古い応答で巻き戻る問題への対策)
  function changeHp(id: string, delta: number) {
    const current = combatRef.current;
    if (!current) return;
    const next: CombatState = {
      ...current,
      combatants: current.combatants.map((c) =>
        c.id === id ? { ...c, hp: c.hp + delta } : c,
      ),
    };
    combatRef.current = next;
    setCombat(next);
    if (hpSaveTimer.current) clearTimeout(hpSaveTimer.current);
    hpSaveTimer.current = setTimeout(() => {
      hpSaveTimer.current = null;
      persistRemote(combatRef.current);
    }, 500);
  }

  function addPc(pc: CombatPc) {
    if (!combat) return;
    if (combat.combatants.some((c) => c.characterId === pc.characterId)) return;
    const edition: Edition = pc.edition === "7" ? "7" : "6";
    const derived = deriveStatsFor(edition, pc.stats);
    const combatant: Combatant = {
      id: `pc-${pc.characterId}`,
      name: pc.name,
      kind: "PC",
      characterId: pc.characterId,
      dex: pc.stats.dex,
      hp: pc.currentHp,
      maxHp: derived.hp,
      memo: "",
    };
    persist({ ...combat, combatants: [...combat.combatants, combatant] });
  }

  function addNpc() {
    if (!combat || !npcName.trim()) return;
    const dex = parseInt(npcDex, 10) || 10;
    const hp = parseInt(npcHp, 10) || 10;
    // 保存済みIDと衝突しない連番を採る (Date.now()はReact Compilerの純粋性ルールに抵触)
    let n = 1;
    while (combat.combatants.some((c) => c.id === `npc-${n}`)) n += 1;
    const combatant: Combatant = {
      id: `npc-${n}`,
      name: npcName.trim(),
      kind: "NPC",
      characterId: null,
      dex,
      hp,
      maxHp: hp,
      memo: "",
    };
    setNpcName("");
    setNpcDex("");
    setNpcHp("");
    persist({ ...combat, combatants: [...combat.combatants, combatant] });
  }

  function removeCombatant(id: string) {
    if (!combat) return;
    const sorted = sortByDex(combat.combatants);
    const removedIndex = sorted.findIndex((c) => c.id === id);
    let turnIndex = combat.turnIndex;
    if (removedIndex !== -1 && removedIndex < turnIndex) turnIndex -= 1;
    const remaining = combat.combatants.filter((c) => c.id !== id);
    persist({
      ...combat,
      combatants: remaining,
      turnIndex: remaining.length === 0 ? 0 : Math.min(turnIndex, remaining.length - 1),
    });
  }

  if (!combat) {
    return (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-300">⚔️ 戦闘トラッカー</h2>
          <button
            onClick={() => persist(emptyCombat())}
            disabled={saving}
            className="rounded border border-red-900 px-4 py-1.5 text-sm text-red-300 hover:bg-red-950/50 disabled:opacity-50"
          >
            戦闘を開始
          </button>
        </div>
        {saveError && (
          <p className="mt-2 text-xs text-red-400">{saveError}</p>
        )}
      </section>
    );
  }

  const sorted = sortByDex(combat.combatants);

  return (
    <section className="rounded-lg border border-red-900/50 bg-red-950/10 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-red-200">
          ⚔️ 戦闘トラッカー — ラウンド {combat.round}
          {saving && <span className="ml-2 text-xs text-zinc-500">保存中…</span>}
          {!saving && savedFlash && !saveError && (
            <span className="ml-2 text-xs text-emerald-400">✓ 保存</span>
          )}
          {saveError && (
            <span className="ml-2 text-xs text-red-400">{saveError}</span>
          )}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => persist(prevTurn(combat))}
            disabled={saving}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-zinc-500 disabled:opacity-50"
          >
            ← 前の手番
          </button>
          <button
            onClick={() => persist(nextTurn(combat))}
            disabled={saving}
            className="rounded bg-red-700 px-4 py-1.5 text-xs font-semibold hover:bg-red-600 disabled:opacity-50"
          >
            次の手番 →
          </button>
          <button
            onClick={() => setConfirmReset(true)}
            disabled={saving}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 hover:border-zinc-500 disabled:opacity-50"
          >
            終了
          </button>
        </div>
      </div>

      {/* 戦闘リセットの確認ダイアログ */}
      <ConfirmDialog
        open={confirmReset}
        title="戦闘を終了しますか?"
        message="トラッカーの内容はリセットされます。"
        confirmLabel="終了する"
        danger
        onConfirm={() => {
          setConfirmReset(false);
          persist(null);
        }}
        onCancel={() => setConfirmReset(false)}
      />

      {/* イニシアチブ順リスト */}
      {sorted.length === 0 ? (
        <p className="text-sm text-zinc-500">下から参加者を追加してください</p>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((combatant, index) => {
            const active = index === combat.turnIndex;
            return (
              <li
                key={combatant.id}
                className={`flex flex-wrap items-center gap-2 rounded border px-3 py-2 text-sm ${
                  active
                    ? "border-red-500 bg-red-950/40"
                    : "border-zinc-800 bg-zinc-950/50"
                }`}
              >
                {active && <span className="text-red-300">▶</span>}
                <span className="font-mono text-xs text-zinc-500 w-12">
                  DEX{combatant.dex}
                </span>
                <span
                  className={`font-semibold ${combatant.kind === "PC" ? "text-emerald-300" : "text-zinc-300"} ${combatant.hp <= 0 ? "line-through opacity-50" : ""}`}
                >
                  {combatant.name}
                </span>
                <span className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={() => changeHp(combatant.id, -1)}
                    aria-label="HPを1減らす"
                    className="rounded border border-zinc-700 w-8 h-8 text-xs hover:border-red-500"
                  >
                    −
                  </button>
                  <span
                    className={`font-mono w-16 text-center ${combatant.hp <= 0 ? "text-red-400" : combatant.hp <= Math.floor(combatant.maxHp / 3) ? "text-amber-300" : ""}`}
                  >
                    {combatant.hp}/{combatant.maxHp}
                  </span>
                  <button
                    onClick={() => changeHp(combatant.id, +1)}
                    aria-label="HPを1増やす"
                    className="rounded border border-zinc-700 w-8 h-8 text-xs hover:border-emerald-500"
                  >
                    +
                  </button>
                </span>
                <input
                  value={combatant.memo}
                  onChange={(e) => setCombat({
                    ...combat,
                    combatants: combat.combatants.map((c) =>
                      c.id === combatant.id ? { ...c, memo: e.target.value } : c,
                    ),
                  })}
                  onBlur={() => persist(combat)}
                  placeholder="メモ (装甲、状態など)"
                  className="w-32 rounded border border-zinc-800 bg-transparent px-2 py-0.5 text-xs text-zinc-400 focus:border-zinc-600 focus:outline-none"
                />
                <button
                  onClick={() => removeCombatant(combatant.id)}
                  disabled={saving}
                  aria-label="削除"
                  className="w-8 h-8 rounded text-xs text-zinc-600 hover:text-red-400 disabled:opacity-50"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* 参加者追加 */}
      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
        {pcs
          .filter((pc) => !combat.combatants.some((c) => c.characterId === pc.characterId))
          .map((pc) => (
            <button
              key={pc.characterId}
              onClick={() => addPc(pc)}
              disabled={saving}
              className="rounded border border-emerald-800 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-950/50 disabled:opacity-50"
            >
              + {pc.name}
            </button>
          ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <input
            value={npcName}
            onChange={(e) => setNpcName(e.target.value)}
            placeholder="NPC/敵の名前"
            className="w-28 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs focus:border-red-500 focus:outline-none"
          />
          <input
            value={npcDex}
            onChange={(e) => setNpcDex(e.target.value)}
            placeholder="DEX"
            inputMode="numeric"
            className="w-14 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs focus:border-red-500 focus:outline-none"
          />
          <input
            value={npcHp}
            onChange={(e) => setNpcHp(e.target.value)}
            placeholder="HP"
            inputMode="numeric"
            className="w-14 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs focus:border-red-500 focus:outline-none"
          />
          <button
            onClick={addNpc}
            disabled={!npcName.trim() || saving}
            className="rounded border border-zinc-700 px-3 py-1 text-xs hover:border-red-500 disabled:opacity-50"
          >
            追加
          </button>
        </div>
      </div>
    </section>
  );
}

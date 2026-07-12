"use client";

import { useState } from "react";
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

  async function persist(state: CombatState | null) {
    setCombat(state);
    setSaving(true);
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          combatJson: state ? JSON.stringify(state) : null,
        }),
      });
    } finally {
      setSaving(false);
    }
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
    const combatant: Combatant = {
      id: `npc-${Date.now()}`,
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

  function updateCombatant(id: string, patch: Partial<Combatant>) {
    if (!combat) return;
    persist({
      ...combat,
      combatants: combat.combatants.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    });
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
            className="rounded border border-red-900 px-4 py-1.5 text-sm text-red-300 hover:bg-red-950/50"
          >
            戦闘を開始
          </button>
        </div>
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
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => persist(prevTurn(combat))}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-zinc-500"
          >
            ← 前の手番
          </button>
          <button
            onClick={() => persist(nextTurn(combat))}
            className="rounded bg-red-700 px-4 py-1.5 text-xs font-semibold hover:bg-red-600"
          >
            次の手番 →
          </button>
          <button
            onClick={() => {
              if (confirm("戦闘を終了してトラッカーをリセットしますか?")) persist(null);
            }}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 hover:border-zinc-500"
          >
            終了
          </button>
        </div>
      </div>

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
                    onClick={() =>
                      updateCombatant(combatant.id, { hp: combatant.hp - 1 })
                    }
                    className="rounded border border-zinc-700 w-6 h-6 text-xs hover:border-red-500"
                  >
                    −
                  </button>
                  <span
                    className={`font-mono w-16 text-center ${combatant.hp <= 0 ? "text-red-400" : combatant.hp <= Math.floor(combatant.maxHp / 3) ? "text-amber-300" : ""}`}
                  >
                    {combatant.hp}/{combatant.maxHp}
                  </span>
                  <button
                    onClick={() =>
                      updateCombatant(combatant.id, { hp: combatant.hp + 1 })
                    }
                    className="rounded border border-zinc-700 w-6 h-6 text-xs hover:border-emerald-500"
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
                  className="text-xs text-zinc-600 hover:text-red-400"
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
              className="rounded border border-emerald-800 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-950/50"
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
            disabled={!npcName.trim()}
            className="rounded border border-zinc-700 px-3 py-1 text-xs hover:border-red-500 disabled:opacity-50"
          >
            追加
          </button>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  combatStateSchema,
  sortByDex,
  nextTurn,
  prevTurn,
  emptyCombat,
  resolveAttack,
  STATUS_PRESETS,
  canFire,
  consumeAmmo,
  reloadWeapon,
  type CombatState,
  type Combatant,
  type CombatantWeapon,
} from "@/lib/combat";
import { deriveStatsFor, effectiveSkillsFor, type Edition } from "@/lib/coc";
import type { StatBlock } from "@/lib/coc6/types";
import { parseWeaponsJson } from "@/lib/weapons";

export interface CombatPc {
  characterId: string;
  name: string;
  edition: string;
  currentHp: number;
  stats: StatBlock;
  skillsJson: string;
  weaponsJson: string;
}

// PCの登録武器を、技能値スナップショット付きの戦闘用武器に変換する
function pcCombatWeapons(pc: CombatPc, edition: Edition): CombatantWeapon[] {
  let assigned: Record<string, number> = {};
  try {
    assigned = JSON.parse(pc.skillsJson);
  } catch {
    // 壊れたJSONは未割り振り扱い
  }
  const effective = effectiveSkillsFor(edition, assigned, pc.stats);
  return parseWeaponsJson(pc.weaponsJson).map((w) => ({
    ...w,
    skillValue:
      effective.find((s) => s.name === w.skillName)?.value ?? 0,
  }));
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

  // 攻撃フロー: どの戦闘員の攻撃パネルを開いているか / 選択中の武器 / 実行中 / 結果
  const [attackFor, setAttackFor] = useState<string | null>(null);
  const [pickWeapon, setPickWeapon] = useState<number | null>(null);
  const [attackBusy, setAttackBusy] = useState(false);
  const [attackError, setAttackError] = useState("");
  const [attackResult, setAttackResult] = useState<{
    attacker: string;
    target: string;
    weapon: string;
    roll: number;
    outcome: string;
    hit: boolean;
    damage: number | null;
    damageExpr: string;
  } | null>(null);
  // NPC武器追加フォーム
  const [nwName, setNwName] = useState("");
  const [nwSkill, setNwSkill] = useState("");
  const [nwDamage, setNwDamage] = useState("");
  const [nwAmmo, setNwAmmo] = useState("");
  // 状態異常パネル: どの戦闘員のパネルを開いているか / 自由入力
  const [statusFor, setStatusFor] = useState<string | null>(null);
  const [statusInput, setStatusInput] = useState("");
  // 応急手当: 実行中の戦闘員ID / 回復結果の短時間表示 / エラー
  const [healBusy, setHealBusy] = useState<string | null>(null);
  const [healFlash, setHealFlash] = useState<{
    name: string;
    amount: number;
  } | null>(null);
  const [healError, setHealError] = useState("");

  // 最新のcombatを参照するためのref (debounce保存が古いstateを送らないように)
  const combatRef = useRef<CombatState | null>(combat);
  useEffect(() => {
    combatRef.current = combat;
  }, [combat]);
  // HP増減のdebounce保存タイマー
  const hpSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 「✓ 保存」表示を消すタイマー
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 「🩹 +N」表示を消すタイマー
  const healFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // アンマウント時にタイマーを破棄
  useEffect(() => {
    return () => {
      if (hpSaveTimer.current) clearTimeout(hpSaveTimer.current);
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
      if (healFlashTimer.current) clearTimeout(healFlashTimer.current);
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

  // ローカルへ即時反映し、保存はdebounceでまとめて1回のPUTにする共通処理
  // (連続クリックでPUTが並走し、古い応答で巻き戻る問題への対策)
  function applyDebounced(next: CombatState) {
    combatRef.current = next;
    setCombat(next);
    if (hpSaveTimer.current) clearTimeout(hpSaveTimer.current);
    hpSaveTimer.current = setTimeout(() => {
      hpSaveTimer.current = null;
      persistRemote(combatRef.current);
    }, 500);
  }

  // HP増減: debounce保存 (applyDebounced) に載せる
  function changeHp(id: string, delta: number) {
    const current = combatRef.current;
    if (!current) return;
    applyDebounced({
      ...current,
      combatants: current.combatants.map((c) =>
        c.id === id ? { ...c, hp: c.hp + delta } : c,
      ),
    });
  }

  // 状態異常を付与する (重複・8個超・長さ超過は無視)
  function addStatus(id: string, status: string) {
    const s = status.trim();
    const current = combatRef.current;
    if (!current || !s || s.length > 20) return;
    const target = current.combatants.find((c) => c.id === id);
    if (!target) return;
    const statuses = target.statuses ?? [];
    if (statuses.includes(s) || statuses.length >= 8) return;
    persist({
      ...current,
      combatants: current.combatants.map((c) =>
        c.id === id ? { ...c, statuses: [...statuses, s] } : c,
      ),
    });
  }

  // 状態異常を解除する
  function removeStatus(id: string, status: string) {
    const current = combatRef.current;
    if (!current) return;
    persist({
      ...current,
      combatants: current.combatants.map((c) =>
        c.id === id
          ? { ...c, statuses: (c.statuses ?? []).filter((s) => s !== status) }
          : c,
      ),
    });
  }

  // 応急手当: サーバーで1d3を振って履歴化し、その結果をHP回復に使う
  // (クライアントで振り直すと二重ロールになるためサーバーロールのみ)
  async function firstAid(combatant: Combatant) {
    if (healBusy) return;
    setHealBusy(combatant.id);
    setHealError("");
    try {
      const res = await fetch("/api/dice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expression: "1d3",
          context: `応急手当 (${combatant.name})`,
          gameSessionId: sessionId,
          characterId: combatant.characterId ?? undefined,
          characterName: combatant.name,
        }),
      });
      if (!res.ok) {
        setHealError("応急手当に失敗しました");
        return;
      }
      const data: { total?: number } = await res.json();
      const total = typeof data.total === "number" ? data.total : 0;
      // maxHp を超えない分だけ回復する
      const latest = combatRef.current?.combatants.find(
        (c) => c.id === combatant.id,
      );
      const healed = latest
        ? Math.min(total, Math.max(0, latest.maxHp - latest.hp))
        : 0;
      if (healed > 0) changeHp(combatant.id, +healed);
      setHealFlash({ name: combatant.name, amount: healed });
      if (healFlashTimer.current) clearTimeout(healFlashTimer.current);
      healFlashTimer.current = setTimeout(() => setHealFlash(null), 2500);
    } catch {
      setHealError("応急手当に失敗しました");
    } finally {
      setHealBusy(null);
    }
  }

  // 武器をリロードする (maxAmmo がある武器のみ)
  function reloadWeaponAt(combatantId: string, weaponIdx: number) {
    const current = combatRef.current;
    if (!current) return;
    persist({
      ...current,
      combatants: current.combatants.map((c) =>
        c.id === combatantId
          ? {
              ...c,
              weapons: (c.weapons ?? []).map((w, i) =>
                i === weaponIdx ? reloadWeapon(w) : w,
              ),
            }
          : c,
      ),
    });
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
      edition,
      damageBonus: derived.damageBonus,
      weapons: pcCombatWeapons(pc, edition),
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
      edition: "6",
      damageBonus: "±0",
      weapons: [],
    };
    setNpcName("");
    setNpcDex("");
    setNpcHp("");
    persist({ ...combat, combatants: [...combat.combatants, combatant] });
  }

  // NPCに武器を1件追加する
  function addNpcWeapon(combatantId: string, weapon: CombatantWeapon) {
    if (!combat) return;
    persist({
      ...combat,
      combatants: combat.combatants.map((c) =>
        c.id === combatantId
          ? { ...c, weapons: [...(c.weapons ?? []), weapon] }
          : c,
      ),
    });
  }

  // 攻撃実行: PC/NPCとも戦闘員に保存した武器スナップショット(技能値・ダメージ式)で
  // resolveAttack を回す。命中判定は judgeOutcomeFor、ダメージは resolveDamageExpression と
  // 共通ロジックを再利用。ヒット時は対象のHPを減らし、判定/ダメージを /api/dice で履歴化する。
  async function executeAttack(
    attacker: Combatant,
    weaponIdx: number,
    targetId: string,
  ) {
    const weapon = attacker.weapons?.[weaponIdx];
    const target = combat?.combatants.find((c) => c.id === targetId);
    if (!weapon || !target || attackBusy) return;
    // 弾数管理武器は残弾がないと撃てない
    if (!canFire(weapon)) {
      setAttackError("弾切れです。リロードしてください");
      return;
    }
    setAttackBusy(true);
    setAttackError("");
    try {
      const edition: Edition = attacker.edition === "7" ? "7" : "6";
      const r = resolveAttack(
        edition,
        weapon.skillValue,
        weapon.damage,
        attacker.damageBonus ?? "±0",
      );
      const dmgTotal = r.damage?.total ?? 0;

      // 弾数消費: changeHp と同じ debounce 保存に載せるため、先に ref/state へ反映する
      // (命中しなかった場合も弾数変更を保存する)
      if (weapon.ammo != null && combatRef.current) {
        applyDebounced({
          ...combatRef.current,
          combatants: combatRef.current.combatants.map((c) =>
            c.id === attacker.id
              ? {
                  ...c,
                  weapons: (c.weapons ?? []).map((w, i) =>
                    i === weaponIdx ? consumeAmmo(w) : w,
                  ),
                }
              : c,
          ),
        });
      }

      // 履歴化 (卓ログに紐付け)。命中判定は失敗も記録、ダメージは命中時のみ。
      const record = (payload: Record<string, unknown>) =>
        fetch("/api/dice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameSessionId: sessionId,
            characterId: attacker.characterId ?? undefined,
            characterName: attacker.name,
            ...payload,
          }),
        }).catch(() => {});
      await record({
        target: weapon.skillValue,
        edition,
        context: `${weapon.name}攻撃 → ${target.name}`,
      });
      if (r.hit && dmgTotal > 0) {
        await record({
          expression: r.damageExpression,
          context: `${weapon.name}ダメージ → ${target.name}`,
        });
        changeHp(targetId, -dmgTotal);
      }

      setAttackResult({
        attacker: attacker.name,
        target: target.name,
        weapon: weapon.name,
        roll: r.roll,
        outcome: r.outcome,
        hit: r.hit,
        damage: r.hit ? dmgTotal : null,
        damageExpr: r.damageExpression,
      });
      setAttackFor(null);
      setPickWeapon(null);
    } catch {
      setAttackError("通信エラーが発生しました");
    } finally {
      setAttackBusy(false);
    }
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
          {healFlash && (
            <span className="ml-2 text-xs text-emerald-400">
              🩹 {healFlash.name} +{healFlash.amount}
            </span>
          )}
          {healError && (
            <span className="ml-2 text-xs text-red-400">{healError}</span>
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

      {/* 直近の攻撃結果 */}
      {attackResult && (
        <div className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
          <span className="text-zinc-400">
            {attackResult.attacker} → {attackResult.target} ({attackResult.weapon})
          </span>
          <span className="font-mono text-zinc-500">出目{attackResult.roll}</span>
          {attackResult.hit ? (
            <span className="text-red-300 font-bold">
              命中! {attackResult.damageExpr} → {attackResult.damage} ダメージ
            </span>
          ) : (
            <span className="text-zinc-500">外れ</span>
          )}
          <button
            onClick={() => setAttackResult(null)}
            aria-label="閉じる"
            className="ml-auto text-zinc-600 hover:text-zinc-300"
          >
            ✕
          </button>
        </div>
      )}

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
                className={`rounded border ${
                  active
                    ? "border-red-500 bg-red-950/40"
                    : "border-zinc-800 bg-zinc-950/50"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  {active && <span className="text-red-300">▶</span>}
                  <span className="font-mono text-xs text-zinc-500 w-12">
                    DEX{combatant.dex}
                  </span>
                  <span
                    className={`font-semibold ${combatant.kind === "PC" ? "text-emerald-300" : "text-zinc-300"} ${combatant.hp <= 0 ? "line-through opacity-50" : ""}`}
                  >
                    {combatant.name}
                  </span>
                  {/* 状態異常チップ (クリックで解除) */}
                  {(combatant.statuses ?? []).map((s) => (
                    <button
                      key={s}
                      onClick={() => removeStatus(combatant.id, s)}
                      aria-label={`${s}を解除`}
                      title="クリックで解除"
                      className="rounded-full border border-amber-800 bg-amber-950/40 px-2 py-0.5 text-[10px] text-amber-300 hover:border-red-500 hover:text-red-300"
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setStatusFor(statusFor === combatant.id ? null : combatant.id);
                      setAttackFor(null);
                      setPickWeapon(null);
                    }}
                    aria-label={`${combatant.name}の状態異常`}
                    className="rounded border border-amber-900/60 px-2 h-8 text-xs text-amber-300 hover:bg-amber-950/40"
                    title="状態異常"
                  >
                    +状態
                  </button>
                  <button
                    onClick={() => {
                      setAttackFor(attackFor === combatant.id ? null : combatant.id);
                      setPickWeapon(null);
                      setStatusFor(null);
                    }}
                    disabled={combatant.hp <= 0}
                    aria-label={`${combatant.name}の攻撃`}
                    className="rounded border border-red-900/60 px-2 h-8 text-xs text-red-300 hover:bg-red-950/50 disabled:opacity-30"
                    title="攻撃"
                  >
                    ⚔️
                  </button>
                  <button
                    onClick={() => firstAid(combatant)}
                    disabled={healBusy !== null || saving}
                    aria-label="応急手当"
                    className="rounded border border-emerald-900/60 px-2 h-8 text-xs text-emerald-300 hover:bg-emerald-950/50 disabled:opacity-30"
                    title="応急手当 (1d3回復)"
                  >
                    🩹
                  </button>
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
                </div>

                {/* 状態異常パネル: プリセットのワンタップ付与 + 自由入力 */}
                {statusFor === combatant.id && (
                  <div className="border-t border-zinc-800 px-3 py-2 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-zinc-500">状態異常:</span>
                      {STATUS_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => addStatus(combatant.id, preset)}
                          disabled={
                            saving ||
                            (combatant.statuses ?? []).includes(preset)
                          }
                          className="rounded border border-amber-900/60 px-2 py-1 text-amber-300 hover:bg-amber-950/40 disabled:opacity-30"
                        >
                          {preset}
                        </button>
                      ))}
                      <input
                        value={statusInput}
                        onChange={(e) => setStatusInput(e.target.value)}
                        placeholder="自由入力"
                        maxLength={20}
                        className="w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 focus:border-amber-500 focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          addStatus(combatant.id, statusInput);
                          setStatusInput("");
                        }}
                        disabled={!statusInput.trim() || saving}
                        className="rounded border border-zinc-700 px-2 py-1 hover:border-amber-500 disabled:opacity-50"
                      >
                        付与
                      </button>
                    </div>
                  </div>
                )}

                {/* 攻撃パネル: 武器選択 → 対象選択 */}
                {attackFor === combatant.id && (
                  <div className="border-t border-zinc-800 px-3 py-2 space-y-2 text-xs">
                    {(combatant.weapons ?? []).length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-zinc-500">武器:</span>
                        {(combatant.weapons ?? []).map((w, wi) => (
                          <span key={wi} className="flex items-center gap-1">
                            <button
                              onClick={() => setPickWeapon(wi)}
                              className={`rounded border px-2 py-1 ${
                                pickWeapon === wi
                                  ? "border-red-500 bg-red-950/40 text-red-200"
                                  : "border-zinc-700 text-zinc-300 hover:border-red-500"
                              }`}
                            >
                              {w.name} <span className="text-zinc-500">({w.skillValue}% / {w.damage})</span>
                              {w.ammo != null && (
                                <span
                                  className={
                                    w.ammo <= 0 ? "text-red-400" : "text-zinc-500"
                                  }
                                >
                                  {" "}
                                  (残弾 {w.ammo}
                                  {w.maxAmmo != null && `/${w.maxAmmo}`})
                                </span>
                              )}
                            </button>
                            {w.maxAmmo != null && (
                              <button
                                onClick={() => reloadWeaponAt(combatant.id, wi)}
                                disabled={saving || w.ammo === w.maxAmmo}
                                aria-label={`${w.name}をリロード`}
                                className="rounded border border-zinc-700 px-2 py-1 text-zinc-400 hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-30"
                              >
                                リロード
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-500">
                        武器が未登録です。
                        {combatant.kind === "PC" && "探索者シートで武器を登録してから戦闘に追加してください。"}
                      </p>
                    )}

                    {/* NPCは武器をその場で追加できる */}
                    {combatant.kind === "NPC" && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input
                          value={nwName}
                          onChange={(e) => setNwName(e.target.value)}
                          placeholder="武器名"
                          className="w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 focus:border-red-500 focus:outline-none"
                        />
                        <input
                          value={nwSkill}
                          onChange={(e) => setNwSkill(e.target.value)}
                          placeholder="技能%"
                          inputMode="numeric"
                          className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 focus:border-red-500 focus:outline-none"
                        />
                        <input
                          value={nwDamage}
                          onChange={(e) => setNwDamage(e.target.value)}
                          placeholder="ダメージ (1d6)"
                          className="w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono focus:border-red-500 focus:outline-none"
                        />
                        <input
                          value={nwAmmo}
                          onChange={(e) => setNwAmmo(e.target.value)}
                          placeholder="装弾数"
                          inputMode="numeric"
                          className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 focus:border-red-500 focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            const sv = Math.max(0, Math.min(100, parseInt(nwSkill, 10) || 0));
                            if (!nwName.trim() || !nwDamage.trim()) return;
                            // 装弾数が入力されていれば ammo=maxAmmo=値、空なら弾数管理なし
                            const ammoN = parseInt(nwAmmo, 10);
                            const ammoFields =
                              Number.isFinite(ammoN) && ammoN >= 1
                                ? {
                                    ammo: Math.min(999, ammoN),
                                    maxAmmo: Math.min(999, ammoN),
                                  }
                                : {};
                            addNpcWeapon(combatant.id, {
                              name: nwName.trim(),
                              skillName: nwName.trim(),
                              damage: nwDamage.trim(),
                              skillValue: sv,
                              ...ammoFields,
                            });
                            setNwName("");
                            setNwSkill("");
                            setNwDamage("");
                            setNwAmmo("");
                          }}
                          className="rounded border border-zinc-700 px-2 py-1 hover:border-red-500"
                        >
                          武器追加
                        </button>
                      </div>
                    )}

                    {/* 対象選択 (武器選択後) */}
                    {pickWeapon !== null && (combatant.weapons ?? [])[pickWeapon] && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-zinc-500">対象:</span>
                        {combat.combatants
                          .filter((t) => t.id !== combatant.id)
                          .map((t) => (
                            <button
                              key={t.id}
                              onClick={() => executeAttack(combatant, pickWeapon, t.id)}
                              disabled={attackBusy}
                              className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-red-500 disabled:opacity-50"
                            >
                              → {t.name}
                            </button>
                          ))}
                      </div>
                    )}
                    {attackError && <p className="text-red-300">{attackError}</p>}
                  </div>
                )}
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

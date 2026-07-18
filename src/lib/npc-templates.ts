// 戦闘トラッカー用のNPC/敵テンプレート。
// スタッツはすべて本サイトオリジナルの汎用値 (ルールブックの数値転載はしていない)。
// 6版スケール基準。7版卓で使う場合はDEXを5倍で読み替える運用を想定。
import type { Combatant, CombatantWeapon } from "@/lib/combat";

export interface NpcTemplate {
  name: string;
  icon: string;
  dex: number;
  hp: number;
  damageBonus: string;
  memo: string; // 運用ヒント (卓上での使い方)
  weapons: CombatantWeapon[];
}

export const NPC_TEMPLATES: NpcTemplate[] = [
  {
    name: "チンピラ",
    icon: "🔪",
    dex: 11,
    hp: 11,
    damageBonus: "±0",
    memo: "威嚇してくるが形勢が悪いと逃げる",
    weapons: [
      { name: "こぶし", skillName: "こぶし", damage: "1d3", skillValue: 40 },
      { name: "ナイフ", skillName: "ナイフ", damage: "1d4", skillValue: 35 },
    ],
  },
  {
    name: "カルト信者",
    icon: "🕯️",
    dex: 10,
    hp: 10,
    damageBonus: "±0",
    memo: "狂信的で退かない。儀式刀を振るう",
    weapons: [
      { name: "儀式刀", skillName: "刃物", damage: "1d6", skillValue: 40 },
      { name: "こぶし", skillName: "こぶし", damage: "1d3", skillValue: 45 },
    ],
  },
  {
    name: "カルトの指導者",
    icon: "🌙",
    dex: 13,
    hp: 12,
    damageBonus: "±0",
    memo: "戦闘より逃走・呪文詠唱を優先する頭脳役",
    weapons: [
      { name: "杖", skillName: "杖", damage: "1d6", skillValue: 45 },
      { name: "隠し持った拳銃", skillName: "拳銃", damage: "1d10", skillValue: 40, ammo: 6, maxAmmo: 6 },
    ],
  },
  {
    name: "警官",
    icon: "👮",
    dex: 12,
    hp: 12,
    damageBonus: "±0",
    memo: "まず警告する。応援を呼ばれると厄介",
    weapons: [
      { name: "拳銃", skillName: "拳銃", damage: "1d10", skillValue: 45, ammo: 6, maxAmmo: 6 },
      { name: "警棒", skillName: "警棒", damage: "1d6", skillValue: 45 },
    ],
  },
  {
    name: "武装した用心棒",
    icon: "🕶️",
    dex: 13,
    hp: 14,
    damageBonus: "+1d4",
    memo: "訓練された動き。遮蔽を使う",
    weapons: [
      { name: "ショットガン", skillName: "ショットガン", damage: "2d6", skillValue: 45, ammo: 2, maxAmmo: 2 },
      { name: "こぶし", skillName: "こぶし", damage: "1d3", skillValue: 55 },
    ],
  },
  {
    name: "猛犬",
    icon: "🐕",
    dex: 14,
    hp: 9,
    damageBonus: "-1d4",
    memo: "素早い。かみつくと放さない",
    weapons: [{ name: "かみつき", skillName: "かみつき", damage: "1d6", skillValue: 50 }],
  },
  {
    name: "異形のもの (小)",
    icon: "👁️",
    dex: 15,
    hp: 8,
    damageBonus: "±0",
    memo: "目撃時SANチェック推奨 (0/1d4程度)。群れで現れる",
    weapons: [{ name: "鉤爪", skillName: "鉤爪", damage: "1d4", skillValue: 45 }],
  },
  {
    name: "異形のもの (大)",
    icon: "🐙",
    dex: 12,
    hp: 22,
    damageBonus: "+1d6",
    memo: "目撃時SANチェック推奨 (1/1d8程度)。物理装甲1相当の扱いも可 (memo参照)",
    weapons: [
      { name: "かみつき", skillName: "かみつき", damage: "1d8", skillValue: 45 },
      { name: "触腕", skillName: "触腕", damage: "1d6", skillValue: 50 },
    ],
  },
];

// 既存名と衝突しない表示名を作る ("チンピラ" → "チンピラ 2")
export function uniqueNpcName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export function npcFromTemplate(
  template: NpcTemplate,
  id: string,
  name: string,
): Combatant {
  return {
    id,
    name,
    kind: "NPC",
    characterId: null,
    dex: template.dex,
    hp: template.hp,
    maxHp: template.hp,
    memo: template.memo,
    edition: "6",
    damageBonus: template.damageBonus,
    // 共有参照を避けるため武器は複製する (装弾数が個体ごとに独立して減るように)
    weapons: template.weapons.map((w) => ({ ...w })),
  };
}

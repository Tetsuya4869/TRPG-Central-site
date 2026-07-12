// NdM+X 形式のダイス式パーサ+ローラー。
// 手動ダイスローラー・キャラ作成の能力値ロール・AI GMのツール実行がすべてこれを共用する。

export type Rng = () => number;

export interface ParsedDice {
  count: number;
  sides: number;
  modifier: number;
}

export interface DiceResult {
  expression: string;
  rolls: number[];
  modifier: number;
  total: number;
}

const MAX_COUNT = 100;
const MAX_SIDES = 1000;

const DICE_RE = /^\s*(\d*)[dD](\d+)\s*(?:([+-])\s*(\d+))?\s*$/;

export function parseDice(expression: string): ParsedDice {
  const m = DICE_RE.exec(expression);
  if (!m) {
    throw new Error(`ダイス式が不正です: "${expression}" (例: 1d100, 3d6, 2d6+3)`);
  }
  const count = m[1] === "" ? 1 : parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  const modifier = m[3] ? (m[3] === "-" ? -1 : 1) * parseInt(m[4], 10) : 0;

  if (count < 1 || count > MAX_COUNT) {
    throw new Error(`ダイスの個数は1〜${MAX_COUNT}にしてください`);
  }
  if (sides < 2 || sides > MAX_SIDES) {
    throw new Error(`ダイスの面数は2〜${MAX_SIDES}にしてください`);
  }
  return { count, sides, modifier };
}

export function rollDie(sides: number, rng: Rng = Math.random): number {
  return Math.floor(rng() * sides) + 1;
}

export function rollDice(expression: string, rng: Rng = Math.random): DiceResult {
  const { count, sides, modifier } = parseDice(expression);
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rollDie(sides, rng));
  }
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  return { expression: normalizeExpression(count, sides, modifier), rolls, modifier, total };
}

function normalizeExpression(count: number, sides: number, modifier: number): string {
  const mod = modifier === 0 ? "" : modifier > 0 ? `+${modifier}` : `${modifier}`;
  return `${count}d${sides}${mod}`;
}

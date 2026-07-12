// ダイス式パーサ+ローラー。"3d6" のような単項に加えて "1d6+1d4+2" のような
// 複合式(武器ダメージ+DB等)をサポートする。
// 手動ダイスローラー・キャラ作成の能力値ロール・AI GMのツール実行がすべてこれを共用する。

export type Rng = () => number;

export interface ParsedDice {
  count: number;
  sides: number;
  modifier: number;
}

export interface DiceTerm {
  count: number;
  sides: number;
  sign: 1 | -1;
}

export interface ParsedExpression {
  terms: DiceTerm[];
  modifier: number;
}

export interface DiceResult {
  expression: string;
  rolls: number[]; // マイナス項のダイスは負数で記録する (例: 1d6-1d4 → [5, -2])
  modifier: number;
  total: number;
}

const MAX_COUNT = 100;
const MAX_SIDES = 1000;
const MAX_TERMS = 10;

const DICE_RE = /^\s*(\d*)[dD](\d+)\s*(?:([+-])\s*(\d+))?\s*$/;

// 単項 NdM±X のみを受け付ける従来パーサ (能力値ロール等の内部用)
export function parseDice(expression: string): ParsedDice {
  const m = DICE_RE.exec(expression);
  if (!m) {
    throw new Error(`ダイス式が不正です: "${expression}" (例: 1d100, 3d6, 2d6+3)`);
  }
  const count = m[1] === "" ? 1 : parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  const modifier = m[3] ? (m[3] === "-" ? -1 : 1) * parseInt(m[4], 10) : 0;

  validateDice(count, sides);
  return { count, sides, modifier };
}

// 複合式パーサ: "1d6+1d4+2", "2d6-1", "d100" 等。ダイス項を最低1つ含むこと。
export function parseExpression(expression: string): ParsedExpression {
  const compact = expression.replace(/\s+/g, "");
  const tokenRe = /([+-]?)(\d*[dD]\d+|\d+)/gy;
  const terms: DiceTerm[] = [];
  let modifier = 0;
  let pos = 0;
  let totalDice = 0;

  while (pos < compact.length) {
    tokenRe.lastIndex = pos;
    const m = tokenRe.exec(compact);
    if (!m) {
      throw new Error(
        `ダイス式が不正です: "${expression}" (例: 1d100, 3d6, 1d6+1d4+2)`,
      );
    }
    if (pos > 0 && m[1] === "") {
      throw new Error(`ダイス式が不正です: "${expression}" (項の間に+/-が必要です)`);
    }
    const sign: 1 | -1 = m[1] === "-" ? -1 : 1;
    const body = m[2];
    if (/[dD]/.test(body)) {
      const [countStr, sidesStr] = body.split(/[dD]/);
      const count = countStr === "" ? 1 : parseInt(countStr, 10);
      const sides = parseInt(sidesStr, 10);
      validateDice(count, sides);
      totalDice += count;
      terms.push({ count, sides, sign });
    } else {
      modifier += sign * parseInt(body, 10);
    }
    pos = tokenRe.lastIndex;
  }

  if (terms.length === 0) {
    throw new Error(`ダイス式が不正です: "${expression}" (ダイス項が必要です)`);
  }
  if (terms.length > MAX_TERMS) {
    throw new Error(`ダイス項は${MAX_TERMS}個までにしてください`);
  }
  if (totalDice > MAX_COUNT) {
    throw new Error(`ダイスの個数は合計${MAX_COUNT}個までにしてください`);
  }
  return { terms, modifier };
}

function validateDice(count: number, sides: number) {
  if (count < 1 || count > MAX_COUNT) {
    throw new Error(`ダイスの個数は1〜${MAX_COUNT}にしてください`);
  }
  if (sides < 2 || sides > MAX_SIDES) {
    throw new Error(`ダイスの面数は2〜${MAX_SIDES}にしてください`);
  }
}

export function rollDie(sides: number, rng: Rng = Math.random): number {
  return Math.floor(rng() * sides) + 1;
}

export function rollDice(expression: string, rng: Rng = Math.random): DiceResult {
  const { terms, modifier } = parseExpression(expression);
  const rolls: number[] = [];
  let total = modifier;
  for (const term of terms) {
    for (let i = 0; i < term.count; i++) {
      const value = rollDie(term.sides, rng) * term.sign;
      rolls.push(value);
      total += value;
    }
  }
  return { expression: normalizeExpression(terms, modifier), rolls, modifier, total };
}

function normalizeExpression(terms: DiceTerm[], modifier: number): string {
  const dice = terms
    .map((t, i) => {
      const sign = t.sign === -1 ? "-" : i === 0 ? "" : "+";
      return `${sign}${t.count}d${t.sides}`;
    })
    .join("");
  const mod = modifier === 0 ? "" : modifier > 0 ? `+${modifier}` : `${modifier}`;
  return `${dice}${mod}`;
}

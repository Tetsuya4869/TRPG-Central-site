// 武器攻撃: 命中判定 (1d100 vs 武器技能) + 成功時ダメージロール (DB解決込み)。
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rollDie, rollDice } from "@/lib/dice";
import {
  deriveStatsFor,
  effectiveSkillsFor,
  judgeOutcomeFor,
  type Edition,
} from "@/lib/coc";
import { parseWeaponsJson, resolveDamageExpression } from "@/lib/weapons";
import type { StatBlock } from "@/lib/coc6/types";

const attackSchema = z.object({
  weaponIndex: z.number().int().min(0).max(19),
});

const HIT_OUTCOMES = new Set(["CRITICAL", "EXTREME", "HARD", "SUCCESS"]);

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = attackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  const character = await prisma.character.findUnique({ where: { id } });
  if (!character) {
    return NextResponse.json({ error: "探索者が見つかりません" }, { status: 404 });
  }
  const weapons = parseWeaponsJson(character.weaponsJson);
  const weapon = weapons[parsed.data.weaponIndex];
  if (!weapon) {
    return NextResponse.json({ error: "武器が見つかりません" }, { status: 404 });
  }

  const edition: Edition = character.edition === "7" ? "7" : "6";
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
    // 壊れたJSONは未割り振り扱い
  }
  const skill = effectiveSkillsFor(edition, assigned, stats).find(
    (s) => s.name === weapon.skillName,
  );
  if (!skill) {
    return NextResponse.json(
      { error: `技能「${weapon.skillName}」がシートにありません` },
      { status: 400 },
    );
  }

  // 命中判定
  const roll = rollDie(100);
  const outcome = judgeOutcomeFor(edition, roll, skill.value);
  const hit = HIT_OUTCOMES.has(outcome);
  await prisma.diceRoll.create({
    data: {
      expression: "1d100",
      rolls: JSON.stringify([roll]),
      total: roll,
      target: skill.value,
      outcome,
      context: `${weapon.name}攻撃 (${weapon.skillName})`,
      skillName: weapon.skillName,
      characterId: character.id,
      characterName: character.name,
      source: "MANUAL",
    },
  });

  // 成功時のみダメージロール (DBはキャラの派生値から解決)
  const derived = deriveStatsFor(edition, stats);
  const damageExpression = resolveDamageExpression(weapon.damage, derived.damageBonus);
  let damage: { expression: string; rolls: number[]; total: number } | null = null;
  if (hit) {
    const result = rollDice(damageExpression);
    damage = {
      expression: result.expression,
      rolls: result.rolls,
      total: Math.max(0, result.total),
    };
    await prisma.diceRoll.create({
      data: {
        expression: result.expression,
        rolls: JSON.stringify(result.rolls),
        total: damage.total,
        context: `${weapon.name}ダメージ`,
        characterId: character.id,
        characterName: character.name,
        source: "MANUAL",
      },
    });
  }

  return NextResponse.json({
    weapon: weapon.name,
    check: { roll, target: skill.value, outcome },
    hit,
    damageExpression,
    damage,
  });
}

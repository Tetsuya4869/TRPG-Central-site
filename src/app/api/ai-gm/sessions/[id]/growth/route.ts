import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { collectGrowthSkills, growthCheck } from "@/lib/coc6/growth";
import { skillBaseFor } from "@/lib/coc";
import { skillsSchema, type StatBlock } from "@/lib/coc6/types";
import type { Character, DiceRoll } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

function candidatesFor(
  character: Character,
  rolls: Pick<DiceRoll, "outcome" | "skillName" | "context">[],
) {
  const skillNames = collectGrowthSkills(rolls);
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
  const sheetSkills = skillsSchema.catch({}).parse(JSON.parse(character.skillsJson));
  const edition = character.edition === "7" ? "7" : "6";
  return skillNames.map((skillName) => {
    const currentValue =
      sheetSkills[skillName] ?? skillBaseFor(edition, skillName, stats) ?? 0;
    return { skillName, currentValue };
  });
}

async function loadMemberCandidates(id: string) {
  const session = await prisma.aiGmSession.findUnique({
    where: { id },
    include: {
      members: { orderBy: { position: "asc" }, include: { character: true } },
    },
  });
  if (!session) return null;

  const rolls = await prisma.diceRoll.findMany({
    where: { aiGmSessionId: id, source: "AI_GM" },
    select: { outcome: true, skillName: true, context: true, characterId: true },
  });

  const memberCandidates = session.members.map((member) => {
    // characterId=NULL の旧データは、メンバーが1人のセッションに限りその人へ帰属させる
    const memberRolls = rolls.filter(
      (r) =>
        r.characterId === member.characterId ||
        (r.characterId === null && session.members.length === 1),
    );
    return {
      characterId: member.characterId,
      name: member.character.name,
      candidates: candidatesFor(member.character, memberRolls),
    };
  });

  return { session, memberCandidates };
}

// 成長候補 (このセッションで成功した技能) のメンバー別一覧
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const loaded = await loadMemberCandidates(id);
  if (!loaded) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  return NextResponse.json({
    members: loaded.memberCandidates,
    growthApplied: Boolean(loaded.session.growthAppliedAt),
  });
}

// 経験チェックの実行 (ロールはサーバー側で行う)
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const loaded = await loadMemberCandidates(id);
  if (!loaded) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }

  const members = [];
  for (const member of loaded.memberCandidates) {
    const results = [];
    for (const candidate of member.candidates) {
      const result = growthCheck(candidate.currentValue);
      await prisma.diceRoll.create({
        data: {
          expression: "1d100",
          rolls: JSON.stringify([result.roll]),
          total: result.roll,
          target: candidate.currentValue,
          context: `成長チェック: ${candidate.skillName}${result.improved ? ` (+${result.gain})` : ""}`,
          characterId: member.characterId,
          characterName: member.name,
          source: "MANUAL",
          aiGmSessionId: id,
        },
      });
      results.push({
        skillName: candidate.skillName,
        currentValue: candidate.currentValue,
        ...result,
      });
    }
    members.push({ characterId: member.characterId, name: member.name, results });
  }

  return NextResponse.json({ members });
}

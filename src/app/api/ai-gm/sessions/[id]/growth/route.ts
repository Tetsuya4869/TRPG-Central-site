import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { collectGrowthSkills, growthCheck } from "@/lib/coc6/growth";
import { SKILL_DEFS, skillBase } from "@/lib/coc6/skills";
import { skillsSchema, type StatBlock } from "@/lib/coc6/types";

type Params = { params: Promise<{ id: string }> };

async function loadCandidates(id: string) {
  const session = await prisma.aiGmSession.findUnique({
    where: { id },
    include: { character: true },
  });
  if (!session) return null;

  const rolls = await prisma.diceRoll.findMany({
    where: { aiGmSessionId: id, source: "AI_GM" },
    select: { outcome: true, skillName: true, context: true },
  });
  const skillNames = collectGrowthSkills(rolls);

  const stats: StatBlock = {
    str: session.character.str,
    con: session.character.con,
    pow: session.character.pow,
    dex: session.character.dex,
    app: session.character.app,
    siz: session.character.siz,
    int_: session.character.int_,
    edu: session.character.edu,
  };
  const sheetSkills = skillsSchema
    .catch({})
    .parse(JSON.parse(session.character.skillsJson));

  const candidates = skillNames.map((skillName) => {
    const def = SKILL_DEFS.find((d) => d.name === skillName);
    const currentValue =
      sheetSkills[skillName] ?? (def ? skillBase(def, stats) : 0);
    return { skillName, currentValue };
  });

  return { session, candidates };
}

// 成長候補 (このセッションで成功した技能) の一覧
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const loaded = await loadCandidates(id);
  if (!loaded) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  return NextResponse.json({
    candidates: loaded.candidates,
    growthApplied: Boolean(loaded.session.growthAppliedAt),
    state: JSON.parse(loaded.session.stateJson),
  });
}

// 経験チェックの実行 (ロールはサーバー側で行う)
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const loaded = await loadCandidates(id);
  if (!loaded) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }

  const results = [];
  for (const candidate of loaded.candidates) {
    const result = growthCheck(candidate.currentValue);
    await prisma.diceRoll.create({
      data: {
        expression: "1d100",
        rolls: JSON.stringify([result.roll]),
        total: result.roll,
        target: candidate.currentValue,
        context: `成長チェック: ${candidate.skillName}${result.improved ? ` (+${result.gain})` : ""}`,
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

  return NextResponse.json({ results });
}

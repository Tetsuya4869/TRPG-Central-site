// AI GMセッションのプレイ統計。DiceRollのみをデータ源とする純関数。
// (ChatMessageのtool_resultパースは表示層以外がcontent blocks構造に依存するため不採用)

export interface StatsRollInput {
  expression: string;
  total: number;
  target: number | null;
  outcome: string | null;
  skillName: string | null;
  characterId: string | null;
  characterName: string | null;
  sanAfter: number | null;
  createdAt: Date | string;
}

export interface StatsMemberInput {
  characterId: string;
  name: string;
}

const SUCCESS_OUTCOMES = new Set(["SUCCESS", "HARD", "EXTREME", "CRITICAL"]);

export interface SanPoint {
  index: number; // 何回目のSANチェックか (時系列)
  san: number;
}

export interface SkillStat {
  name: string;
  tries: number;
  successes: number;
}

export interface SessionStats {
  summary: {
    totalChecks: number;
    successes: number;
    criticals: number;
    fumbles: number;
  };
  histogram: number[]; // 10要素: 1-10, 11-20, …, 91-00 の出目分布 (目標値付き1d100のみ)
  sanSeries: { characterId: string; name: string; points: SanPoint[] }[];
  skillStats: SkillStat[]; // 試行回数降順、上位10件
}

export function buildSessionStats(
  rolls: StatsRollInput[],
  members: StatsMemberInput[],
): SessionStats {
  const sorted = [...rolls].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  // 目標値付き1d100 = 判定 (技能判定+SANチェック)
  const checks = sorted.filter(
    (r) => r.expression === "1d100" && r.target != null,
  );

  const histogram = new Array<number>(10).fill(0);
  let successes = 0;
  let criticals = 0;
  let fumbles = 0;
  for (const roll of checks) {
    const bucket = Math.min(9, Math.floor((roll.total - 1) / 10));
    if (roll.total >= 1 && roll.total <= 100) histogram[bucket] += 1;
    if (roll.outcome && SUCCESS_OUTCOMES.has(roll.outcome)) successes += 1;
    if (roll.outcome === "CRITICAL") criticals += 1;
    if (roll.outcome === "FUMBLE") fumbles += 1;
  }

  // SAN推移: sanAfter記録のあるロールをメンバーごとに時系列で
  const sanSeries = members.map((member) => {
    const points: SanPoint[] = [];
    let index = 0;
    for (const roll of sorted) {
      if (roll.sanAfter == null) continue;
      const belongs =
        roll.characterId === member.characterId ||
        (roll.characterId == null && members.length === 1);
      if (belongs) {
        index += 1;
        points.push({ index, san: roll.sanAfter });
      }
    }
    return { characterId: member.characterId, name: member.name, points };
  });

  // 技能別成績 (成長チェックはskillName無しなので自然に除外される)
  const bySkill = new Map<string, SkillStat>();
  for (const roll of checks) {
    if (!roll.skillName) continue;
    const stat = bySkill.get(roll.skillName) ?? {
      name: roll.skillName,
      tries: 0,
      successes: 0,
    };
    stat.tries += 1;
    if (roll.outcome && SUCCESS_OUTCOMES.has(roll.outcome)) stat.successes += 1;
    bySkill.set(roll.skillName, stat);
  }
  const skillStats = [...bySkill.values()]
    .sort((a, b) => b.tries - a.tries || b.successes - a.successes)
    .slice(0, 10);

  return {
    summary: { totalChecks: checks.length, successes, criticals, fumbles },
    histogram,
    sanSeries,
    skillStats,
  };
}

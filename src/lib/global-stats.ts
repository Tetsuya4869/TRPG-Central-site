// 全卓・全探索者を横断した通算統計 (純関数)。
// 「判定」の定義は buildSessionStats と同一: expression === "1d100" かつ target あり。
import { SUCCESS_OUTCOMES } from "@/lib/ai-gm/stats";

export interface GlobalRollInput {
  expression: string;
  total: number;
  target: number | null;
  outcome: string | null;
  skillName: string | null;
  characterName: string | null;
  source: string;
  createdAt: Date | string;
}

export interface GlobalStats {
  summary: {
    totalRolls: number;
    totalChecks: number;
    successes: number;
    criticals: number;
    fumbles: number;
  };
  histogram: number[]; // 1-10, 11-20, …, 91-100 の10バケット (判定のみ)
  skillStats: { name: string; tries: number; successes: number }[]; // top10
  byCharacter: {
    name: string;
    checks: number;
    successes: number;
    criticals: number;
    fumbles: number;
  }[]; // 判定数降順 top10
  monthly: { month: string; count: number }[]; // "YYYY-MM" 直近12ヶ月 (ゼロ月も埋める)
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function buildGlobalStats(rolls: GlobalRollInput[], now = new Date()): GlobalStats {
  const summary = {
    totalRolls: rolls.length,
    totalChecks: 0,
    successes: 0,
    criticals: 0,
    fumbles: 0,
  };
  const histogram = Array.from({ length: 10 }, () => 0);
  const skills = new Map<string, { tries: number; successes: number }>();
  const chars = new Map<
    string,
    { checks: number; successes: number; criticals: number; fumbles: number }
  >();

  // 直近12ヶ月をゼロで初期化 (古い順)
  const monthlyMap = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyMap.set(monthKey(d), 0);
  }

  for (const roll of rolls) {
    const created = new Date(roll.createdAt);
    const mk = monthKey(created);
    if (monthlyMap.has(mk)) monthlyMap.set(mk, (monthlyMap.get(mk) ?? 0) + 1);

    const isCheck = roll.expression === "1d100" && roll.target != null;
    if (!isCheck) continue;

    summary.totalChecks += 1;
    const success = roll.outcome != null && SUCCESS_OUTCOMES.has(roll.outcome);
    if (success) summary.successes += 1;
    if (roll.outcome === "CRITICAL") summary.criticals += 1;
    if (roll.outcome === "FUMBLE") summary.fumbles += 1;

    // 出目分布 (1-100を10バケットへ。異常値は端にクランプ)
    const bucket = Math.min(9, Math.max(0, Math.ceil(roll.total / 10) - 1));
    histogram[bucket] += 1;

    if (roll.skillName) {
      const s = skills.get(roll.skillName) ?? { tries: 0, successes: 0 };
      s.tries += 1;
      if (success) s.successes += 1;
      skills.set(roll.skillName, s);
    }

    if (roll.characterName) {
      const c =
        chars.get(roll.characterName) ??
        { checks: 0, successes: 0, criticals: 0, fumbles: 0 };
      c.checks += 1;
      if (success) c.successes += 1;
      if (roll.outcome === "CRITICAL") c.criticals += 1;
      if (roll.outcome === "FUMBLE") c.fumbles += 1;
      chars.set(roll.characterName, c);
    }
  }

  return {
    summary,
    histogram,
    skillStats: [...skills.entries()]
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.tries - a.tries)
      .slice(0, 10),
    byCharacter: [...chars.entries()]
      .map(([name, c]) => ({ name, ...c }))
      .sort((a, b) => b.checks - a.checks)
      .slice(0, 10),
    monthly: [...monthlyMap.entries()].map(([month, count]) => ({ month, count })),
  };
}

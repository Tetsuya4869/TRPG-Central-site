// CoC 6版の技能成長(経験チェック)。1d100 > 現在値なら 1d10 成長する。純関数のみ。
import { rollDie, type Rng } from "@/lib/dice";

// 成長対象外: 能力値ロール由来の名前と、クトゥルフ神話(6版では経験チェックで成長しない)
const GROWTH_DENYLIST = new Set([
  "アイデア",
  "幸運",
  "知識",
  "クトゥルフ神話",
]);

export interface GrowthCandidateRoll {
  outcome: string | null;
  skillName: string | null;
  context: string | null;
}

// セッション中に成功(SUCCESS/CRITICAL)した技能名をユニーク化して返す。
// skillNameカラムが基本。旧データ(skillNameなし)はcontextの「技能名: 理由」形式から復元する。
export function collectGrowthSkills(rolls: GrowthCandidateRoll[]): string[] {
  const skills = new Set<string>();
  const SUCCESS_OUTCOMES = new Set(["SUCCESS", "HARD", "EXTREME", "CRITICAL"]);
  for (const roll of rolls) {
    if (!roll.outcome || !SUCCESS_OUTCOMES.has(roll.outcome)) continue;
    let name = roll.skillName;
    if (!name && roll.context) {
      const match = roll.context.match(/^(.+?): /);
      if (match && match[1] !== "SANチェック" && !match[1].startsWith("成長チェック")) {
        name = match[1];
      }
    }
    if (name && !GROWTH_DENYLIST.has(name)) {
      skills.add(name);
    }
  }
  return [...skills];
}

export interface GrowthCheckResult {
  roll: number;
  improved: boolean;
  gain: number;
  after: number;
}

export function growthCheck(current: number, rng: Rng = Math.random): GrowthCheckResult {
  const roll = rollDie(100, rng);
  const improved = roll > current;
  const gain = improved ? rollDie(10, rng) : 0;
  return {
    roll,
    improved,
    gain,
    // 上限99にクランプするが、既に99以上の技能を下げてはならない (母国語EDU×5等は99超がありうる)
    after: Math.max(current, Math.min(99, current + gain)),
  };
}

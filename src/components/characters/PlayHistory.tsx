// 探索者のプレイ記録 (サーバーコンポーネント)。
// 参加AI GM卓・通算判定成績・セッション横断のSAN推移を表示する。
import Link from "next/link";
import { prisma } from "@/lib/prisma";

const SUCCESS_OUTCOMES = new Set(["CRITICAL", "EXTREME", "HARD", "SUCCESS"]);

// セッション横断のSAN推移スパークライン (インラインSVG)
function SanSparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 260;
  const h = 48;
  const pad = 4;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);
  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-500 mb-1">
        <span>SAN推移 (全AIセッション)</span>
        <span>
          {points[0]} → {points[points.length - 1]}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full max-w-[260px]"
        role="img"
        aria-label={`SAN推移 ${points.join(", ")}`}
      >
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke="#c084fc"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export async function PlayHistory({ characterId }: { characterId: string }) {
  const [memberships, rolls] = await Promise.all([
    prisma.aiGmSessionMember.findMany({
      where: { characterId },
      include: { aiGmSession: true },
      orderBy: { aiGmSession: { updatedAt: "desc" } },
    }),
    prisma.diceRoll.findMany({
      where: { characterId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const judged = rolls.filter((r) => r.outcome !== null);
  const successes = judged.filter((r) => SUCCESS_OUTCOMES.has(r.outcome!)).length;
  const criticals = judged.filter((r) => r.outcome === "CRITICAL").length;
  const fumbles = judged.filter((r) => r.outcome === "FUMBLE").length;
  const sanPoints = rolls
    .filter((r) => r.sanAfter !== null)
    .map((r) => r.sanAfter!);

  if (memberships.length === 0 && judged.length === 0) return null;

  const successRate =
    judged.length > 0 ? Math.round((successes / judged.length) * 100) : 0;

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
      <h2 className="font-semibold text-zinc-300">プレイ記録</h2>

      {judged.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {(
            [
              ["判定回数", judged.length, "text-zinc-300"],
              ["成功率", `${successRate}%`, "text-emerald-300"],
              ["クリティカル", criticals, "text-yellow-300"],
              ["ファンブル", fumbles, "text-red-400"],
            ] as [string, number | string, string][]
          ).map(([label, value, color]) => (
            <div
              key={label}
              className="rounded border border-zinc-800 bg-zinc-950/60 px-3 py-1.5"
            >
              <span className="text-zinc-500 text-xs mr-2">{label}</span>
              <span className={`font-bold ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      )}

      <SanSparkline points={sanPoints} />

      {memberships.length > 0 && (
        <div>
          <h3 className="text-xs text-zinc-500 mb-1.5">参加したAI GMセッション</h3>
          <ul className="space-y-1.5">
            {memberships.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/ai-gm/${m.aiGmSessionId}`}
                  className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950/50 px-3 py-1.5 text-sm hover:border-emerald-600 transition-colors"
                >
                  <span className="truncate text-emerald-300">
                    {m.aiGmSession.title}
                  </span>
                  <span
                    className={`ml-auto shrink-0 rounded px-1.5 text-xs ${
                      m.aiGmSession.status === "FINISHED"
                        ? "bg-zinc-700/50 text-zinc-400"
                        : "bg-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {m.aiGmSession.status === "FINISHED" ? "終了" : "進行中"}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-600">
                    {new Date(m.aiGmSession.updatedAt).toLocaleDateString("ja-JP")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

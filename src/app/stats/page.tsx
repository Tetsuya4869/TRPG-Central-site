import { prisma } from "@/lib/prisma";
import { buildGlobalStats } from "@/lib/global-stats";

export const dynamic = "force-dynamic";

// 全卓・全探索者を横断した通算統計。集計は純関数 buildGlobalStats に分離。
export default async function GlobalStatsPage() {
  const [rolls, characterCount, sessionCount, aiGmCount] = await Promise.all([
    prisma.diceRoll.findMany({
      select: {
        expression: true,
        total: true,
        target: true,
        outcome: true,
        skillName: true,
        characterName: true,
        source: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.character.count({ where: { deletedAt: null } }),
    prisma.gameSession.count(),
    prisma.aiGmSession.count(),
  ]);
  const stats = buildGlobalStats(rolls);
  const { summary } = stats;
  const successRate =
    summary.totalChecks > 0
      ? Math.round((summary.successes / summary.totalChecks) * 100)
      : null;
  const maxHist = Math.max(1, ...stats.histogram);
  const maxMonthly = Math.max(1, ...stats.monthly.map((m) => m.count));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">📈 全体統計</h1>
        <p className="mt-1 text-sm text-zinc-500">
          すべての卓・AI GMセッション・ダイスロールを横断した通算成績です。
        </p>
      </div>

      {/* 全体サマリー */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            ["📜 探索者", characterCount],
            ["🕯️ 卓", sessionCount],
            ["🐙 AI GMセッション", aiGmCount],
            ["🎲 総ロール数", summary.totalRolls],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      {/* 判定サマリー */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">判定回数 (1d100)</p>
          <p className="text-2xl font-bold tabular-nums">{summary.totalChecks}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">成功率</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-300">
            {successRate != null ? `${successRate}%` : "-"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">🎉 クリティカル</p>
          <p className="text-2xl font-bold tabular-nums text-amber-300">
            {summary.criticals}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">💀 ファンブル</p>
          <p className="text-2xl font-bold tabular-nums text-red-300">{summary.fumbles}</p>
        </div>
      </section>

      {summary.totalChecks === 0 ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
          まだ判定ロールがありません。ダイスページやAI GMプレイで判定すると、ここに統計が貯まっていきます。
        </p>
      ) : (
        <>
          {/* 出目分布 */}
          <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="font-semibold text-zinc-300 mb-4">d100出目分布 (判定のみ)</h2>
            <div className="flex items-end gap-1.5 h-32">
              {stats.histogram.map((count, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-zinc-500 tabular-nums">{count}</span>
                  <div
                    className="w-full rounded-t bg-emerald-600/70"
                    style={{ height: `${(count / maxHist) * 100}%`, minHeight: count > 0 ? 3 : 0 }}
                  />
                  <span className="text-[10px] text-zinc-600">{i * 10 + 1}-</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-zinc-600">
              低い出目 (左) ほど良い結果。左に偏っていれば豪運です
            </p>
          </section>

          {/* 技能別成績 */}
          {stats.skillStats.length > 0 && (
            <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-2">
              <h2 className="font-semibold text-zinc-300">技能別成績 (試行数 上位10)</h2>
              {stats.skillStats.map((s) => {
                const rate = Math.round((s.successes / s.tries) * 100);
                return (
                  <div key={s.name} className="flex items-center gap-3 text-sm">
                    <span className="w-28 truncate text-zinc-300">{s.name}</span>
                    <div className="flex-1 h-2.5 rounded bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-emerald-500/70" style={{ width: `${rate}%` }} />
                    </div>
                    <span className="w-24 text-right text-xs text-zinc-500 tabular-nums">
                      {s.successes}/{s.tries} ({rate}%)
                    </span>
                  </div>
                );
              })}
              <p className="text-[11px] text-zinc-600">
                ※ 技能名が記録されるのはAI GMの判定のみです (手動ダイスは対象外)
              </p>
            </section>
          )}

          {/* 探索者別 */}
          {stats.byCharacter.length > 0 && (
            <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="font-semibold text-zinc-300 mb-3">探索者別成績 (判定数 上位10)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500">
                      <th className="py-1.5 pr-3 font-normal">探索者</th>
                      <th className="py-1.5 pr-3 font-normal text-right">判定</th>
                      <th className="py-1.5 pr-3 font-normal text-right">成功率</th>
                      <th className="py-1.5 pr-3 font-normal text-right">🎉 クリ</th>
                      <th className="py-1.5 font-normal text-right">💀 ファン</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byCharacter.map((c) => (
                      <tr key={c.name} className="border-t border-zinc-800/60">
                        <td className="py-1.5 pr-3 font-semibold">{c.name}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{c.checks}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-emerald-300">
                          {Math.round((c.successes / c.checks) * 100)}%
                        </td>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-amber-300">
                          {c.criticals}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-red-300">
                          {c.fumbles}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-zinc-600">
                ※ 探索者名が記録されたロールのみ (AI GM・探索者を選んだ判定・戦闘トラッカー由来)
              </p>
            </section>
          )}
        </>
      )}

      {/* 月別アクティビティ (判定ゼロでもロールがあれば出す) */}
      {summary.totalRolls > 0 && (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-semibold text-zinc-300 mb-4">月別ロール数 (直近12ヶ月)</h2>
          <div className="flex items-end gap-1.5 h-24">
            {stats.monthly.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  {m.count > 0 ? m.count : ""}
                </span>
                <div
                  className="w-full rounded-t bg-purple-500/60"
                  style={{
                    height: `${(m.count / maxMonthly) * 100}%`,
                    minHeight: m.count > 0 ? 3 : 0,
                  }}
                />
                <span className="text-[9px] text-zinc-600">{m.month.slice(5)}月</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

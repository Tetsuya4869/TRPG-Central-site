import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DeleteScenarioButton } from "@/components/scenarios/DeleteScenarioButton";

export const dynamic = "force-dynamic";

export default async function ScenariosPage() {
  const scenarios = await prisma.scenario.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📖 シナリオライブラリ</h1>
        <Link
          href="/scenarios/new"
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500"
        >
          + 新規作成
        </Link>
      </div>

      {scenarios.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-500">
          <p className="mb-4">まだシナリオがありません</p>
          <Link href="/scenarios/new" className="text-emerald-300 hover:underline">
            手書きまたはAI生成でシナリオを作る →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {scenarios.map((s) => (
            <div
              key={s.id}
              className="flex items-start justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-emerald-600 transition-colors"
            >
              <Link href={`/scenarios/${s.id}`} className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{s.title}</h2>
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                      s.source === "AI_GENERATED"
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/50"
                        : "bg-zinc-500/20 text-zinc-400 border-zinc-500/50"
                    }`}
                  >
                    {s.source === "AI_GENERATED" ? "AI生成" : "手動"}
                  </span>
                  {s.tags?.split(",").map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
                {s.summary && (
                  <p className="text-sm text-zinc-500 mt-1">{s.summary}</p>
                )}
              </Link>
              <DeleteScenarioButton id={s.id} title={s.title} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

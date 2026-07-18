import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ScenarioAssetsPanel } from "@/components/scenarios/ScenarioAssetsPanel";
import { TrashBanner } from "@/components/TrashBanner";

export const dynamic = "force-dynamic";

export default async function ScenarioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) notFound();

  return (
    <div className="space-y-6">
      {scenario.deletedAt && (
        <TrashBanner type="scenario" id={scenario.id} label="このシナリオ" />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{scenario.title}</h1>
            <span
              className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                scenario.source === "AI_GENERATED"
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/50"
                  : "bg-zinc-500/20 text-zinc-400 border-zinc-500/50"
              }`}
            >
              {scenario.source === "AI_GENERATED" ? "AI生成" : "手動"}
            </span>
          </div>
          {scenario.summary && (
            <p className="text-sm text-zinc-500 mt-1">{scenario.summary}</p>
          )}
          {scenario.tags && (
            <div className="flex gap-1.5 mt-2">
              {scenario.tags.split(",").map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/scenarios/${scenario.id}/edit`}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500"
          >
            編集
          </Link>
          <Link
            href={`/ai-gm?scenarioId=${scenario.id}`}
            className="rounded border border-purple-700 px-4 py-2 text-sm text-purple-200 hover:bg-purple-900/40"
          >
            🐙 このシナリオでAI GMプレイ
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <div className="rounded border border-amber-900/50 bg-amber-950/20 px-3 py-2 mb-4 text-xs text-amber-300/80">
          ⚠️ ネタバレ注意: 本文にはキーパー用の真相が含まれます
        </div>
        <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
          {scenario.content}
        </p>
      </section>

      <ScenarioAssetsPanel scenarioId={scenario.id} />

      <Link href="/scenarios" className="inline-block text-sm text-zinc-500 hover:text-emerald-300">
        ← シナリオ一覧へ戻る
      </Link>
    </div>
  );
}

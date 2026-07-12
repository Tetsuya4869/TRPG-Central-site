import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/sessions/StatusBadge";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const sessions = await prisma.gameSession.findMany({
    orderBy: { updatedAt: "desc" },
    include: { characters: { include: { character: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🕯️ 卓一覧</h1>
        <Link
          href="/sessions/new"
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500"
        >
          + 卓を立てる
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-500">
          <p className="mb-4">まだ卓がありません</p>
          <Link href="/sessions/new" className="text-emerald-300 hover:underline">
            最初の卓を立てる →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/sessions/${s.id}`}
              className="block rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-emerald-600 transition-colors"
            >
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-semibold text-lg">{s.title}</h2>
                <StatusBadge status={s.status} />
                {s.scheduledAt && (
                  <span className="text-xs text-zinc-500">
                    📅{" "}
                    {new Date(s.scheduledAt).toLocaleString("ja-JP", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-500 mt-1">
                {s.scenarioName && <span>シナリオ: {s.scenarioName}</span>}
                {s.characters.length > 0 && (
                  <span className="ml-3">
                    参加: {s.characters.map((sc) => sc.character.name).join("、")}
                  </span>
                )}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

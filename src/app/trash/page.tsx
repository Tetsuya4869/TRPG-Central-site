import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TrashActions } from "@/components/TrashActions";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// ゴミ箱: 削除した探索者・シナリオの一覧。復元するか、完全に削除するかを選べる。
export default async function TrashPage() {
  const [characters, scenarios] = await Promise.all([
    prisma.character.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: { id: true, name: true, occupation: true, deletedAt: true, imageUrl: true },
    }),
    prisma.scenario.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: { id: true, title: true, tags: true, deletedAt: true },
    }),
  ]);

  const empty = characters.length === 0 && scenarios.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🗑️ ゴミ箱</h1>
        <p className="mt-1 text-sm text-zinc-500">
          削除した探索者・シナリオはここに残ります。復元するか、完全に削除できます。
        </p>
      </div>

      {empty ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-500">
          <p>ゴミ箱は空です</p>
          <Link href="/" className="mt-3 inline-block text-sm text-emerald-300 hover:underline">
            ← ダッシュボードへ戻る
          </Link>
        </div>
      ) : (
        <>
          {characters.length > 0 && (
            <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-3">
              <h2 className="font-semibold text-zinc-300">📜 探索者 ({characters.length})</h2>
              <ul className="space-y-2">
                {characters.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-3 rounded border border-zinc-800/60 bg-zinc-950/50 px-3 py-2"
                  >
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.imageUrl}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover border border-zinc-700"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-sm">
                        👤
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{c.name}</span>
                      <span className="block text-xs text-zinc-600">
                        {c.occupation ?? "職業不明"} ・ 削除:{" "}
                        {c.deletedAt ? dateFmt.format(c.deletedAt) : "-"}
                      </span>
                    </span>
                    <div className="ml-auto">
                      <TrashActions type="character" id={c.id} name={c.name} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {scenarios.length > 0 && (
            <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-3">
              <h2 className="font-semibold text-zinc-300">📖 シナリオ ({scenarios.length})</h2>
              <ul className="space-y-2">
                {scenarios.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center gap-3 rounded border border-zinc-800/60 bg-zinc-950/50 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{s.title}</span>
                      <span className="block text-xs text-zinc-600">
                        {s.tags && `#${s.tags.split(",").join(" #")} ・ `}削除:{" "}
                        {s.deletedAt ? dateFmt.format(s.deletedAt) : "-"}
                      </span>
                    </span>
                    <div className="ml-auto">
                      <TrashActions type="scenario" id={s.id} name={s.title} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

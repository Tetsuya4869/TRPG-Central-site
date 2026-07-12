import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deriveStats } from "@/lib/coc6/stats";

export const dynamic = "force-dynamic";

export default async function CharactersPage() {
  const characters = await prisma.character.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📜 探索者一覧</h1>
        <Link
          href="/characters/new"
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500"
        >
          + 新規作成
        </Link>
      </div>

      {characters.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-500">
          <p className="mb-4">まだ探索者がいません</p>
          <Link
            href="/characters/new"
            className="text-emerald-300 hover:underline"
          >
            最初の探索者を作成する →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((c) => {
            const derived = deriveStats({
              str: c.str,
              con: c.con,
              pow: c.pow,
              dex: c.dex,
              app: c.app,
              siz: c.siz,
              int_: c.int_,
              edu: c.edu,
            });
            return (
              <Link
                key={c.id}
                href={`/characters/${c.id}`}
                className="block rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-emerald-600 transition-colors"
              >
                <h2 className="font-semibold text-lg">{c.name}</h2>
                <p className="text-sm text-zinc-500 mb-3">
                  {c.occupation ?? "職業不明"}
                  {c.age != null && ` / ${c.age}歳`}
                  {c.playerName && ` / PL: ${c.playerName}`}
                </p>
                <div className="flex gap-4 text-xs text-zinc-400">
                  <span>
                    HP {c.currentHp}/{derived.hp}
                  </span>
                  <span>
                    MP {c.currentMp}/{derived.mp}
                  </span>
                  <span>
                    SAN {c.currentSan}/{derived.san}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

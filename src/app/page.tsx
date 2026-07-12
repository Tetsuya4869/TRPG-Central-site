import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const features = [
  {
    href: "/characters",
    title: "探索者管理",
    desc: "CoC 6版の探索者シートを作成・管理。能力値ロールと派生値の自動計算に対応。",
    icon: "📜",
  },
  {
    href: "/sessions",
    title: "卓(セッション)管理",
    desc: "セッションの予定・参加キャラクター・シナリオメモをまとめて管理。",
    icon: "🕯️",
  },
  {
    href: "/dice",
    title: "ダイスローラー",
    desc: "1d100や3d6などのダイスロールと技能判定。クリティカル/ファンブル自動判定。",
    icon: "🎲",
  },
  {
    href: "/ai-gm",
    title: "AI GMプレイ",
    desc: "ClaudeがキーパーとなってシナリオをGM。ダイス判定込みでソロプレイできる。",
    icon: "🐙",
  },
];

export default async function Home() {
  const [characters, sessions] = await Promise.all([
    prisma.character.findMany({ orderBy: { updatedAt: "desc" }, take: 3 }),
    prisma.gameSession.findMany({ orderBy: { updatedAt: "desc" }, take: 3 }),
  ]);

  return (
    <div className="space-y-10">
      <section className="text-center py-6">
        <h1 className="text-3xl font-bold mb-2">TRPG Central</h1>
        <p className="text-zinc-400">
          クトゥルフ神話TRPGをはじめとするTRPGの中央管理サイト
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {features.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="block rounded-lg border border-zinc-800 bg-zinc-900 p-5 hover:border-emerald-600 transition-colors"
          >
            <div className="text-2xl mb-2">{f.icon}</div>
            <h2 className="font-semibold text-lg mb-1">{f.title}</h2>
            <p className="text-sm text-zinc-400">{f.desc}</p>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="font-semibold mb-3 text-zinc-300">最近の探索者</h3>
          {characters.length === 0 ? (
            <p className="text-sm text-zinc-500">まだ探索者がいません</p>
          ) : (
            <ul className="space-y-2">
              {characters.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/characters/${c.id}`}
                    className="text-sm text-emerald-300 hover:underline"
                  >
                    {c.name}
                  </Link>
                  {c.occupation && (
                    <span className="text-xs text-zinc-500 ml-2">
                      {c.occupation}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="font-semibold mb-3 text-zinc-300">最近の卓</h3>
          {sessions.length === 0 ? (
            <p className="text-sm text-zinc-500">まだ卓がありません</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/sessions/${s.id}`}
                    className="text-sm text-emerald-300 hover:underline"
                  >
                    {s.title}
                  </Link>
                  {s.scenarioName && (
                    <span className="text-xs text-zinc-500 ml-2">
                      {s.scenarioName}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

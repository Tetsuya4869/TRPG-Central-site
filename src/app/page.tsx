import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BackupControls } from "@/components/BackupControls";

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
    href: "/scenarios",
    title: "シナリオライブラリ",
    desc: "シナリオの保存・再利用。AIによる自動生成にも対応。",
    icon: "📖",
  },
  {
    href: "/dice",
    title: "ダイスローラー",
    desc: "1d100や3d6などのダイスロールと技能判定。探索者を選んでワンタップ判定も。",
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
  const [ongoingAiSessions, characters, scenarios, sessions] = await Promise.all([
    prisma.aiGmSession.findMany({
      where: { status: "ONGOING" },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: {
        members: {
          orderBy: { position: "asc" },
          include: { character: { select: { name: true, imageUrl: true } } },
        },
      },
    }),
    prisma.character.findMany({ orderBy: { updatedAt: "desc" }, take: 4 }),
    prisma.scenario.findMany({ orderBy: { updatedAt: "desc" }, take: 4 }),
    prisma.gameSession.findMany({ orderBy: { updatedAt: "desc" }, take: 4 }),
  ]);

  return (
    <div className="space-y-10">
      <section className="text-center py-6">
        <h1 className="text-3xl font-bold mb-2">TRPG Central</h1>
        <p className="text-zinc-400">
          クトゥルフ神話TRPGをはじめとするTRPGの中央管理サイト
        </p>
      </section>

      {/* 続きから遊ぶ */}
      {ongoingAiSessions.length > 0 && (
        <section className="rounded-lg border border-emerald-800/60 bg-emerald-950/20 p-5">
          <h2 className="font-semibold text-emerald-200 mb-3">
            ▶ 続きから遊ぶ (進行中のAI GMセッション)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ongoingAiSessions.map((s) => (
              <Link
                key={s.id}
                href={`/ai-gm/${s.id}`}
                className="flex items-center gap-3 rounded border border-zinc-800 bg-zinc-900 p-3 hover:border-emerald-500 transition-colors"
              >
                <span className="flex -space-x-2 shrink-0">
                  {s.members.slice(0, 3).map((m) =>
                    m.character.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={m.id}
                        src={m.character.imageUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover border border-zinc-700"
                      />
                    ) : (
                      <span
                        key={m.id}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-lg"
                      >
                        🐙
                      </span>
                    ),
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {s.title}
                  </span>
                  <span className="block truncate text-xs text-zinc-500">
                    {s.members.map((m) => m.character.name).join("、")}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <div className="rounded-lg border border-dashed border-zinc-800 p-5 flex flex-col justify-between">
          <div>
            <div className="text-2xl mb-2">💾</div>
            <h2 className="font-semibold text-lg mb-1">バックアップ</h2>
            <p className="text-sm text-zinc-400">
              探索者・シナリオ・プレイログを含む全データをJSONで保存・復元。
            </p>
          </div>
          <BackupControls />
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="font-semibold mb-3 text-zinc-300">最近の探索者</h3>
          {characters.length === 0 ? (
            <p className="text-sm text-zinc-500">
              まだ探索者がいません。
              <Link href="/characters/new" className="text-emerald-300 hover:underline ml-1">
                作成する →
              </Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {characters.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.imageUrl}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover border border-zinc-700"
                    />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-xs">
                      👤
                    </span>
                  )}
                  <Link
                    href={`/characters/${c.id}`}
                    className="text-sm text-emerald-300 hover:underline truncate"
                  >
                    {c.name}
                  </Link>
                  {c.occupation && (
                    <span className="text-xs text-zinc-500 truncate">{c.occupation}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="font-semibold mb-3 text-zinc-300">最近のシナリオ</h3>
          {scenarios.length === 0 ? (
            <p className="text-sm text-zinc-500">
              まだシナリオがありません。
              <Link href="/scenarios/new" className="text-emerald-300 hover:underline ml-1">
                作成する →
              </Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {scenarios.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <Link
                    href={`/scenarios/${s.id}`}
                    className="text-sm text-emerald-300 hover:underline truncate"
                  >
                    {s.title}
                  </Link>
                  {s.source === "AI_GENERATED" && (
                    <span className="shrink-0 rounded bg-purple-500/20 px-1.5 text-xs text-purple-300">
                      AI
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
            <p className="text-sm text-zinc-500">
              まだ卓がありません。
              <Link href="/sessions/new" className="text-emerald-300 hover:underline ml-1">
                卓を立てる →
              </Link>
            </p>
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
                    <span className="text-xs text-zinc-500 ml-2">{s.scenarioName}</span>
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  deriveStatsFor,
  skillDefsFor,
  skillBaseFor,
  editionLabel,
  SKILL_CATEGORIES,
  type Edition,
} from "@/lib/coc";
import { skillsSchema, type StatBlock } from "@/lib/coc6/types";
import { DeleteCharacterButton } from "@/components/characters/DeleteCharacterButton";
import { DuplicateCharacterButton } from "@/components/characters/DuplicateCharacterButton";
import { CocofoliaExportButton } from "@/components/characters/CocofoliaExportButton";
import { buildCocofoliaCharacter } from "@/lib/cocofolia";

export const dynamic = "force-dynamic";

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const character = await prisma.character.findUnique({ where: { id } });
  if (!character) notFound();

  const stats: StatBlock = {
    str: character.str,
    con: character.con,
    pow: character.pow,
    dex: character.dex,
    app: character.app,
    siz: character.siz,
    int_: character.int_,
    edu: character.edu,
  };
  const skills = skillsSchema.catch({}).parse(JSON.parse(character.skillsJson));
  const edition: Edition = character.edition === "7" ? "7" : "6";
  const skillDefs = skillDefsFor(edition);
  const derived = deriveStatsFor(edition, stats, skills["クトゥルフ神話"] ?? 0);

  const statEntries: [string, number][] = [
    ["STR", stats.str],
    ["CON", stats.con],
    ["POW", stats.pow],
    ["DEX", stats.dex],
    ["APP", stats.app],
    ["SIZ", stats.siz],
    ["INT", stats.int_],
    ["EDU", stats.edu],
  ];

  // 表示: 定義済み技能(初期値から変更されたものを強調) + カスタム技能
  const defNames = new Set(skillDefs.map((d) => d.name));
  const customSkills = Object.entries(skills).filter(([n]) => !defNames.has(n));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {character.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={character.imageUrl}
              alt={character.name}
              className="h-20 w-20 rounded-lg object-cover border border-zinc-700"
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{character.name}</h1>
              <span
                className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                  edition === "7"
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/50"
                    : "bg-zinc-500/20 text-zinc-400 border-zinc-500/50"
                }`}
              >
                {editionLabel(edition)}
              </span>
            </div>
            <p className="text-sm text-zinc-500">
              {character.occupation ?? "職業不明"}
              {character.age != null && ` / ${character.age}歳`}
              {character.sex && ` / ${character.sex}`}
              {character.playerName && ` / PL: ${character.playerName}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/characters/${character.id}/edit`}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500"
          >
            編集
          </Link>
          <CocofoliaExportButton
            json={JSON.stringify(buildCocofoliaCharacter(character))}
          />
          <DuplicateCharacterButton id={character.id} />
          <DeleteCharacterButton id={character.id} name={character.name} />
        </div>
      </div>

      {/* 現在値 */}
      <section className="grid grid-cols-3 gap-3">
        {[
          ["HP", character.currentHp, derived.hp, "bg-red-500"],
          ["MP", character.currentMp, derived.mp, "bg-blue-500"],
          ["SAN", character.currentSan, derived.san, "bg-purple-500"],
        ].map(([label, current, max, color]) => (
          <div
            key={label as string}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
          >
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">{label}</span>
              <span className="font-semibold">
                {current} / {max}
              </span>
            </div>
            <div className="h-2 rounded bg-zinc-800 overflow-hidden">
              <div
                className={`h-full ${color}`}
                style={{
                  width: `${Math.min(100, Math.max(0, (Number(current) / Number(max)) * 100))}%`,
                }}
              />
            </div>
          </div>
        ))}
      </section>

      {/* 能力値+派生値 */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <h2 className="font-semibold text-zinc-300">能力値</h2>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {statEntries.map(([label, value]) => (
            <div
              key={label}
              className="rounded border border-zinc-800 bg-zinc-950 p-2 text-center"
            >
              <div className="text-xs text-zinc-500">{label}</div>
              <div className="text-lg font-bold">{value}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          {(edition === "7"
            ? ([
                ["幸運", character.luck ?? "-"],
                ["DB", derived.damageBonus],
              ] as [string, number | string][])
            : ([
                ["アイデア", derived.idea],
                ["幸運", derived.luck],
                ["知識", derived.knowledge],
                ["DB", derived.damageBonus],
              ] as [string, number | string][])
          ).map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between rounded border border-zinc-800/60 bg-zinc-950/60 px-3 py-1.5"
            >
              <span className="text-zinc-500">{label}</span>
              <span className="font-semibold text-emerald-300">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 技能 */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <h2 className="font-semibold text-zinc-300">
          技能
          {edition === "7" && (
            <span className="ml-2 text-xs font-normal text-zinc-500">
              (ハード=1/2、イクストリーム=1/5)
            </span>
          )}
        </h2>
        {SKILL_CATEGORIES.map((cat) => (
          <div key={cat}>
            <h3 className="text-xs text-zinc-500 mb-1.5">{cat}系</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {skillDefs.filter((d) => d.category === cat).map((def) => {
                const base = skillBaseFor(edition, def.name, stats) ?? 0;
                const value = skills[def.name] ?? base;
                const modified = value !== base;
                return (
                  <div
                    key={def.name}
                    className={`flex justify-between rounded border px-2 py-1 text-xs ${
                      modified
                        ? "border-emerald-700 bg-emerald-950/30"
                        : "border-zinc-800 bg-zinc-950/50 text-zinc-500"
                    }`}
                  >
                    <span className="truncate">{def.name}</span>
                    <span className={`font-mono ${modified ? "text-emerald-300 font-bold" : ""}`}>
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {customSkills.length > 0 && (
          <div>
            <h3 className="text-xs text-zinc-500 mb-1.5">カスタム技能</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {customSkills.map(([n, v]) => (
                <div
                  key={n}
                  className="flex justify-between rounded border border-emerald-700 bg-emerald-950/30 px-2 py-1 text-xs"
                >
                  <span className="truncate">{n}</span>
                  <span className="font-mono text-emerald-300 font-bold">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {character.memo && (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-semibold text-zinc-300 mb-2">メモ</h2>
          <p className="text-sm text-zinc-400 whitespace-pre-wrap">
            {character.memo}
          </p>
        </section>
      )}
    </div>
  );
}

// Charaeno形式JSONから探索者を作成する。変換は lib/import/charaeno.ts、
// 作成は通常の characterInputSchema + deriveStatsFor 経路に載せる。
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { characterInputSchema } from "@/lib/coc6/types";
import { deriveStatsFor, initialLuckFor } from "@/lib/coc";
import { parseCharaenoCharacter } from "@/lib/import/charaeno";

export const runtime = "nodejs";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB (キャラシJSONとしては十分)

export async function POST(req: NextRequest) {
  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_SIZE) {
    return NextResponse.json(
      { error: "ファイルが大きすぎます (2MBまで)" },
      { status: 413 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONとして読み込めません" }, { status: 400 });
  }

  // Charaeno JSON → CharacterInput
  let parsed;
  try {
    parsed = parseCharaenoCharacter(raw);
  } catch (e) {
    const message = e instanceof Error ? e.message : "変換に失敗しました";
    return NextResponse.json(
      { error: `Charaenoデータの取り込みに失敗しました: ${message}` },
      { status: 400 },
    );
  }

  // 変換結果を通常の作成スキーマで最終検証
  const validated = characterInputSchema.safeParse(parsed.input);
  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message ?? "変換後のデータが不正です" },
      { status: 400 },
    );
  }
  const d = validated.data;
  const derived = deriveStatsFor(d.edition, d, d.skills["クトゥルフ神話"] ?? 0);

  const character = await prisma.character.create({
    data: {
      edition: d.edition,
      luck: d.luck ?? initialLuckFor(d.edition),
      name: d.name,
      playerName: d.playerName ?? null,
      occupation: d.occupation ?? null,
      age: d.age ?? null,
      sex: d.sex ?? null,
      imageUrl: null,
      str: d.str,
      con: d.con,
      pow: d.pow,
      dex: d.dex,
      app: d.app,
      siz: d.siz,
      int_: d.int_,
      edu: d.edu,
      currentHp: Math.min(d.currentHp ?? derived.hp, derived.hp),
      currentMp: Math.min(d.currentMp ?? derived.mp, derived.mp),
      currentSan: Math.min(d.currentSan ?? derived.san, derived.maxSan),
      skillsJson: JSON.stringify(d.skills),
      weaponsJson: JSON.stringify(d.weapons),
      memo: d.memo ?? null,
    },
  });

  return NextResponse.json(
    {
      character,
      detectedEdition: parsed.detectedEdition,
      skillCount: parsed.skillCount,
      unknownSkills: parsed.unknownSkills,
    },
    { status: 201 },
  );
}

// ゴミ箱の操作: 復元 (deletedAtをnullへ) と完全削除 (物理削除)。
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  type: z.enum(["character", "scenario"]),
  id: z.string().min(1),
  action: z.enum(["restore", "purge"]),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "type / id / action が不正です" },
      { status: 400 },
    );
  }
  const { type, id, action } = parsed.data;

  try {
    if (type === "character") {
      // ゴミ箱にあるものだけ操作できる (通常データの誤削除防止)
      const target = await prisma.character.findFirst({
        where: { id, deletedAt: { not: null } },
        select: { id: true },
      });
      if (!target) {
        return NextResponse.json({ error: "ゴミ箱に見つかりません" }, { status: 404 });
      }
      if (action === "restore") {
        await prisma.character.update({ where: { id }, data: { deletedAt: null } });
      } else {
        await prisma.character.delete({ where: { id } });
      }
    } else {
      const target = await prisma.scenario.findFirst({
        where: { id, deletedAt: { not: null } },
        select: { id: true },
      });
      if (!target) {
        return NextResponse.json({ error: "ゴミ箱に見つかりません" }, { status: 404 });
      }
      if (action === "restore") {
        await prisma.scenario.update({ where: { id }, data: { deletedAt: null } });
      } else {
        await prisma.scenario.delete({ where: { id } });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("ゴミ箱操作に失敗:", e);
    return NextResponse.json({ error: "操作に失敗しました" }, { status: 500 });
  }
}

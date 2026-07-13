// 人間卓に紐づくダイス履歴の取得。卓ログ画面で SessionLog とマージ表示する。
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const rolls = await prisma.diceRoll.findMany({
    where: { gameSessionId: id },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return NextResponse.json(rolls);
}

// 人間卓の出来事ログ (SessionLog) の取得・追加・削除。
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const logSchema = z.object({
  kind: z.enum(["EVENT", "NOTE", "SCENE", "SUMMARY"]).default("EVENT"),
  body: z.string().min(1, "内容を入力してください").max(5000),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const logs = await prisma.sessionLog.findMany({
    where: { gameSessionId: id },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return NextResponse.json(logs);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = logSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 },
    );
  }
  // 卓の存在確認 (FK違反を誤ったメッセージにせず明示的に404)
  const session = await prisma.gameSession.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!session) {
    return NextResponse.json({ error: "卓が見つかりません" }, { status: 404 });
  }
  const log = await prisma.sessionLog.create({
    data: { gameSessionId: id, kind: parsed.data.kind, body: parsed.data.body },
  });
  return NextResponse.json(log, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const logId = req.nextUrl.searchParams.get("logId");
  if (!logId) {
    return NextResponse.json({ error: "logId が必要です" }, { status: 400 });
  }
  // 対象卓のログのみ削除できるよう gameSessionId で絞る
  await prisma.sessionLog.deleteMany({ where: { id: logId, gameSessionId: id } });
  return NextResponse.json({ ok: true });
}

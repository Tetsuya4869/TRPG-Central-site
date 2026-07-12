import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasApiKey } from "@/lib/ai-gm/client";
import { generateScenario } from "@/lib/ai-gm/scenario-gen";

export const runtime = "nodejs";
export const maxDuration = 300;

const generateSchema = z.object({
  theme: z.string().min(1, "テーマを入力してください").max(200),
  setting: z.string().max(200).optional(),
  horrorLevel: z.enum(["低", "中", "高"]).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  if (!hasApiKey()) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY が設定されていません。.env に APIキーを設定してサーバーを再起動してください。",
      },
      { status: 503 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONが不正です" }, { status: 400 });
  }
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 },
    );
  }
  try {
    const result = await generateScenario(parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    // 上流(Anthropic)の生エラーはログのみに出し、クライアントには定型文を返す
    console.error("シナリオ生成に失敗:", e);
    return NextResponse.json(
      { error: "シナリオ生成中にエラーが発生しました。時間をおいて再試行してください" },
      { status: 502 },
    );
  }
}

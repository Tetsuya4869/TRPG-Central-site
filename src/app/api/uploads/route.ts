// キャラ立ち絵のアップロード。ファイル名は完全サーバー生成でパストラバーサルを根絶し、
// MIMEはヘッダ申告+マジックバイトの二重チェックを行う。保存先はCloudflare R2。
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "nodejs";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function matchesMagicBytes(mime: string, bytes: Buffer): boolean {
  switch (mime) {
    case "image/png":
      return bytes.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/webp":
      return (
        bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
        bytes.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case "image/gif": {
      const header = bytes.subarray(0, 6).toString("ascii");
      return header === "GIF87a" || header === "GIF89a";
    }
    default:
      return false;
  }
}

export async function POST(req: NextRequest) {
  // formData読込前にcontent-lengthで大きすぎるリクエストを弾く
  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_SIZE + 10 * 1024) {
    return NextResponse.json(
      { error: "画像は5MB以下にしてください" },
      { status: 413 },
    );
  }

  let file: File | null = null;
  try {
    const formData = await req.formData();
    const entry = formData.get("file");
    if (entry instanceof File) file = entry;
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "画像は5MB以下にしてください" },
      { status: 413 },
    );
  }
  const ext = EXTENSIONS[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "PNG / JPEG / WebP / GIF のみアップロードできます" },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!matchesMagicBytes(file.type, bytes)) {
    return NextResponse.json(
      { error: "画像ファイルとして認識できません" },
      { status: 400 },
    );
  }

  const filename = `${crypto.randomUUID()}.${ext}`;
  const { env } = getCloudflareContext();
  await env.UPLOADS.put(filename, bytes, {
    httpMetadata: { contentType: file.type },
  });

  return NextResponse.json({ url: `/uploads/${filename}` }, { status: 201 });
}

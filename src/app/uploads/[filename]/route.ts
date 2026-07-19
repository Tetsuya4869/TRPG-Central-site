// R2に保存された立ち絵画像を配信する。ファイル名はサーバー生成のUUID形式のみ許可。
import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "nodejs";

const FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif)$/;

type Params = { params: Promise<{ filename: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { filename } = await params;
  if (!FILENAME_PATTERN.test(filename)) {
    return new Response("Not found", { status: 404 });
  }

  const { env } = getCloudflareContext();
  const object = await env.UPLOADS.get(filename);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  // 画像は最大5MBなのでストリーミングせずバッファで返す(型もシンプルになる)
  const body = await object.arrayBuffer();
  return new Response(body, {
    headers: {
      "Content-Type":
        object.httpMetadata?.contentType ?? "application/octet-stream",
      // ファイル名がUUIDで内容不変のため長期キャッシュしてよい
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
